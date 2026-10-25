'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  CLASSIFICACOES_REEMPREGO_REMETIDO,
  TIPOS_REMETIDO,
  confirmacaoRemetidoSchema,
  lancamentoDiretoRemetidoSchema,
  PERFIL_TOCO,
} from '@/lib/validation/remetido';
import { PERFIS, MARCAS, MARCA_LABEL, PLACA_REGEX, NF_REGEX, MSG_NF_INVALIDA, CLASSIFICACOES_SC, CLASSIFICACOES_SC_MEDIDAS } from '@/lib/validation/recebimento';
import { validarReemprego, classificarSC, pecasDoGrupo, formatarComprimentoDigitado } from '@/lib/domain/regras';
import { confirmarRemetidoAction } from './[id]/confirmar/actions';
import { criarRemetidoDiretoAction } from './novo/actions';
// Reuso intencional (Task 17/20): a edição administrativa de Remetido usa o
// MESMO wizard/validação/cálculo do lançamento pelo Pátio, em vez de uma tela
// e lógica de grupos/medições paralelas — só muda a action chamada no final.
import { atualizarRemetidoAction } from '@/app/admin/(protegido)/remetidos/[id]/actions';
import { salvarRascunhoRemetido, lerRascunhoRemetido, limparRascunhoRemetido } from '@/lib/offline/db';

const TIPO_REMETIDO_LABEL: Record<(typeof TIPOS_REMETIDO)[number], string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

type TipoMaterial = 'NOVO' | 'REEMPREGO' | 'SUCATA';
type ModoMedicao = 'INDIVIDUAL' | 'QTD_COMPRIMENTO';
type Marca = (typeof MARCAS)[number];
type Classificacao = (typeof CLASSIFICACOES_REEMPREGO_REMETIDO)[number];
type ClassificacaoSC = (typeof CLASSIFICACOES_SC)[number];

interface MedicaoLocal {
  clientId: string;
  modo: ModoMedicao;
  quantidade: number;
  comprimento: number;
  classificacaoSC?: ClassificacaoSC;
}

interface GrupoLocal {
  clientId: string;
  perfil: string;
  tipoMaterial: TipoMaterial;
  classificacao?: Classificacao;
  tampao: boolean;
  marca?: Marca;
  fabricanteOutro?: string;
  medicoes: MedicaoLocal[];
}

interface Dados {
  data: string;
  numeroDocumento: string;
  placaCavalo: string;
  placaCarreta: string;
  placaCarreta2: string;
  transportadora: string;
  responsavelPatio: string;
  /** Observação livre do Pátio. Rascunhos antigos não têm o campo. */
  observacao?: string;
}

function novoUuid(): string {
  return crypto.randomUUID();
}

function semInscricao(): () => void {
  return () => {};
}

function dataDeHojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Formata a Nota Fiscal enquanto o Pátio digita: a base da NF sempre tem 6
 * dígitos, então o traço do sufixo (ex.: "087781-1") é inserido sozinho
 * assim que o 7º dígito é digitado — ninguém precisa procurar a tecla "-".
 */
function formatarNF(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 10); // 6 da base + até 4 do sufixo
  return digitos.length > 6 ? `${digitos.slice(0, 6)}-${digitos.slice(6)}` : digitos;
}

function parseComprimento(texto: string): { valor?: number; erro?: string } {
  // Normaliza espaços "invisíveis" (NBSP etc. — comuns em teclados de
  // tablet/Android). Aceita tanto vírgula (formato BR, com ponto como
  // separador de milhar: "1.234,56") quanto ponto como decimal ("11.95").
  let t = texto.replace(/\s/g, '').trim();
  if (!t) return { erro: 'Digite o comprimento, por exemplo 8,10.' };
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { erro: 'Use números com até 2 casas decimais.' };
  const valor = Math.round(parseFloat(t) * 100) / 100;
  if (valor <= 0) return { erro: 'O comprimento precisa ser maior que zero.' };
  return { valor };
}

function metrosDoGrupo(g: GrupoLocal): number {
  return g.medicoes.reduce((acc, m) => acc + Math.round(m.quantidade * m.comprimento * 100) / 100, 0);
}

const MSG_PLACA_INVALIDA = 'Placa inválida. Ex.: ABC1D23 (Mercosul) ou CMG1234 (padrão antigo).';
const MSG_PELO_MENOS_UMA_PLACA = 'Informe ao menos uma placa: a do cavalo ou a de uma das carretas.';

function validarDados(d: Dados, exigirPlaca: boolean) {
  const erros: Partial<Record<keyof Dados, string>> = {};
  if (!d.data) erros.data = 'Informe a data.';
  if (!d.placaCavalo && !d.placaCarreta && !d.placaCarreta2) {
    // Na confirmação de um envio aguardando chegada a placa vem da Portaria, não é exigida do Pátio.
    if (exigirPlaca) erros.placaCavalo = MSG_PELO_MENOS_UMA_PLACA;
  } else {
    if (d.placaCavalo && !PLACA_REGEX.test(d.placaCavalo)) erros.placaCavalo = MSG_PLACA_INVALIDA;
    if (d.placaCarreta && !PLACA_REGEX.test(d.placaCarreta)) erros.placaCarreta = MSG_PLACA_INVALIDA;
    if (d.placaCarreta2 && !PLACA_REGEX.test(d.placaCarreta2)) erros.placaCarreta2 = MSG_PLACA_INVALIDA;
  }
  if (d.responsavelPatio.trim().length < 3) erros.responsavelPatio = 'Informe quem está preenchendo.';
  if (d.numeroDocumento && !NF_REGEX.test(d.numeroDocumento)) erros.numeroDocumento = MSG_NF_INVALIDA;
  return erros;
}

type TipoRemetido = (typeof TIPOS_REMETIDO)[number];

interface Identificacao {
  tipoRemetido: TipoRemetido | '';
  reservaPedido: string;
  destino: string;
}

// tipoRemetido NÃO é obrigatório aqui (Bloco 2.2): no lançamento direto pelo
// Pátio, sem pré-cadastro, essa decisão (Venda/Transferência/Industrialização)
// é do Administrativo — ele completa depois, na conferência. Reserva/Pedido
// foi removida da tela do Pátio (o campo continua existindo no banco e no
// pré-cadastro/Admin) — só aparece no modo "editar" (Task 17), onde quem
// preenche é sempre o Administrativo.
function validarIdentificacao(i: Identificacao) {
  const erros: Partial<Record<keyof Identificacao, string>> = {};
  if (!i.destino.trim()) erros.destino = 'Informe o destino.';
  return erros;
}

export interface ValoresIniciaisEdicao {
  tipoRemetido: TipoRemetido | '';
  reservaPedido: string;
  destino: string;
  dados: Dados;
  grupos: GrupoLocal[];
}

type Props =
  | { modo: 'novo' }
  | {
      modo: 'confirmar';
      movimentacaoId: string;
      numeroDocumentoPreCadastrado: string | null;
      /** O que a Portaria já preencheu: entra nos campos vazios (nunca sobrescreve o que o Pátio digitou). */
      dadosPortaria?: { placaCavalo: string; placaCarreta: string; transportadora: string };
    }
  | { modo: 'editar'; movimentacaoId: string; valoresIniciais: ValoresIniciaisEdicao };

// Rascunho do modo "confirmar": o Pátio vai medindo os trilhos ANTES da carreta
// chegar e pode fechar o app a qualquer momento. Fica no IndexedDB (lib/offline/db).
interface RascunhoLocal {
  identificacao: Identificacao;
  dados: Dados;
  grupos: GrupoLocal[];
  activeGrupoId: string | null;
  modoDraft: ModoMedicao;
  dataTocada: boolean;
}

function rascunhoValido(r: unknown): r is RascunhoLocal {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    Array.isArray(o.grupos) &&
    typeof o.dados === 'object' && o.dados !== null &&
    typeof o.identificacao === 'object' && o.identificacao !== null
  );
}

export function RemetidoWizard(props: Props) {
  // O rascunho vem do IndexedDB (assíncrono), mas o useState só usa o valor inicial na
  // PRIMEIRA renderização — por isso o wizard só monta depois que o rascunho foi lido.
  // Além disso o auto-save não pode rodar antes disso: senão sobrescreveria o rascunho
  // guardado com um estado vazio (era isso que fazia as medições "sumirem").
  const movimentacaoId = props.modo === 'confirmar' ? props.movimentacaoId : null;
  const [rascunho, setRascunho] = useState<RascunhoLocal | null | undefined>(movimentacaoId ? undefined : null);

  useEffect(() => {
    if (!movimentacaoId) return;
    let cancelado = false;
    lerRascunhoRemetido(movimentacaoId)
      .then((r) => {
        const salvo: unknown = r?.rascunho;
        if (!cancelado) setRascunho(rascunhoValido(salvo) ? salvo : null);
      })
      .catch(() => {
        if (!cancelado) setRascunho(null);
      });
    return () => {
      cancelado = true;
    };
  }, [movimentacaoId]);

  if (rascunho === undefined) return <p className="mt-4 text-sm text-ink-muted">Carregando...</p>;
  return <RemetidoWizardInterno props={props} rascunhoInicial={rascunho} />;
}

function RemetidoWizardInterno({ props, rascunhoInicial }: { props: Props; rascunhoInicial: RascunhoLocal | null }) {
  const router = useRouter();
  const numeroDocumentoPreCadastrado = props.modo === 'confirmar' ? props.numeroDocumentoPreCadastrado : null;
  const hoje = useSyncExternalStore(semInscricao, dataDeHojeLocal, () => '');

  const [dataTocada, setDataTocada] = useState(
    rascunhoInicial ? rascunhoInicial.dataTocada : props.modo === 'editar'
  );
  const [identificacao, setIdentificacao] = useState<Identificacao>(
    rascunhoInicial
      ? rascunhoInicial.identificacao
      : props.modo === 'editar'
        ? { tipoRemetido: props.valoresIniciais.tipoRemetido, reservaPedido: props.valoresIniciais.reservaPedido, destino: props.valoresIniciais.destino }
        : { tipoRemetido: '', reservaPedido: '', destino: '' },
  );
  const dadosPortaria = props.modo === 'confirmar' ? props.dadosPortaria : undefined;
  const [dadosBrutos, setDados] = useState<Dados>(
    rascunhoInicial
      ? {
          ...rascunhoInicial.dados,
          placaCavalo: rascunhoInicial.dados.placaCavalo || dadosPortaria?.placaCavalo || '',
          placaCarreta: rascunhoInicial.dados.placaCarreta || dadosPortaria?.placaCarreta || '',
          transportadora: rascunhoInicial.dados.transportadora || dadosPortaria?.transportadora || '',
        }
      : props.modo === 'editar'
        ? props.valoresIniciais.dados
        : {
            data: '',
            numeroDocumento: numeroDocumentoPreCadastrado ?? '',
            placaCavalo: dadosPortaria?.placaCavalo ?? '',
            placaCarreta: dadosPortaria?.placaCarreta ?? '',
            placaCarreta2: '',
            transportadora: dadosPortaria?.transportadora ?? '',
            responsavelPatio: '',
            observacao: '',
          },
  );
  // A Portaria pode preencher enquanto esta tela já está aberta: entra só nos campos ainda vazios.
  const portariaCavalo = dadosPortaria?.placaCavalo ?? '';
  const portariaCarreta = dadosPortaria?.placaCarreta ?? '';
  const portariaTransportadora = dadosPortaria?.transportadora ?? '';
  useEffect(() => {
    setDados((atual) => ({
      ...atual,
      placaCavalo: atual.placaCavalo || portariaCavalo,
      placaCarreta: atual.placaCarreta || portariaCarreta,
      transportadora: atual.transportadora || portariaTransportadora,
    }));
  }, [portariaCavalo, portariaCarreta, portariaTransportadora]);
  const [mostrarCarreta2, setMostrarCarreta2] = useState(
    rascunhoInicial ? Boolean(rascunhoInicial.dados.placaCarreta2) : props.modo === 'editar' && Boolean(props.valoresIniciais.dados.placaCarreta2)
  );
  const [attemptSubmit, setAttemptSubmit] = useState(false);
  const [grupos, setGrupos] = useState<GrupoLocal[]>(rascunhoInicial ? rascunhoInicial.grupos : props.modo === 'editar' ? props.valoresIniciais.grupos : []);
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(rascunhoInicial ? rascunhoInicial.activeGrupoId : null);
  const [draftPerfil, setDraftPerfil] = useState('');
  const [draftTipo, setDraftTipo] = useState<TipoMaterial>('NOVO');
  const [draftMedicao, setDraftMedicao] = useState({
    quantidade: '1',
    comprimento: '',
    sc: '' as ClassificacaoSC | '',
    scManual: false,
    erro: '',
  });
  const [modoDraft, setModoDraft] = useState<ModoMedicao>(rascunhoInicial ? rascunhoInicial.modoDraft : 'INDIVIDUAL');
  const [enviando, setEnviando] = useState(false);
  const [erroFinal, setErroFinal] = useState('');

  const dados = useMemo<Dados>(
    () => (dataTocada ? dadosBrutos : { ...dadosBrutos, data: dadosBrutos.data || hoje }),
    [dadosBrutos, dataTocada, hoje],
  );
  const errosDados = attemptSubmit ? validarDados(dados, props.modo !== 'confirmar') : {};
  const temIdentificacao = props.modo === 'novo' || props.modo === 'editar';
  const errosIdentificacao = attemptSubmit && temIdentificacao ? validarIdentificacao(identificacao) : {};
  const grupoAtivo = grupos.find((g) => g.clientId === activeGrupoId) ?? null;

  // Auto-save em modo "confirmar" — a cada alteração (inclusive cada medição lançada) o
  // rascunho vai para o IndexedDB, então nada se perde se o app for fechado. O estado
  // inicial já veio do rascunho (ver RemetidoWizard), então salvar no mount é inofensivo.
  const movimentacaoId = props.modo === 'confirmar' ? props.movimentacaoId : null;
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [falhaRascunho, setFalhaRascunho] = useState(false);

  useEffect(() => {
    if (!movimentacaoId) return;
    const rascunhoAtual: RascunhoLocal = { identificacao, dados: dadosBrutos, grupos, activeGrupoId, modoDraft, dataTocada };
    salvarRascunhoRemetido(movimentacaoId, rascunhoAtual)
      .then(() => {
        setFalhaRascunho(false);
        setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch((err) => {
        console.error('Erro ao salvar rascunho:', err);
        setFalhaRascunho(true);
      });
  }, [movimentacaoId, identificacao, dadosBrutos, grupos, activeGrupoId, modoDraft, dataTocada]);

  function adicionarGrupo() {
    if (!draftPerfil) return;
    const diversos = draftPerfil === PERFIL_TOCO;
    const g: GrupoLocal = {
      clientId: novoUuid(),
      perfil: draftPerfil,
      // Diversos (TOCO) é sempre sucata e não tem medição — só o peso, depois, pelo Administrativo.
      tipoMaterial: diversos ? 'SUCATA' : draftTipo,
      tampao: false,
      medicoes: [],
    };
    setGrupos((prev) => [...prev, g]);
    setActiveGrupoId(diversos ? null : g.clientId);
    setDraftPerfil('');
  }

  function atualizarGrupo(id: string, patch: Partial<GrupoLocal>) {
    setGrupos((prev) => prev.map((g) => (g.clientId === id ? { ...g, ...patch } : g)));
  }

  function removerGrupo(id: string) {
    setGrupos((prev) => prev.filter((g) => g.clientId !== id));
    if (activeGrupoId === id) setActiveGrupoId(null);
  }

  function adicionarMedicao() {
    if (!grupoAtivo) return;
    const r = parseComprimento(draftMedicao.comprimento);
    if (r.erro || r.valor == null) {
      setDraftMedicao((d) => ({ ...d, erro: r.erro ?? '' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'REEMPREGO' && !validarReemprego(r.valor)) {
      setDraftMedicao((d) => ({ ...d, erro: 'Medição de reemprego precisa ter ao menos 7 m.' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'SUCATA' && !draftMedicao.sc) {
      setDraftMedicao((d) => ({ ...d, erro: 'Selecione a classificação SC1, SC2, SC3 ou Jacaré.' }));
      return;
    }
    const quantidade = modoDraft === 'QTD_COMPRIMENTO' ? Math.max(1, Number(draftMedicao.quantidade) || 1) : 1;
    const medicao: MedicaoLocal = {
      clientId: novoUuid(),
      modo: modoDraft,
      quantidade,
      comprimento: r.valor,
      classificacaoSC: grupoAtivo.tipoMaterial === 'SUCATA' ? (draftMedicao.sc as ClassificacaoSC) : undefined,
    };
    atualizarGrupo(grupoAtivo.clientId, { medicoes: [...grupoAtivo.medicoes, medicao] });
    setDraftMedicao({ quantidade: '1', comprimento: '', sc: '', scManual: false, erro: '' });
  }

  function removerMedicao(grupoId: string, medicaoClientId: string) {
    setGrupos((prev) =>
      prev.map((g) =>
        g.clientId === grupoId ? { ...g, medicoes: g.medicoes.filter((m) => m.clientId !== medicaoClientId) } : g,
      ),
    );
  }

  const grupoIncompleto = (g: GrupoLocal) =>
    (g.perfil !== PERFIL_TOCO && g.medicoes.length === 0) ||
    (g.tipoMaterial === 'REEMPREGO' && !g.classificacao) ||
    (g.tipoMaterial === 'NOVO' && !g.marca) ||
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());

  const podeConfirmar = grupos.length > 0 && grupos.every((g) => !grupoIncompleto(g));

  async function confirmar() {
    setAttemptSubmit(true);
    setErroFinal('');
    if (Object.keys(validarDados(dados, props.modo !== 'confirmar')).length > 0) return;
    if (temIdentificacao && Object.keys(validarIdentificacao(identificacao)).length > 0) return;
    if (!podeConfirmar) {
      setErroFinal('Complete todos os grupos (medições e classificação) antes de confirmar.');
      return;
    }

    const dadosPayload = {
      ...dados,
      numeroDocumento: dados.numeroDocumento || undefined,
      placaCavalo: dados.placaCavalo || undefined,
      placaCarreta: dados.placaCarreta || undefined,
      placaCarreta2: dados.placaCarreta2 || undefined,
      transportadora: dados.transportadora || undefined,
      observacao: dados.observacao || undefined,
    };
    const gruposPayload = grupos.map((g) => ({
      clientId: g.clientId,
      perfil: g.perfil,
      tipoMaterial: g.tipoMaterial,
      ...(g.tipoMaterial === 'REEMPREGO' ? { classificacao: g.classificacao } : {}),
      ...(g.tipoMaterial === 'NOVO'
        ? {
            ...(g.marca ? { marca: g.marca } : {}),
            ...(g.marca === 'OUTROS' ? { fabricanteOutro: g.fabricanteOutro || undefined } : {}),
          }
        : {}),
      medicoes: g.medicoes.map((m) => ({
        clientId: m.clientId,
        modo: m.modo,
        quantidade: m.quantidade,
        comprimento: m.comprimento,
        ...(g.tipoMaterial === 'SUCATA' ? { classificacaoSC: m.classificacaoSC } : {}),
      })),
    }));

    setEnviando(true);
    let resultado: { ok: boolean; erro?: string };

    if (props.modo === 'novo' || props.modo === 'editar') {
      const parsed = lancamentoDiretoRemetidoSchema.safeParse({
        tipoRemetido: identificacao.tipoRemetido && identificacao.tipoRemetido.trim() ? identificacao.tipoRemetido : undefined,
        reservaPedido: props.modo === 'editar' && identificacao.reservaPedido ? identificacao.reservaPedido : undefined,
        destino: identificacao.destino,
        dados: dadosPayload,
        grupos: gruposPayload,
      });
      if (!parsed.success) {
        setEnviando(false);
        setErroFinal('Dados inválidos. Revise os campos e tente novamente.');
        return;
      }
      resultado =
        props.modo === 'editar'
          ? await atualizarRemetidoAction(props.movimentacaoId, parsed.data)
          : await criarRemetidoDiretoAction(parsed.data);
    } else {
      const parsed = confirmacaoRemetidoSchema.safeParse({ dados: dadosPayload, grupos: gruposPayload });
      if (!parsed.success) {
        setEnviando(false);
        setErroFinal('Dados inválidos. Revise os campos e tente novamente.');
        return;
      }
      resultado = await confirmarRemetidoAction(props.movimentacaoId, parsed.data);
    }

    setEnviando(false);
    if (!resultado.ok) {
      setErroFinal(resultado.erro ?? 'Não foi possível salvar a carga.');
      return;
    }
    // Limpar rascunho ao confirmar com sucesso
    if (props.modo === 'confirmar') {
      const movimentacaoId = (props as { modo: 'confirmar'; movimentacaoId: string }).movimentacaoId;
      limparRascunhoRemetido(movimentacaoId).catch(() => {});
    }
    const nextUrl =
      props.modo === 'editar'
        ? `/admin/remetidos/${(props as { modo: 'editar'; movimentacaoId: string }).movimentacaoId}`
        : '/patio/remetidos?salvo=carregamento';
    router.push(nextUrl);
  }

  return (
    <div className="mt-4 space-y-4">
      {movimentacaoId && falhaRascunho && (
        <p role="alert" className="text-sm text-bad">
          Não foi possível guardar o rascunho neste aparelho. Não feche o app antes de confirmar.
        </p>
      )}
      {movimentacaoId && !falhaRascunho && salvoEm && (
        <p role="status" className="text-xs text-ink-muted">
          Rascunho salvo neste aparelho às {salvoEm}
        </p>
      )}
      {temIdentificacao && (
        <section className="card space-y-3">
          <h2 className="card-title !mb-0">Identificação da carga</h2>
          {props.modo === 'novo' && (
            <p className="text-sm text-ink-muted">Sem pré-cadastro — preencha o que normalmente vem do Administrativo.</p>
          )}
          <div className="field">
            <label htmlFor="f-tipo-remetido">
              Tipo de carga{props.modo === 'novo' ? ' (opcional — o Administrativo pode completar depois)' : ''}
            </label>
            <select
              id="f-tipo-remetido"
              className="h-11"
              value={identificacao.tipoRemetido}
              onChange={(e) => setIdentificacao({ ...identificacao, tipoRemetido: e.target.value as TipoRemetido })}
            >
              <option value="">Não sei / completar depois</option>
              {TIPOS_REMETIDO.map((t) => (
                <option key={t} value={t}>{TIPO_REMETIDO_LABEL[t]}</option>
              ))}
            </select>
          </div>
          {props.modo === 'editar' && (
            <div className="field">
              <label htmlFor="f-reserva-pedido">Reserva/Pedido</label>
              <input
                id="f-reserva-pedido"
                className="h-11"
                value={identificacao.reservaPedido}
                onChange={(e) => setIdentificacao({ ...identificacao, reservaPedido: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="f-destino">Destino *</label>
            <input id="f-destino" className="h-11 uppercase" value={identificacao.destino} onChange={(e) => setIdentificacao({ ...identificacao, destino: e.target.value })} />
            {errosIdentificacao.destino && <p className="text-sm text-bad">{errosIdentificacao.destino}</p>}
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="card-title !mb-0">Dados da chegada</h2>
        <div className="field">
          <label htmlFor="f-data">Data *</label>
          <input
            id="f-data"
            type="date"
            className="h-11"
            value={dados.data}
            onChange={(e) => {
              setDataTocada(true);
              setDados({ ...dadosBrutos, data: e.target.value });
            }}
          />
          {errosDados.data && <p className="text-sm text-bad">{errosDados.data}</p>}
        </div>
        {/* Aguardando chegada: NF, placas e transportadora são da Portaria/Administrativo, não do Pátio. */}
        {props.modo !== 'confirmar' && (
          <>
          <div className="field">
            <label htmlFor="f-nf">Nota fiscal {numeroDocumentoPreCadastrado ? '' : '(se já souber)'}</label>
            <input
              id="f-nf"
              inputMode="numeric"
              placeholder="Ex.: 123456 ou 087781-1"
              disabled={Boolean(numeroDocumentoPreCadastrado)}
              className="h-11 disabled:text-ink-dim"
              value={dadosBrutos.numeroDocumento}
              onChange={(e) => setDados({ ...dadosBrutos, numeroDocumento: formatarNF(e.target.value) })}
            />
            {errosDados.numeroDocumento && <p className="text-sm text-bad">{errosDados.numeroDocumento}</p>}
          </div>

          <div className="rounded-lg border-2 p-3" style={{ borderColor: 'var(--b1)', background: 'color-mix(in srgb, var(--b0) 40%, transparent)' }}>
            <p className="text-sm font-semibold text-primary">Placas * — informe ao menos uma</p>
            <p className="text-xs text-ink-dim">A placa da carreta é a informação mais usada na operação.</p>
            {errosDados.placaCavalo === MSG_PELO_MENOS_UMA_PLACA && (
              <p className="mt-1 text-sm text-bad">{errosDados.placaCavalo}</p>
            )}

            <div className="field mt-2">
              <label htmlFor="f-carreta">1ª carreta</label>
              <input
                id="f-carreta"
                maxLength={7}
                className="h-11 text-lg font-semibold uppercase"
                value={dadosBrutos.placaCarreta}
                onChange={(e) => setDados({ ...dadosBrutos, placaCarreta: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
              />
              {errosDados.placaCarreta && <p className="text-sm text-bad">{errosDados.placaCarreta}</p>}
            </div>

            {mostrarCarreta2 ? (
              <div className="field mt-2">
                <label htmlFor="f-carreta2">2ª carreta (opcional)</label>
                <input
                  id="f-carreta2"
                  maxLength={7}
                  className="h-11 text-lg font-semibold uppercase"
                  value={dadosBrutos.placaCarreta2}
                  onChange={(e) => setDados({ ...dadosBrutos, placaCarreta2: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
                />
                {errosDados.placaCarreta2 && <p className="text-sm text-bad">{errosDados.placaCarreta2}</p>}
              </div>
            ) : (
              <button type="button" className="mt-2 text-sm text-primary underline" onClick={() => setMostrarCarreta2(true)}>
                + Adicionar segunda carreta
              </button>
            )}

            <div className="field mt-3">
              <label htmlFor="f-cavalo">Placa do cavalo</label>
              <input
                id="f-cavalo"
                maxLength={7}
                className="h-11 uppercase"
                value={dadosBrutos.placaCavalo}
                onChange={(e) => setDados({ ...dadosBrutos, placaCavalo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
              />
              {errosDados.placaCavalo && errosDados.placaCavalo !== MSG_PELO_MENOS_UMA_PLACA && (
                <p className="text-sm text-bad">{errosDados.placaCavalo}</p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-transp">Transportadora</label>
            <input id="f-transp" className="h-11" value={dadosBrutos.transportadora} onChange={(e) => setDados({ ...dadosBrutos, transportadora: e.target.value })} />
          </div>
          </>
        )}
        <div className="field">
          <label htmlFor="f-resp">Responsável (Pátio) *</label>
          <input id="f-resp" className="h-11" value={dadosBrutos.responsavelPatio} onChange={(e) => setDados({ ...dadosBrutos, responsavelPatio: e.target.value })} />
          {errosDados.responsavelPatio && <p className="text-sm text-bad">{errosDados.responsavelPatio}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-obs">Observação (opcional)</label>
          <textarea id="f-obs" rows={3} maxLength={500} className="min-h-[5rem] w-full" placeholder="Algo que o Administrativo precisa saber (avaria, falta de material, aviso...)" value={dadosBrutos.observacao ?? ''} onChange={(e) => setDados({ ...dadosBrutos, observacao: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title !mb-0">Grupos</h2>
        {grupos.map((g, i) => (
          <div key={g.clientId} className="grupo-card !mb-0 p-3">
            <div className="flex items-center justify-between">
              <span className="grupo-title">
                {g.perfil === PERFIL_TOCO ? 'DIVERSOS (TOCO) — SUCATA' : `${g.perfil} — ${g.tipoMaterial}`}
                {g.tipoMaterial === 'REEMPREGO' && (g.classificacao === 'G1' || g.classificacao === 'G2') ? ' (Tampão)' : ''}
              </span>
              <button className="text-sm text-bad" onClick={() => removerGrupo(g.clientId)}>
                Remover
              </button>
            </div>

            {g.tipoMaterial === 'NOVO' && (
              <div className="mt-2 flex gap-2">
                <select
                  aria-label={`Marca do Grupo ${i + 1}`}
                  className="h-11 flex-1"
                  value={g.marca ?? ''}
                  onChange={(e) => atualizarGrupo(g.clientId, { marca: (e.target.value || undefined) as Marca | undefined })}
                >
                  <option value="" disabled>
                    Marca *
                  </option>
                  {MARCAS.map((m) => (
                    <option key={m} value={m}>
                      {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                    </option>
                  ))}
                </select>
                {g.marca === 'OUTROS' && (
                  <input
                    className="h-11 flex-1"
                    placeholder="Nome do fabricante"
                    value={g.fabricanteOutro ?? ''}
                    onChange={(e) => atualizarGrupo(g.clientId, { fabricanteOutro: e.target.value })}
                  />
                )}
              </div>
            )}

            {g.tipoMaterial === 'REEMPREGO' && (
              <div className="mt-2 space-y-2">
                <select
                  className="h-11"
                  value={g.classificacao ?? ''}
                  onChange={(e) => atualizarGrupo(g.clientId, { classificacao: (e.target.value || undefined) as Classificacao | undefined })}
                >
                  <option value="">Classificação</option>
                  {CLASSIFICACOES_REEMPREGO_REMETIDO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {g.perfil === PERFIL_TOCO ? (
              <p className="mt-2 text-sm text-ink-muted">
                Diversos não tem medição. O peso é informado pelo Administrativo depois que o caminhão for pesado.
              </p>
            ) : (
            <div className="mt-2">
              <p className="text-sm text-ink-muted">
                {g.medicoes.length === 0
                  ? 'Nenhuma medição adicionada'
                  : `${pecasDoGrupo(g.medicoes)} ${pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · ${metrosDoGrupo(g).toFixed(2).replace('.', ',')} m`}
              </p>
              <div className="mt-1 grupo-card !mb-0">
                {g.medicoes.map((m) => (
                  <div key={m.clientId} className="medicao-row px-2">
                    <span>
                      {m.quantidade > 1 ? `${m.quantidade} × ${m.comprimento} m` : `${m.comprimento} m`}
                      {m.classificacaoSC ? ` — ${m.classificacaoSC}` : ''}
                    </span>
                    <button className="text-bad" onClick={() => removerMedicao(g.clientId, m.clientId)}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              {activeGrupoId === g.clientId && (
                <div className="conf-block mt-2">
                  <div className="flex gap-2 text-sm">
                    <button
                      className={`btn btn-sm ${modoDraft === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setModoDraft('INDIVIDUAL')}
                    >
                      Individual
                    </button>
                    <button
                      className={`btn btn-sm ${modoDraft === 'QTD_COMPRIMENTO' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setModoDraft('QTD_COMPRIMENTO')}
                    >
                      Qtd × comprimento
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {modoDraft === 'QTD_COMPRIMENTO' && (
                      <input
                        inputMode="numeric"
                        className="h-11 w-16 shrink-0"
                        value={draftMedicao.quantidade}
                        onChange={(e) => setDraftMedicao((d) => ({ ...d, quantidade: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            adicionarMedicao();
                          }
                        }}
                      />
                    )}
                    <input
                      inputMode="decimal"
                      placeholder="Comprimento (m), ex.: digite 810 para 8,10"
                      className="h-11 flex-1 min-w-[160px]"
                      value={draftMedicao.comprimento}
                      onChange={(e) => {
                        const texto = formatarComprimentoDigitado(e.target.value);
                        const r = parseComprimento(texto);
                        setDraftMedicao((d) => ({
                          ...d,
                          comprimento: texto,
                          sc: !d.scManual && r.valor != null ? classificarSC(r.valor) : d.sc,
                          erro: '',
                        }));
                      }}
                      onKeyDown={(e) => {
                        // Enter envia a medida direto — evita ter que tirar a mão do
                        // teclado numérico (celular ou PC) para tocar em "Adicionar".
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          adicionarMedicao();
                        }
                      }}
                    />
                    {g.tipoMaterial === 'SUCATA' && (
                      <select
                        className="h-11 w-20"
                        value={draftMedicao.sc}
                        onChange={(e) =>
                          setDraftMedicao((d) => ({ ...d, sc: e.target.value as ClassificacaoSC | '', scManual: true }))
                        }
                      >
                        <option value="">SC</option>
                        {CLASSIFICACOES_SC_MEDIDAS.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc === 'JACARE' ? 'Jacaré' : sc}
                          </option>
                        ))}
                      </select>
                    )}
                    <button className="btn btn-primary h-11" onClick={adicionarMedicao}>
                      Adicionar
                    </button>
                  </div>
                  {draftMedicao.erro && <p className="mt-1 text-sm text-bad">{draftMedicao.erro}</p>}
                </div>
              )}
              {activeGrupoId !== g.clientId && (
                <button className="mt-2 text-sm text-primary underline" onClick={() => setActiveGrupoId(g.clientId)}>
                  Lançar medidas
                </button>
              )}
            </div>
            )}
          </div>
        ))}

        <div className="flex gap-2">
          <select className="h-11 min-w-[7rem] flex-1" value={draftPerfil} onChange={(e) => setDraftPerfil(e.target.value)}>
            <option value="">Perfil</option>
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={PERFIL_TOCO}>Diversos (sem medição — só peso)</option>
          </select>
          <select
            className="h-11 w-28"
            value={draftPerfil === PERFIL_TOCO ? 'SUCATA' : draftTipo}
            disabled={draftPerfil === PERFIL_TOCO}
            onChange={(e) => setDraftTipo(e.target.value as TipoMaterial)}
          >
            <option value="NOVO">NOVO</option>
            <option value="REEMPREGO">REEMPREGO</option>
            <option value="SUCATA">SUCATA</option>
          </select>
          <button className="btn btn-primary h-11 whitespace-nowrap" onClick={adicionarGrupo} disabled={!draftPerfil}>
            Adicionar grupo
          </button>
        </div>
      </section>

      {erroFinal && <p role="alert" className="text-sm text-bad">{erroFinal}</p>}
      <button className="btn btn-primary btn-lg h-12" disabled={enviando} onClick={confirmar}>
        {enviando
          ? { novo: 'Lançando...', confirmar: 'Confirmando...', editar: 'Salvando...' }[props.modo]
          : { novo: 'Lançar carga', confirmar: 'Confirmar chegada e salvar', editar: 'Salvar alterações' }[props.modo]}
      </button>
    </div>
  );
}
