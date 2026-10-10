'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERFIS,
  CLASSIFICACOES_REEMPREGO,
  CLASSIFICACOES_SC,
  PLACA_REGEX,
  NF_REGEX,
  MSG_NF_INVALIDA,
  MARCAS,
  MARCA_LABEL,
  recebimentoCaminhaoSchema,
} from '@/lib/validation/recebimento';
import { validarReemprego, classificarSC, pecasDoGrupo } from '@/lib/domain/regras';
import {
  salvarRecebimentoLocal,
  salvarRascunhoRecebimento,
  lerRascunhoRecebimento,
  limparRascunhoRecebimento,
} from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';

type TipoMaterial = 'NOVO' | 'REEMPREGO' | 'SUCATA';
type ModoMedicao = 'INDIVIDUAL' | 'QTD_COMPRIMENTO';
type ClassificacaoSC = 'SC1' | 'SC2' | 'SC3';

interface MedicaoLocal {
  clientId: string;
  modo: ModoMedicao;
  quantidade: number;
  comprimento: number;
  classificacaoSC?: ClassificacaoSC;
}

type Marca = (typeof MARCAS)[number];

interface GrupoLocal {
  clientId: string;
  perfil: string;
  tipoMaterial: TipoMaterial;
  classificacao?: 'G1' | 'G2' | 'G3';
  marca?: Marca;
  fabricanteOutro?: string;
  medicoes: MedicaoLocal[];
}

interface Dados {
  data: string;
  numeroDocumento: string;
  origem: string;
  placaCavalo: string;
  placaCarreta: string;
  placaCarreta2: string;
  transportadora: string;
  responsavelPatio: string;
}

interface RascunhoWizard {
  clientId: string;
  step: number;
  dadosBrutos: Dados;
  dataTocada: boolean;
  grupos: GrupoLocal[];
  activeGrupoId: string | null;
}

function ehRascunhoValido(v: unknown): v is RascunhoWizard {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { grupos?: unknown }).grupos) &&
    typeof (v as { dadosBrutos?: unknown }).dadosBrutos === 'object'
  );
}

function novoUuid(): string {
  return crypto.randomUUID();
}

/** A data de hoje não muda sozinha enquanto a tela está aberta: nada a assinar. */
function semInscricao(): () => void {
  return () => {};
}

/**
 * Data de hoje no fuso do próprio tablet, em YYYY-MM-DD.
 *
 * Não usar `toISOString()`: ele converte para UTC, então num fuso negativo
 * (BRT = UTC-3/-4) toda captura feita à noite já sairia com a data do dia
 * seguinte — o recebimento seria registrado no dia errado.
 */
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

function metrosDaMedicao(m: MedicaoLocal): number {
  return Math.round(m.quantidade * m.comprimento * 100) / 100;
}

function metrosDoGrupo(g: GrupoLocal): number {
  return g.medicoes.reduce((acc, m) => acc + metrosDaMedicao(m), 0);
}

const MSG_PLACA_INVALIDA = 'Placa inválida. Ex.: ABC1D23 (Mercosul) ou CMG1234 (padrão antigo).';
const MSG_PELO_MENOS_UMA_PLACA =
  'Informe ao menos uma placa: a do cavalo ou a de uma das carretas.';

function validarDados(d: Dados) {
  const erros: Partial<Record<keyof Dados, string>> = {};
  if (!d.data) erros.data = 'Informe a data do recebimento.';
  if (!NF_REGEX.test(d.numeroDocumento)) erros.numeroDocumento = MSG_NF_INVALIDA;
  if (!d.origem.trim()) erros.origem = 'Informe a origem do material.';
  // Nenhuma placa é individualmente obrigatória — a regra é "pelo menos uma das três".
  if (!d.placaCavalo && !d.placaCarreta && !d.placaCarreta2) {
    erros.placaCavalo = MSG_PELO_MENOS_UMA_PLACA;
  } else {
    if (d.placaCavalo && !PLACA_REGEX.test(d.placaCavalo)) erros.placaCavalo = MSG_PLACA_INVALIDA;
    if (d.placaCarreta && !PLACA_REGEX.test(d.placaCarreta)) erros.placaCarreta = MSG_PLACA_INVALIDA;
    if (d.placaCarreta2 && !PLACA_REGEX.test(d.placaCarreta2)) erros.placaCarreta2 = MSG_PLACA_INVALIDA;
  }
  if (d.responsavelPatio.trim().length < 3) erros.responsavelPatio = 'Informe quem está preenchendo.';
  return erros;
}

export function RecebimentoWizard({ fatoresCadastrados }: { fatoresCadastrados: Partial<Record<string, number>> }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(novoUuid);
  // true até a leitura do rascunho no Dexie terminar — enquanto isso, o efeito
  // que GRAVA o rascunho fica pausado, para não sobrescrever um rascunho salvo
  // com o estado em branco do primeiro render.
  const [restaurando, setRestaurando] = useState(true);
  const [step, setStep] = useState(1);
  const [attemptStep1, setAttemptStep1] = useState(false);
  const [dataTocada, setDataTocada] = useState(false);
  // Data de hoje como valor exclusivamente do cliente: o snapshot de servidor é ''
  // e o do cliente é o dia no fuso do tablet. Calcular a data durante a renderização
  // faria servidor e cliente produzirem strings diferentes no MESMO input, e o React
  // descarta a árvore SSR inteira num mismatch de hidratação — apagando, junto, tudo
  // que o operador já tivesse digitado antes de a hidratação terminar.
  const hoje = useSyncExternalStore(semInscricao, dataDeHojeLocal, () => '');
  // `data` vazio na raiz significa "ainda não escolhida"; nesse caso o wizard exibe e
  // usa `hoje`. Depois que o operador mexe no campo, o valor dele manda — inclusive
  // se ele limpar o campo (a validação então cobra a data, como antes).
  const [dadosBrutos, setDados] = useState<Dados>({
    data: '',
    numeroDocumento: '',
    origem: '',
    placaCavalo: '',
    placaCarreta: '',
    placaCarreta2: '',
    transportadora: '',
    responsavelPatio: '',
  });
  const [mostrarCarreta2, setMostrarCarreta2] = useState(false);
  const [grupos, setGrupos] = useState<GrupoLocal[]>([]);
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    quantidade: '1',
    comprimento: '',
    sc: '' as ClassificacaoSC | '',
    scManual: false,
    erro: '',
  });
  const [modoDraft, setModoDraft] = useState<ModoMedicao>('INDIVIDUAL');
  const [enviando, setEnviando] = useState(false);
  const [erroFinal, setErroFinal] = useState('');

  useEffect(() => {
    let ativo = true;
    lerRascunhoRecebimento().then((registro) => {
      if (!ativo) return;
      if (registro && ehRascunhoValido(registro.rascunho)) {
        const r = registro.rascunho;
        setClientId(registro.clientId);
        setStep(r.step);
        setDados(r.dadosBrutos);
        setDataTocada(r.dataTocada);
        setGrupos(r.grupos);
        setActiveGrupoId(r.activeGrupoId);
      }
      setRestaurando(false);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restaurando) return;
    void salvarRascunhoRecebimento(clientId, {
      clientId,
      step,
      dadosBrutos,
      dataTocada,
      grupos,
      activeGrupoId,
    });
  }, [restaurando, clientId, step, dadosBrutos, dataTocada, grupos, activeGrupoId]);

  const dados = useMemo<Dados>(
    () => (dataTocada ? dadosBrutos : { ...dadosBrutos, data: dadosBrutos.data || hoje }),
    [dadosBrutos, dataTocada, hoje],
  );

  const errosDados = attemptStep1 ? validarDados(dados) : {};
  const grupoAtivo = grupos.find((g) => g.clientId === activeGrupoId) ?? null;

  const temSucataPendente = grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovoReemprego = useMemo(() => {
    return grupos
      .filter((g) => g.tipoMaterial !== 'SUCATA')
      .reduce((acc, g) => {
        const fator = fatoresCadastrados[g.perfil];
        if (fator == null) return acc;
        return acc + Math.round(metrosDoGrupo(g) * fator * 1000) / 1000;
      }, 0);
  }, [grupos, fatoresCadastrados]);
  const pesoSucataEstimado = useMemo(() => {
    return grupos
      .filter((g) => g.tipoMaterial === 'SUCATA')
      .reduce((acc, g) => {
        const fator = fatoresCadastrados[g.perfil];
        if (fator == null) return acc;
        return acc + Math.round(metrosDoGrupo(g) * fator * 1000) / 1000;
      }, 0);
  }, [grupos, fatoresCadastrados]);

  function irPara(n: number) {
    setStep(n);
  }

  function proximoDeDados() {
    setAttemptStep1(true);
    if (Object.keys(validarDados(dados)).length > 0) return;
    setStep(2);
  }

  function adicionarGrupo(perfil: string, tipoMaterial: TipoMaterial) {
    const g: GrupoLocal = { clientId: novoUuid(), perfil, tipoMaterial, medicoes: [] };
    setGrupos((prev) => [...prev, g]);
    setActiveGrupoId(g.clientId);
  }

  function atualizarGrupo(id: string, patch: Partial<GrupoLocal>) {
    setGrupos((prev) => prev.map((g) => (g.clientId === id ? { ...g, ...patch } : g)));
  }

  function removerGrupo(id: string) {
    setGrupos((prev) => prev.filter((g) => g.clientId !== id));
    if (activeGrupoId === id) setActiveGrupoId(null);
  }

  function abrirMedicoes(id: string) {
    setActiveGrupoId(id);
    setDraft({ quantidade: '1', comprimento: '', sc: '', scManual: false, erro: '' });
    setStep(3);
  }

  function adicionarMedicao() {
    if (!grupoAtivo) return;
    const r = parseComprimento(draft.comprimento);
    if (r.erro || r.valor == null) {
      setDraft((d) => ({ ...d, erro: r.erro ?? '' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'REEMPREGO' && !validarReemprego(r.valor)) {
      setDraft((d) => ({ ...d, erro: 'Medição de reemprego precisa ter ao menos 7 m.' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'SUCATA' && !draft.sc) {
      setDraft((d) => ({ ...d, erro: 'Selecione a classificação SC1, SC2 ou SC3.' }));
      return;
    }
    const quantidade = modoDraft === 'QTD_COMPRIMENTO' ? Math.max(1, Number(draft.quantidade) || 1) : 1;
    const medicao: MedicaoLocal = {
      clientId: novoUuid(),
      modo: modoDraft,
      quantidade,
      comprimento: r.valor,
      classificacaoSC: grupoAtivo.tipoMaterial === 'SUCATA' ? (draft.sc as ClassificacaoSC) : undefined,
    };
    atualizarGrupo(grupoAtivo.clientId, { medicoes: [...grupoAtivo.medicoes, medicao] });
    setDraft({ quantidade: '1', comprimento: '', sc: '', scManual: false, erro: '' });
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

  async function finalizar() {
    setErroFinal('');
    setEnviando(true);
    const payload = {
      clientId,
      dados: {
        ...dados,
        placaCavalo: dados.placaCavalo || undefined,
        placaCarreta: dados.placaCarreta || undefined,
        placaCarreta2: dados.placaCarreta2 || undefined,
        transportadora: dados.transportadora || undefined,
      },
      grupos: grupos.map((g) => ({
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
      })),
    };

    // Portão de validação local, ANTES de qualquer escrita no Dexie — roda mesmo
    // offline (é só Zod, sem rede). Sem isso, um payload malformado seria salvo,
    // navegado como se fosse sucesso, e só apareceria depois como ERRO não recuperável
    // (reenviar o mesmo payload inválido para /api/sync falharia do mesmo jeito).
    const parsed = recebimentoCaminhaoSchema.safeParse(payload);
    if (!parsed.success) {
      setEnviando(false);
      setErroFinal('Dados inválidos. Revise os campos e tente novamente.');
      return;
    }

    try {
      // Gravação local (IndexedDB via Dexie) — sempre sucede, mesmo offline. É o
      // único caminho de escrita: não há mais uma Server Action síncrona separada.
      await salvarRecebimentoLocal(parsed.data);
    } catch {
      setEnviando(false);
      setErroFinal('Não foi possível salvar o recebimento neste dispositivo. Tente novamente.');
      return;
    }

    // Rascunho cumpriu seu papel — o recebimento já está na tabela definitiva
    // (`recebimentos`). Limpar agora evita que o PRÓXIMO caminhão abra o wizard
    // e encontre, por engano, os dados do caminhão que acabou de ser salvo.
    // Best-effort: o recebimento já foi salvo com sucesso acima — uma falha ao
    // limpar o rascunho não pode impedir a navegação para a confirmação.
    try {
      await limparRascunhoRecebimento();
    } catch {
      // Ignorado de propósito — o recebimento já está salvo localmente. Uma falha
      // ao limpar o rascunho (e.g., Dexie error) é apenas um problema cosmético.
    }

    // Tentativa de sincronização best-effort: não bloqueia a navegação esperando a
    // rede. Se falhar (ou estiver offline), o registro já está salvo localmente e a
    // página de confirmação mostra o status; uma nova tentativa acontece depois
    // (retry manual na página, ou o indicador de sincronização de vida longa da Task 7).
    void sincronizarPendentes().catch(() => {});

    setEnviando(false);
    router.push(`/patio/recebimentos/${parsed.data.clientId}/confirmado`);
  }

  return (
    <main className="mx-auto max-w-xl lg:max-w-3xl p-6">
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Novo recebimento — Caminhão</h1>
      <p className="mb-6 text-sm text-ink-muted">Etapa {step} de 4</p>

      {step === 1 && (
        <section className="space-y-4">
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
            <label htmlFor="f-nf">Nota fiscal *</label>
            <input
              id="f-nf"
              inputMode="numeric"
              placeholder="Ex.: 123456 ou 087781-1"
              className="h-11"
              value={dados.numeroDocumento}
              onChange={(e) => setDados({ ...dados, numeroDocumento: e.target.value.replace(/[^\d-]/g, '').slice(0, 14) })}
            />
            {errosDados.numeroDocumento && <p className="text-sm text-bad">{errosDados.numeroDocumento}</p>}
          </div>
          <div className="field">
            <label htmlFor="f-origem">Origem *</label>
            <input id="f-origem" className="h-11" value={dados.origem} onChange={(e) => setDados({ ...dados, origem: e.target.value })} />
            {errosDados.origem && <p className="text-sm text-bad">{errosDados.origem}</p>}
          </div>
          <p className="text-sm text-ink-dim">Transporte: Caminhão (único suportado nesta etapa)</p>

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
            <label htmlFor="f-transportadora">Transportadora (opcional)</label>
            <input
              id="f-transportadora"
              className="h-11"
              placeholder="Nome da empresa transportadora, não o veículo"
              value={dados.transportadora}
              onChange={(e) => setDados({ ...dados, transportadora: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="f-resp">Responsável pelo preenchimento *</label>
            <input id="f-resp" className="h-11" value={dados.responsavelPatio} onChange={(e) => setDados({ ...dados, responsavelPatio: e.target.value })} />
            {errosDados.responsavelPatio && <p className="text-sm text-bad">{errosDados.responsavelPatio}</p>}
          </div>
          <button className="btn btn-primary btn-lg h-12" onClick={proximoDeDados}>
            Próximo
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="card-title !mb-0">Grupos</h2>
          {grupos.map((g, i) => (
            <div key={g.clientId} className="grupo-card !mb-0 p-3">
              <div className="flex items-center justify-between">
                <span className="grupo-title">
                  Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                </span>
                <button className="text-sm text-bad" onClick={() => removerGrupo(g.clientId)}>
                  Excluir
                </button>
              </div>
              {g.tipoMaterial === 'REEMPREGO' && (
                <div className="field mt-2">
                  <label>Classificação</label>
                  <select
                    aria-label={`Classificação do Grupo ${grupos.indexOf(g) + 1}`}
                    className="h-10"
                    value={g.classificacao ?? ''}
                    onChange={(e) => atualizarGrupo(g.clientId, { classificacao: e.target.value as 'G1' | 'G2' | 'G3' })}
                  >
                    <option value="" disabled>
                      Escolha
                    </option>
                    {CLASSIFICACOES_REEMPREGO.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              {g.tipoMaterial === 'NOVO' && (
                <div className="mt-2 space-y-2">
                  <div className="field">
                    <label>Marca *</label>
                    <select
                      aria-label={`Marca do Grupo ${grupos.indexOf(g) + 1}`}
                      className="h-10"
                      value={g.marca ?? ''}
                      onChange={(e) => {
                        const marca = (e.target.value || undefined) as Marca | undefined;
                        atualizarGrupo(g.clientId, {
                          marca,
                          fabricanteOutro: marca === 'OUTROS' ? g.fabricanteOutro : undefined,
                        });
                      }}
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {MARCAS.map((m) => (
                        <option key={m} value={m}>
                          {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {g.marca === 'OUTROS' && (
                    <div className="field">
                      <label>Qual fabricante?</label>
                      <input
                        aria-label={`Fabricante (outros) do Grupo ${grupos.indexOf(g) + 1}`}
                        className="h-10"
                        value={g.fabricanteOutro ?? ''}
                        onChange={(e) => atualizarGrupo(g.clientId, { fabricanteOutro: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm text-ink-muted">
                {g.medicoes.length === 0
                  ? 'Nenhuma medição adicionada'
                  : `${pecasDoGrupo(g.medicoes)} ${pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · ${metrosDoGrupo(g).toFixed(2).replace('.', ',')} m`}
              </p>
              <button className="btn btn-secondary btn-sm mt-2" onClick={() => abrirMedicoes(g.clientId)}>
                {g.medicoes.length ? 'Medir' : 'Lançar medidas'}
              </button>
            </div>
          ))}

          <div className="card">
            <p className="card-title !mb-2">Adicionar grupo</p>
            <NovoGrupoForm onAdd={adicionarGrupo} />
          </div>

          <div className="flex gap-3">
            <button className="btn btn-secondary h-12 flex-1" onClick={() => irPara(1)}>
              Voltar
            </button>
            <button className="btn btn-primary h-12 flex-1" disabled={grupos.length === 0} onClick={() => irPara(4)}>
              Ver resumo
            </button>
          </div>
        </section>
      )}

      {step === 3 && grupoAtivo && (
        <section className="space-y-4">
          <button className="back-link" onClick={() => irPara(2)}>
            ← Voltar aos grupos
          </button>
          <h2 className="card-title !mb-0">
            {grupoAtivo.perfil} — {grupoAtivo.tipoMaterial}
          </h2>

          <div className="flex gap-2">
            <button className={`btn h-10 flex-1 ${modoDraft === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModoDraft('INDIVIDUAL')}>
              Individual
            </button>
            <button
              className={`btn h-10 flex-1 ${modoDraft === 'QTD_COMPRIMENTO' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setModoDraft('QTD_COMPRIMENTO')}
            >
              Quantidade × comprimento
            </button>
          </div>

          <div className="flex gap-2">
            {modoDraft === 'QTD_COMPRIMENTO' && (
              <input
                aria-label="Quantidade"
                className="h-11 w-20"
                inputMode="numeric"
                value={draft.quantidade}
                onChange={(e) => setDraft({ ...draft, quantidade: e.target.value })}
              />
            )}
            <input
              aria-label="Comprimento"
              className="h-11 flex-1"
              placeholder="Comprimento (m), ex.: 8,10"
              inputMode="decimal"
              value={draft.comprimento}
              onChange={(e) => {
                const texto = e.target.value;
                // Sugere a classificação SC pelo comprimento (Bloco 2.1) — só enquanto o
                // Pátio não tiver trocado manualmente o select para este lançamento.
                const r = parseComprimento(texto);
                const sugestao = !draft.scManual && r.valor != null ? classificarSC(r.valor) : draft.sc;
                setDraft({ ...draft, comprimento: texto, sc: sugestao, erro: '' });
              }}
            />
            {grupoAtivo.tipoMaterial === 'SUCATA' && (
              <select
                aria-label="Classificação SC"
                className="h-11 w-24"
                value={draft.sc}
                onChange={(e) => setDraft({ ...draft, sc: e.target.value as ClassificacaoSC, scManual: true })}
              >
                <option value="">SC?</option>
                {CLASSIFICACOES_SC.map((sc) => (
                  <option key={sc}>{sc}</option>
                ))}
              </select>
            )}
            <button className="btn btn-primary h-11" onClick={adicionarMedicao}>
              Adicionar
            </button>
          </div>
          {draft.erro && <p className="text-sm text-bad">{draft.erro}</p>}

          <div className="grupo-card !mb-0">
            {grupoAtivo.medicoes.map((m, i) => (
              <div key={m.clientId} className="medicao-row px-3">
                <span>
                  {i + 1}. {m.quantidade > 1 ? `${m.quantidade} × ${m.comprimento.toFixed(2)} m` : `${m.comprimento.toFixed(2)} m`}
                  {m.classificacaoSC ? ` — ${m.classificacaoSC}` : ''}
                </span>
                <button className="text-bad" onClick={() => removerMedicao(grupoAtivo.clientId, m.clientId)}>
                  Remover
                </button>
              </div>
            ))}
            {grupoAtivo.medicoes.length === 0 && <p className="px-3 py-4 text-sm text-ink-dim">Nenhuma medida ainda.</p>}
          </div>

          <p className="text-right font-medium text-ink">Total do grupo: {metrosDoGrupo(grupoAtivo).toFixed(2)} m</p>
          <button className="btn btn-primary btn-lg h-12" onClick={() => irPara(2)}>
            Voltar aos grupos
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h2 className="card-title !mb-0">Resumo</h2>
          <div className="card text-sm">
            <p>Data: {dados.data}</p>
            <p>NF: {dados.numeroDocumento}</p>
            <p>Origem: {dados.origem}</p>
            <p>
              Carreta(s): {[dados.placaCarreta, dados.placaCarreta2].filter(Boolean).join(' / ') || '—'}
            </p>
            <p>Cavalo: {dados.placaCavalo || '—'}</p>
            {dados.transportadora && <p>Transportadora: {dados.transportadora}</p>}
            <p>Responsável: {dados.responsavelPatio}</p>
          </div>

          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Tipo</th>
                  <th className="text-right">Metros</th>
                  <th className="text-right">Peso</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g, i) => {
                  const fator = fatoresCadastrados[g.perfil];
                  const metros = metrosDoGrupo(g);
                  const peso = fator != null ? Math.round(metros * fator * 1000) / 1000 : null;
                  return (
                    <tr key={g.clientId}>
                      <td>
                        Grupo {i + 1} ({g.perfil})
                      </td>
                      <td>{g.tipoMaterial}</td>
                      <td className="text-right font-mono">{metros.toFixed(2)} m</td>
                      <td className="text-right font-mono">
                        {peso == null ? (
                          'Fator não cadastrado'
                        ) : g.tipoMaterial === 'SUCATA' ? (
                          <>
                            {peso.toFixed(3)} t <span className="text-xs text-warn">(estimado)</span>
                          </>
                        ) : (
                          `${peso.toFixed(3)} t`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="resumo-bar !justify-end text-right">
            <div>
              <p className="stat-label">{temSucataPendente ? 'Peso até agora' : 'Peso total'}</p>
              <p className="stat-value">{pesoNovoReemprego.toFixed(3)} t</p>
              {temSucataPendente && (
                <p className="mt-1 text-sm text-warn">
                  SUCATA: {pesoSucataEstimado.toFixed(3)} t (estimado, a confirmar)
                </p>
              )}
            </div>
          </div>

          {erroFinal && <p className="text-sm text-bad">{erroFinal}</p>}

          <div className="flex gap-3">
            <button className="btn btn-secondary h-12 flex-1" onClick={() => irPara(2)}>
              Voltar
            </button>
            <button
              className="btn btn-primary h-12 flex-1"
              disabled={enviando || grupos.length === 0 || grupos.some(grupoIncompleto)}
              onClick={finalizar}
            >
              {enviando ? 'Salvando...' : 'Finalizar e salvar'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function NovoGrupoForm({ onAdd }: { onAdd: (perfil: string, tipoMaterial: TipoMaterial) => void }) {
  const [perfil, setPerfil] = useState('');
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterial>('NOVO');

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="field">
        <label>Perfil</label>
        <select aria-label="Perfil do novo grupo" className="h-10" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
          <option value="" disabled>
            Escolha
          </option>
          {PERFIS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Tipo de material</label>
        <select
          aria-label="Tipo de material do novo grupo"
          className="h-10"
          value={tipoMaterial}
          onChange={(e) => setTipoMaterial(e.target.value as TipoMaterial)}
        >
          <option value="NOVO">NOVO</option>
          <option value="REEMPREGO">REEMPREGO</option>
          <option value="SUCATA">SUCATA</option>
        </select>
      </div>
      <button
        className="btn btn-primary h-10"
        disabled={!perfil}
        onClick={() => {
          if (!perfil) return;
          onAdd(perfil, tipoMaterial);
          setPerfil('');
        }}
      >
        Adicionar grupo
      </button>
    </div>
  );
}
