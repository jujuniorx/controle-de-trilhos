'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERFIS,
  CLASSIFICACOES_REEMPREGO,
  CLASSIFICACOES_SC,
  PLACA_REGEX,
  MARCAS,
  MARCA_LABEL,
  recebimentoCaminhaoSchema,
} from '@/lib/validation/recebimento';
import { validarReemprego } from '@/lib/domain/regras';
import { salvarRecebimentoLocal } from '@/lib/offline/db';
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
  transportadora: string;
  responsavelPatio: string;
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

function validarDados(d: Dados) {
  const erros: Partial<Record<keyof Dados, string>> = {};
  if (!d.data) erros.data = 'Informe a data do recebimento.';
  if (!/^\d{1,9}$/.test(d.numeroDocumento)) erros.numeroDocumento = 'Informe a nota fiscal, somente números.';
  if (!d.origem.trim()) erros.origem = 'Informe a origem do material.';
  // Placa do cavalo é o mínimo aceitável; a da carreta só é validada se preenchida (opcional).
  if (!PLACA_REGEX.test(d.placaCavalo)) erros.placaCavalo = 'Placa inválida. Ex.: ABC1D23';
  if (d.placaCarreta && !PLACA_REGEX.test(d.placaCarreta)) erros.placaCarreta = 'Placa inválida. Ex.: ABC1D23';
  if (d.responsavelPatio.trim().length < 3) erros.responsavelPatio = 'Informe quem está preenchendo.';
  return erros;
}

export function RecebimentoWizard({ fatoresCadastrados }: { fatoresCadastrados: Partial<Record<string, number>> }) {
  const router = useRouter();
  const [clientId] = useState(novoUuid);
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
    transportadora: '',
    responsavelPatio: '',
  });
  const [grupos, setGrupos] = useState<GrupoLocal[]>([]);
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ quantidade: '1', comprimento: '', sc: '' as ClassificacaoSC | '', erro: '' });
  const [modoDraft, setModoDraft] = useState<ModoMedicao>('INDIVIDUAL');
  const [enviando, setEnviando] = useState(false);
  const [erroFinal, setErroFinal] = useState('');

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
    setDraft({ quantidade: '1', comprimento: '', sc: '', erro: '' });
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
    setDraft({ quantidade: '1', comprimento: '', sc: '', erro: '' });
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
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());

  async function finalizar() {
    setErroFinal('');
    setEnviando(true);
    const payload = {
      clientId,
      dados: {
        ...dados,
        placaCarreta: dados.placaCarreta || undefined,
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

    // Tentativa de sincronização best-effort: não bloqueia a navegação esperando a
    // rede. Se falhar (ou estiver offline), o registro já está salvo localmente e a
    // página de confirmação mostra o status; uma nova tentativa acontece depois
    // (retry manual na página, ou o indicador de sincronização de vida longa da Task 7).
    void sincronizarPendentes().catch(() => {});

    setEnviando(false);
    router.push(`/patio/recebimentos/${parsed.data.clientId}/confirmado`);
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Novo recebimento — Caminhão</h1>
      <p className="mb-6 text-sm text-neutral-600">Etapa {step} de 4</p>

      {step === 1 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="f-data">Data</label>
            <input
              id="f-data"
              type="date"
              className="mt-1 h-11 w-full rounded border px-3"
              value={dados.data}
              onChange={(e) => {
                setDataTocada(true);
                setDados({ ...dados, data: e.target.value });
              }}
            />
            {errosDados.data && <p className="text-sm text-red-600">{errosDados.data}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-nf">Nota fiscal</label>
            <input
              id="f-nf"
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded border px-3"
              value={dados.numeroDocumento}
              onChange={(e) => setDados({ ...dados, numeroDocumento: e.target.value.replace(/\D/g, '').slice(0, 9) })}
            />
            {errosDados.numeroDocumento && <p className="text-sm text-red-600">{errosDados.numeroDocumento}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-origem">Origem</label>
            <input
              id="f-origem"
              className="mt-1 h-11 w-full rounded border px-3"
              value={dados.origem}
              onChange={(e) => setDados({ ...dados, origem: e.target.value })}
            />
            {errosDados.origem && <p className="text-sm text-red-600">{errosDados.origem}</p>}
          </div>
          <p className="text-sm text-neutral-500">Transporte: Caminhão (único suportado nesta etapa)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium" htmlFor="f-cavalo">Placa do cavalo</label>
              <input
                id="f-cavalo"
                maxLength={7}
                className="mt-1 h-11 w-full rounded border px-3 uppercase"
                value={dados.placaCavalo}
                onChange={(e) => setDados({ ...dados, placaCavalo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
              />
              {errosDados.placaCavalo && <p className="text-sm text-red-600">{errosDados.placaCavalo}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="f-carreta">Placa da carreta (opcional)</label>
              <input
                id="f-carreta"
                maxLength={7}
                className="mt-1 h-11 w-full rounded border px-3 uppercase"
                value={dados.placaCarreta}
                onChange={(e) => setDados({ ...dados, placaCarreta: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
              />
              {errosDados.placaCarreta && <p className="text-sm text-red-600">{errosDados.placaCarreta}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-transportadora">Transportadora (opcional)</label>
            <input
              id="f-transportadora"
              className="mt-1 h-11 w-full rounded border px-3"
              placeholder="Nome da empresa transportadora, não o veículo"
              value={dados.transportadora}
              onChange={(e) => setDados({ ...dados, transportadora: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-resp">Responsável pelo preenchimento</label>
            <input
              id="f-resp"
              className="mt-1 h-11 w-full rounded border px-3"
              value={dados.responsavelPatio}
              onChange={(e) => setDados({ ...dados, responsavelPatio: e.target.value })}
            />
            {errosDados.responsavelPatio && <p className="text-sm text-red-600">{errosDados.responsavelPatio}</p>}
          </div>
          <button className="h-12 w-full rounded bg-neutral-900 font-medium text-white" onClick={proximoDeDados}>
            Próximo
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="font-medium">Grupos</h2>
          {grupos.map((g, i) => (
            <div key={g.clientId} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <b>
                  Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                </b>
                <button className="text-red-600" onClick={() => removerGrupo(g.clientId)}>
                  Excluir
                </button>
              </div>
              {g.tipoMaterial === 'REEMPREGO' && (
                <div className="mt-2">
                  <label className="block text-sm">Classificação</label>
                  <select
                    aria-label={`Classificação do Grupo ${grupos.indexOf(g) + 1}`}
                    className="mt-1 h-10 rounded border px-2"
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
                  <div>
                    <label className="block text-sm">Marca (opcional)</label>
                    <select
                      aria-label={`Marca do Grupo ${grupos.indexOf(g) + 1}`}
                      className="mt-1 h-10 w-full rounded border px-2"
                      value={g.marca ?? ''}
                      onChange={(e) => {
                        const marca = (e.target.value || undefined) as Marca | undefined;
                        atualizarGrupo(g.clientId, {
                          marca,
                          fabricanteOutro: marca === 'OUTROS' ? g.fabricanteOutro : undefined,
                        });
                      }}
                    >
                      <option value="">Não informado</option>
                      {MARCAS.map((m) => (
                        <option key={m} value={m}>
                          {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {g.marca === 'OUTROS' && (
                    <div>
                      <label className="block text-sm">Qual fabricante?</label>
                      <input
                        aria-label={`Fabricante (outros) do Grupo ${grupos.indexOf(g) + 1}`}
                        className="mt-1 h-10 w-full rounded border px-2"
                        value={g.fabricanteOutro ?? ''}
                        onChange={(e) => atualizarGrupo(g.clientId, { fabricanteOutro: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm text-neutral-600">
                {g.medicoes.length} medição(ões) — {metrosDoGrupo(g).toFixed(2)} m
              </p>
              <button className="mt-2 h-10 rounded border px-3" onClick={() => abrirMedicoes(g.clientId)}>
                {g.medicoes.length ? 'Medir' : 'Lançar medidas'}
              </button>
            </div>
          ))}

          <div className="rounded border p-3">
            <p className="mb-2 text-sm font-medium">Adicionar grupo</p>
            <NovoGrupoForm onAdd={adicionarGrupo} />
          </div>

          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded border" onClick={() => irPara(1)}>
              Voltar
            </button>
            <button
              className="h-12 flex-1 rounded bg-neutral-900 font-medium text-white disabled:bg-neutral-300"
              disabled={grupos.length === 0}
              onClick={() => irPara(4)}
            >
              Ver resumo
            </button>
          </div>
        </section>
      )}

      {step === 3 && grupoAtivo && (
        <section className="space-y-4">
          <button className="text-sm text-neutral-600" onClick={() => irPara(2)}>
            ← Voltar aos grupos
          </button>
          <h2 className="font-medium">
            {grupoAtivo.perfil} — {grupoAtivo.tipoMaterial}
          </h2>

          <div className="flex gap-2">
            <button
              className={`h-10 flex-1 rounded border ${modoDraft === 'INDIVIDUAL' ? 'bg-neutral-900 text-white' : ''}`}
              onClick={() => setModoDraft('INDIVIDUAL')}
            >
              Individual
            </button>
            <button
              className={`h-10 flex-1 rounded border ${modoDraft === 'QTD_COMPRIMENTO' ? 'bg-neutral-900 text-white' : ''}`}
              onClick={() => setModoDraft('QTD_COMPRIMENTO')}
            >
              Quantidade × comprimento
            </button>
          </div>

          <div className="flex gap-2">
            {modoDraft === 'QTD_COMPRIMENTO' && (
              <input
                aria-label="Quantidade"
                className="h-11 w-20 rounded border px-2"
                inputMode="numeric"
                value={draft.quantidade}
                onChange={(e) => setDraft({ ...draft, quantidade: e.target.value })}
              />
            )}
            <input
              aria-label="Comprimento"
              className="h-11 flex-1 rounded border px-3"
              placeholder="Comprimento (m), ex.: 8,10"
              inputMode="decimal"
              value={draft.comprimento}
              onChange={(e) => setDraft({ ...draft, comprimento: e.target.value, erro: '' })}
            />
            {grupoAtivo.tipoMaterial === 'SUCATA' && (
              <select
                aria-label="Classificação SC"
                className="h-11 rounded border px-2"
                value={draft.sc}
                onChange={(e) => setDraft({ ...draft, sc: e.target.value as ClassificacaoSC })}
              >
                <option value="">SC?</option>
                {CLASSIFICACOES_SC.map((sc) => (
                  <option key={sc}>{sc}</option>
                ))}
              </select>
            )}
            <button className="h-11 rounded bg-neutral-900 px-4 text-white" onClick={adicionarMedicao}>
              Adicionar
            </button>
          </div>
          {draft.erro && <p className="text-sm text-red-600">{draft.erro}</p>}

          <ol className="divide-y rounded border">
            {grupoAtivo.medicoes.map((m, i) => (
              <li key={m.clientId} className="flex items-center justify-between px-3 py-2">
                <span>
                  {i + 1}. {m.quantidade > 1 ? `${m.quantidade} × ${m.comprimento.toFixed(2)} m` : `${m.comprimento.toFixed(2)} m`}
                  {m.classificacaoSC ? ` — ${m.classificacaoSC}` : ''}
                </span>
                <button className="text-red-600" onClick={() => removerMedicao(grupoAtivo.clientId, m.clientId)}>
                  Remover
                </button>
              </li>
            ))}
            {grupoAtivo.medicoes.length === 0 && <li className="px-3 py-4 text-sm text-neutral-500">Nenhuma medida ainda.</li>}
          </ol>

          <p className="text-right font-medium">Total do grupo: {metrosDoGrupo(grupoAtivo).toFixed(2)} m</p>
          <button className="h-12 w-full rounded bg-neutral-900 font-medium text-white" onClick={() => irPara(2)}>
            Voltar aos grupos
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h2 className="font-medium">Resumo</h2>
          <div className="rounded border p-3 text-sm">
            <p>Data: {dados.data}</p>
            <p>NF: {dados.numeroDocumento}</p>
            <p>Origem: {dados.origem}</p>
            <p>
              Placas: {dados.placaCavalo} / {dados.placaCarreta || '—'}
            </p>
            {dados.transportadora && <p>Transportadora: {dados.transportadora}</p>}
            <p>Responsável: {dados.responsavelPatio}</p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
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
                const peso = g.tipoMaterial === 'SUCATA' ? null : fator != null ? Math.round(metros * fator * 1000) / 1000 : null;
                return (
                  <tr key={g.clientId} className="border-t">
                    <td>
                      Grupo {i + 1} ({g.perfil})
                    </td>
                    <td>{g.tipoMaterial}</td>
                    <td className="text-right">{metros.toFixed(2)} m</td>
                    <td className="text-right">
                      {g.tipoMaterial === 'SUCATA'
                        ? 'PENDENTE'
                        : peso != null
                          ? `${peso.toFixed(3)} t`
                          : 'Fator não cadastrado'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="rounded bg-neutral-100 p-3 text-right">
            <p className="text-sm text-neutral-600">{temSucataPendente ? 'Peso até agora' : 'Peso total'}</p>
            <p className="text-xl font-semibold">{pesoNovoReemprego.toFixed(3)} t</p>
            {temSucataPendente && <p className="text-sm text-amber-700">SUCATA: PENDENTE</p>}
          </div>

          {erroFinal && <p className="text-sm text-red-600">{erroFinal}</p>}

          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded border" onClick={() => irPara(2)}>
              Voltar
            </button>
            <button
              className="h-12 flex-1 rounded bg-neutral-900 font-medium text-white disabled:bg-neutral-300"
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
      <div>
        <label className="block text-sm">Perfil</label>
        <select
          aria-label="Perfil do novo grupo"
          className="h-10 rounded border px-2"
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
        >
          <option value="" disabled>
            Escolha
          </option>
          {PERFIS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm">Tipo de material</label>
        <select
          aria-label="Tipo de material do novo grupo"
          className="h-10 rounded border px-2"
          value={tipoMaterial}
          onChange={(e) => setTipoMaterial(e.target.value as TipoMaterial)}
        >
          <option value="NOVO">NOVO</option>
          <option value="REEMPREGO">REEMPREGO</option>
          <option value="SUCATA">SUCATA</option>
        </select>
      </div>
      <button
        className="h-10 rounded bg-neutral-900 px-4 text-white disabled:bg-neutral-300"
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
