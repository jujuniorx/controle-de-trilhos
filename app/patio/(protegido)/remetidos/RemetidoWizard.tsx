'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  CLASSIFICACOES_REEMPREGO_REMETIDO,
  TIPOS_REMETIDO,
  confirmacaoRemetidoSchema,
  lancamentoDiretoRemetidoSchema,
} from '@/lib/validation/remetido';
import { PERFIS, MARCAS, MARCA_LABEL, PLACA_REGEX, NF_REGEX, MSG_NF_INVALIDA, CLASSIFICACOES_SC } from '@/lib/validation/recebimento';
import { validarReemprego, classificarSC, pecasDoGrupo } from '@/lib/domain/regras';
import { confirmarRemetidoAction } from './[id]/confirmar/actions';
import { criarRemetidoDiretoAction } from './novo/actions';
// Reuso intencional (Task 17/20): a edição administrativa de Remetido usa o
// MESMO wizard/validação/cálculo do lançamento pelo Pátio, em vez de uma tela
// e lógica de grupos/medições paralelas — só muda a action chamada no final.
import { atualizarRemetidoAction } from '@/app/admin/(protegido)/remetidos/[id]/actions';

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

function parseComprimento(texto: string): { valor?: number; erro?: string } {
  const t = texto.trim().replace(',', '.');
  if (!t) return { erro: 'Digite o comprimento, por exemplo 8,10.' };
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

function validarDados(d: Dados) {
  const erros: Partial<Record<keyof Dados, string>> = {};
  if (!d.data) erros.data = 'Informe a data.';
  if (!d.placaCavalo && !d.placaCarreta && !d.placaCarreta2) {
    erros.placaCavalo = MSG_PELO_MENOS_UMA_PLACA;
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
  | { modo: 'confirmar'; movimentacaoId: string; numeroDocumentoPreCadastrado: string | null }
  | { modo: 'editar'; movimentacaoId: string; valoresIniciais: ValoresIniciaisEdicao };

export function RemetidoWizard(props: Props) {
  const router = useRouter();
  const numeroDocumentoPreCadastrado = props.modo === 'confirmar' ? props.numeroDocumentoPreCadastrado : null;
  const hoje = useSyncExternalStore(semInscricao, dataDeHojeLocal, () => '');
  const [dataTocada, setDataTocada] = useState(props.modo === 'editar');
  const [identificacao, setIdentificacao] = useState<Identificacao>(
    props.modo === 'editar'
      ? { tipoRemetido: props.valoresIniciais.tipoRemetido, reservaPedido: props.valoresIniciais.reservaPedido, destino: props.valoresIniciais.destino }
      : { tipoRemetido: '', reservaPedido: '', destino: '' },
  );
  const [dadosBrutos, setDados] = useState<Dados>(
    props.modo === 'editar'
      ? props.valoresIniciais.dados
      : {
          data: '',
          numeroDocumento: numeroDocumentoPreCadastrado ?? '',
          placaCavalo: '',
          placaCarreta: '',
          placaCarreta2: '',
          transportadora: '',
          responsavelPatio: '',
        },
  );
  const [mostrarCarreta2, setMostrarCarreta2] = useState(props.modo === 'editar' && Boolean(props.valoresIniciais.dados.placaCarreta2));
  const [attemptSubmit, setAttemptSubmit] = useState(false);
  const [grupos, setGrupos] = useState<GrupoLocal[]>(props.modo === 'editar' ? props.valoresIniciais.grupos : []);
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null);
  const [draftPerfil, setDraftPerfil] = useState('');
  const [draftTipo, setDraftTipo] = useState<TipoMaterial>('NOVO');
  const [draftMedicao, setDraftMedicao] = useState({
    quantidade: '1',
    comprimento: '',
    sc: '' as ClassificacaoSC | '',
    scManual: false,
    erro: '',
  });
  const [modoDraft, setModoDraft] = useState<ModoMedicao>('INDIVIDUAL');
  const [enviando, setEnviando] = useState(false);
  const [erroFinal, setErroFinal] = useState('');

  const dados = useMemo<Dados>(
    () => (dataTocada ? dadosBrutos : { ...dadosBrutos, data: dadosBrutos.data || hoje }),
    [dadosBrutos, dataTocada, hoje],
  );
  const errosDados = attemptSubmit ? validarDados(dados) : {};
  const temIdentificacao = props.modo === 'novo' || props.modo === 'editar';
  const errosIdentificacao = attemptSubmit && temIdentificacao ? validarIdentificacao(identificacao) : {};
  const grupoAtivo = grupos.find((g) => g.clientId === activeGrupoId) ?? null;

  function adicionarGrupo() {
    if (!draftPerfil) return;
    const g: GrupoLocal = {
      clientId: novoUuid(),
      perfil: draftPerfil,
      tipoMaterial: draftTipo,
      tampao: false,
      medicoes: [],
    };
    setGrupos((prev) => [...prev, g]);
    setActiveGrupoId(g.clientId);
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
      setDraftMedicao((d) => ({ ...d, erro: 'Selecione a classificação SC1, SC2 ou SC3.' }));
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
    g.medicoes.length === 0 ||
    (g.tipoMaterial === 'REEMPREGO' && !g.classificacao) ||
    (g.tipoMaterial === 'NOVO' && !g.marca) ||
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());

  const podeConfirmar = grupos.length > 0 && grupos.every((g) => !grupoIncompleto(g));

  async function confirmar() {
    setAttemptSubmit(true);
    setErroFinal('');
    if (Object.keys(validarDados(dados)).length > 0) return;
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
    };
    const gruposPayload = grupos.map((g) => ({
      clientId: g.clientId,
      perfil: g.perfil,
      tipoMaterial: g.tipoMaterial,
      ...(g.tipoMaterial === 'REEMPREGO' ? { classificacao: g.classificacao, tampao: g.tampao } : {}),
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
        tipoRemetido: identificacao.tipoRemetido || undefined,
        reservaPedido: props.modo === 'editar' ? identificacao.reservaPedido || undefined : undefined,
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
      setErroFinal(resultado.erro ?? 'Não foi possível salvar o remetido.');
      return;
    }
    router.push(props.modo === 'editar' ? `/admin/remetidos/${props.movimentacaoId}` : '/patio/remetidos');
  }

  return (
    <div className="mt-4 space-y-4">
      {temIdentificacao && (
        <section className="card space-y-3">
          <h2 className="card-title !mb-0">Identificação do remetido</h2>
          {props.modo === 'novo' && (
            <p className="text-sm text-ink-muted">Sem pré-cadastro — preencha o que normalmente vem do Administrativo.</p>
          )}
          <div className="field">
            <label htmlFor="f-tipo-remetido">
              Tipo de remetido{props.modo === 'novo' ? ' (opcional — o Administrativo pode completar depois)' : ''}
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
            <input id="f-destino" className="h-11" value={identificacao.destino} onChange={(e) => setIdentificacao({ ...identificacao, destino: e.target.value })} />
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
              setDados({ ...dados, data: e.target.value });
            }}
          />
          {errosDados.data && <p className="text-sm text-bad">{errosDados.data}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-nf">Nota fiscal {numeroDocumentoPreCadastrado ? '' : '(se já souber)'}</label>
          <input
            id="f-nf"
            inputMode="numeric"
            placeholder="Ex.: 123456 ou 087781-1"
            disabled={Boolean(numeroDocumentoPreCadastrado)}
            className="h-11 disabled:text-ink-dim"
            value={dados.numeroDocumento}
            onChange={(e) => setDados({ ...dados, numeroDocumento: e.target.value.replace(/[^\d-]/g, '').slice(0, 14) })}
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
              value={dados.placaCarreta}
              onChange={(e) => setDados({ ...dados, placaCarreta: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
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
                value={dados.placaCarreta2}
                onChange={(e) => setDados({ ...dados, placaCarreta2: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
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
              value={dados.placaCavalo}
              onChange={(e) => setDados({ ...dados, placaCavalo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
            />
            {errosDados.placaCavalo && errosDados.placaCavalo !== MSG_PELO_MENOS_UMA_PLACA && (
              <p className="text-sm text-bad">{errosDados.placaCavalo}</p>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-transp">Transportadora</label>
          <input id="f-transp" className="h-11" value={dados.transportadora} onChange={(e) => setDados({ ...dados, transportadora: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-resp">Responsável (Pátio) *</label>
          <input id="f-resp" className="h-11" value={dados.responsavelPatio} onChange={(e) => setDados({ ...dados, responsavelPatio: e.target.value })} />
          {errosDados.responsavelPatio && <p className="text-sm text-bad">{errosDados.responsavelPatio}</p>}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title !mb-0">Grupos</h2>
        {grupos.map((g, i) => (
          <div key={g.clientId} className="grupo-card !mb-0 p-3">
            <div className="flex items-center justify-between">
              <span className="grupo-title">
                {g.perfil} — {g.tipoMaterial}
                {g.tampao ? ' (Tampão)' : ''}
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
                <label className="flex items-center gap-2 text-sm normal-case text-ink">
                  <input
                    type="checkbox"
                    checked={g.tampao}
                    onChange={(e) =>
                      atualizarGrupo(g.clientId, {
                        tampao: e.target.checked,
                        classificacao: e.target.checked && g.classificacao === 'G3' ? undefined : g.classificacao,
                      })
                    }
                  />
                  É tampão
                </label>
                <select
                  className="h-11"
                  value={g.classificacao ?? ''}
                  onChange={(e) => atualizarGrupo(g.clientId, { classificacao: (e.target.value || undefined) as Classificacao | undefined })}
                >
                  <option value="">{g.tampao ? 'Classificação (G1 ou G2)' : 'Classificação'}</option>
                  {CLASSIFICACOES_REEMPREGO_REMETIDO.filter((c) => !g.tampao || c !== 'G3').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  <div className="mt-2 flex gap-2">
                    {modoDraft === 'QTD_COMPRIMENTO' && (
                      <input
                        inputMode="numeric"
                        className="h-11 w-16"
                        value={draftMedicao.quantidade}
                        onChange={(e) => setDraftMedicao((d) => ({ ...d, quantidade: e.target.value }))}
                      />
                    )}
                    <input
                      inputMode="decimal"
                      placeholder="Comprimento (m)"
                      className="h-11 flex-1"
                      value={draftMedicao.comprimento}
                      onChange={(e) => {
                        const texto = e.target.value;
                        const r = parseComprimento(texto);
                        setDraftMedicao((d) => ({
                          ...d,
                          comprimento: texto,
                          sc: !d.scManual && r.valor != null ? classificarSC(r.valor) : d.sc,
                          erro: '',
                        }));
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
                        {CLASSIFICACOES_SC.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
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
          </select>
          <select className="h-11 w-28" value={draftTipo} onChange={(e) => setDraftTipo(e.target.value as TipoMaterial)}>
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
          : { novo: 'Lançar remetido', confirmar: 'Confirmar chegada e salvar', editar: 'Salvar alterações' }[props.modo]}
      </button>
    </div>
  );
}
