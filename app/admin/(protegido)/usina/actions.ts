'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { salvarEstaleiroDia, estaleiroDiasDaSemana, composicoesDaSemana, caminhoesDaSemana, geracaoDaSemana, salvarGeracaoDia, salvarEstoqueTls, salvarManutencaoSemana, salvarEscalaSemana, TIPOS_TLS, type TipoTlsValor } from '@/lib/services/usina';
import { ITENS_ESCALA, escalaVazia, gravarEscala, statusValido, cfgDeObjeto } from '@/lib/usina/escala';
import { salvarComposicao, salvarCaminhao, salvarGiro, trilheirosDaSemana, salvarTrilheiroDia, salvarManutencaoTrilheiro, apagarGiroTrilheiro, apagarManutencaoTrilheiro, zerarTrilheiro, LIDERES, COMPOSICOES, CAMINHOES_ATIVOS, TRILHEIROS, type LiderValor, type CarretaGeracaoValor } from '@/lib/services/usina';
import { PERFIS } from '@/lib/validation/recebimento';
import { ehIsoValido } from '@/lib/usina/periodo';
import { salvarObservacaoSetor } from '@/lib/services/observacaoSetor';
import { somarDias } from '@/lib/usina/diasUteis';

export interface ResultadoUsina {
  ok: boolean;
  erro?: string;
}

/** Número inteiro não negativo, ou null quando o campo ficou em branco. */
function inteiro(v: FormDataEntryValue | null): number | null | 'invalido' {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  if (!/^\d{1,6}$/.test(s)) return 'invalido';
  return Number(s);
}

/** Observação do dia por setor (segunda a domingo), enviada junto com o formulário do próprio setor. */
async function salvarObservacoesDoSetor(formData: FormData, semana: string, setor: string) {
  for (let i = 0; i < 7; i++) {
    const d = somarDias(semana, i);
    await salvarObservacaoSetor(d, setor, texto(formData.get(`obsdia_${setor}_${d}`), 500));
  }
}

function dataDoForm(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '');
  return ehIsoValido(s) ? s : null;
}

function atualizar() {
  revalidatePath('/admin/usina');
}

export async function salvarEstaleiroAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  if (!data) return { ok: false, erro: 'Data inválida.' };
  const soldas = inteiro(formData.get('soldas'));
  const cortes = inteiro(formData.get('cortes'));
  if (soldas === 'invalido' || cortes === 'invalido') return { ok: false, erro: 'Use só números inteiros em soldas e cortes.' };
  await salvarEstaleiroDia(data, soldas, cortes);
  atualizar();
  return { ok: true };
}

export async function salvarEstoqueTlsAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  if (!data) return { ok: false, erro: 'Data inválida.' };
  const valores: Partial<Record<TipoTlsValor, number | null>> = {};
  for (const tipo of TIPOS_TLS) {
    const q = inteiro(formData.get(`tls_${tipo}`));
    if (q === 'invalido') return { ok: false, erro: 'Use só números inteiros no estoque de TLS.' };
    valores[tipo] = q;
  }
  await salvarEstoqueTls(data, valores);
  atualizar();
  return { ok: true };
}

export async function salvarManutencaoAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  const dia = dataDoForm(formData.get('diaManutencao'));
  if (!semana || !dia) return { ok: false, erro: 'Informe a semana e o dia da manutenção.' };
  await salvarManutencaoSemana(semana, dia);
  atualizar();
  return { ok: true };
}

export async function salvarEscalaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  const valor = escalaVazia();
  // Plantao so existe no sabado (indice 5) e no domingo (indice 6).
  for (let i = 5; i < 7; i++) {
    valor.plantao[i] = String(formData.get(`plantao_${i}`) ?? '').trim().slice(0, 40);
  }
  for (const item of ITENS_ESCALA) {
    for (let i = 0; i < 7; i++) {
      const status = String(formData.get(`st_${item.id}_${i}`) ?? '-');
      valor.linhas[item.id][i] = {
        status: statusValido(status) ? status : '-',
        local: String(formData.get(`lc_${item.id}_${i}`) ?? '').trim().slice(0, 40),
      };
    }
  }
  let bruto: Record<string, unknown> = {};
  try {
    bruto = JSON.parse(String(formData.get('config_json') ?? '{}')) as Record<string, unknown>;
  } catch {
    bruto = {};
  }
  for (const item of ITENS_ESCALA) {
    valor.config[item.id] = cfgDeObjeto(bruto[item.id]);
  }
  await salvarEscalaSemana(semana, gravarEscala(valor));
  return { ok: true };
}

// ─── Demais setores ──────────────────────────────────────────────────────────

/** Número com vírgula ou ponto (ex.: 15,5), ou null quando em branco. */
function decimal(v: FormDataEntryValue | null): number | null | 'invalido' {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalido';
}

function texto(v: FormDataEntryValue | null, max = 300): string | null {
  const s = String(v ?? '').trim().slice(0, max);
  return s === '' ? null : s;
}

const erroNumero = { ok: false, erro: 'Use só números (use vírgula nos decimais).' };

export async function salvarComposicaoAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  const ativo = String(formData.get('ativo') ?? '') as (typeof COMPOSICOES)[number];
  if (!data) return { ok: false, erro: 'Data inválida.' };
  if (!COMPOSICOES.includes(ativo)) return { ok: false, erro: 'Composição inválida.' };
  const barras = inteiro(formData.get('barras'));
  const jacares = inteiro(formData.get('jacares'));
  if (barras === 'invalido' || jacares === 'invalido') return { ok: false, erro: 'Use só números inteiros.' };
  await salvarComposicao(data, ativo, barras, jacares, texto(formData.get('observacao')));
  revalidatePath('/admin/informativo');
  atualizar();
  return { ok: true };
}

export async function salvarCaminhaoAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  const caminhao = String(formData.get('caminhao') ?? '') as (typeof CAMINHOES_ATIVOS)[number];
  if (!data) return { ok: false, erro: 'Data inválida.' };
  if (!CAMINHOES_ATIVOS.includes(caminhao)) return { ok: false, erro: 'Caminhão inválido (CW03 ainda não está ativo).' };
  const producaoDiaria = inteiro(formData.get('producaoDiaria'));
  const perdaDiaria = inteiro(formData.get('perdaDiaria'));
  if (producaoDiaria === 'invalido' || perdaDiaria === 'invalido') return { ok: false, erro: 'Use só números inteiros.' };
  await salvarCaminhao(data, caminhao, {
    local: texto(formData.get('local'), 120),
    producaoDiaria,
    inicioMacro1: texto(formData.get('inicioMacro1'), 20),
    terminoMacro9: texto(formData.get('terminoMacro9'), 20),
    perdaDiaria,
  });
  atualizar();
  return { ok: true };
}

export async function salvarGiroAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const trilheiro = String(formData.get('trilheiro') ?? '') as (typeof TRILHEIROS)[number];
  if (!TRILHEIROS.includes(trilheiro)) return { ok: false, erro: 'Trilheiro inválido.' };
  const datas = ['boEm', 'chegadaUsinaEm', 'partidaEm', 'retornoEm'] as const;
  const valores: Record<string, string | null> = {};
  for (const d of datas) {
    const raw = String(formData.get(d) ?? '');
    if (raw === '') valores[d] = null;
    else if (ehIsoValido(raw)) valores[d] = raw;
    else return { ok: false, erro: 'Data inválida.' };
  }
  const carregados = inteiro(formData.get('carregados'));
  const descarregados = inteiro(formData.get('descarregados'));
  if (carregados === 'invalido' || descarregados === 'invalido') return { ok: false, erro: 'Use só números inteiros em TLS.' };
  // Vários perfis: vários campos "perfis" no formulário.
  const perfis = formData.getAll('perfis').map(String).filter((p): p is TipoTlsValor => TIPOS_TLS.includes(p as TipoTlsValor));
  await salvarGiro({
    trilheiro,
    boEm: valores.boEm,
    chegadaUsinaEm: valores.chegadaUsinaEm,
    partidaEm: valores.partidaEm,
    retornoEm: valores.retornoEm,
    perfis,
    carregados: carregados ?? 0,
    descarregados: descarregados ?? 0,
    local: texto(formData.get('local'), 120),
    observacao: texto(formData.get('observacao')),
  });
  atualizar();
  return { ok: true };
}

export async function salvarManutencaoTrilheiroAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  const trilheiro = String(formData.get('trilheiro') ?? '') as (typeof TRILHEIROS)[number];
  if (!data) return { ok: false, erro: 'Data inválida.' };
  if (!TRILHEIROS.includes(trilheiro)) return { ok: false, erro: 'Trilheiro inválido.' };
  await salvarManutencaoTrilheiro({
    data,
    trilheiro,
    local: texto(formData.get('local'), 120),
    tipo: texto(formData.get('tipo'), 80),
    detalhamento: texto(formData.get('detalhamento'), 2000),
  });
  atualizar();
  return { ok: true };
}

export async function apagarGiroAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id) await apagarGiroTrilheiro(id);
  atualizar();
}

export async function apagarManutencaoTrilheiroAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id) await apagarManutencaoTrilheiro(id);
  atualizar();
}

export async function zerarTrilheiroAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const trilheiro = String(formData.get('trilheiro') ?? '') as (typeof TRILHEIROS)[number];
  if (!TRILHEIROS.includes(trilheiro)) return;
  await zerarTrilheiro(trilheiro);
  atualizar();
}

/** Grava a observação de cada setor, dia a dia, da semana inteira (segunda a domingo). */
/** Lança soldas e cortes da semana inteira (segunda a domingo) em uma só vez. */
export async function salvarEstaleiroSemanaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  const dias = await estaleiroDiasDaSemana(semana);
  for (const d of dias) {
    const soldas = inteiro(formData.get(`soldas_${d.data}`));
    const cortes = inteiro(formData.get(`cortes_${d.data}`));
    if (soldas === 'invalido' || cortes === 'invalido') return { ok: false, erro: 'Use só números inteiros em soldas e cortes.' };
    await salvarEstaleiroDia(d.data, soldas, cortes);
  }
  await salvarObservacoesDoSetor(formData, semana, 'estaleiro');
  atualizar();
  return { ok: true };
}

/** Lança barras e jacarés da serra (W61 e W62) da semana inteira. */
export async function salvarSerraSemanaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  const dias = await composicoesDaSemana(semana);
  for (const d of dias) {
    for (const ativo of COMPOSICOES) {
      const barras = inteiro(formData.get(`barras_${ativo}_${d.data}`));
      const jacares = inteiro(formData.get(`jacares_${ativo}_${d.data}`));
      if (barras === 'invalido' || jacares === 'invalido') return { ok: false, erro: 'Use só números inteiros na serra.' };
      const observacao = texto(formData.get(`obs_${ativo}_${d.data}`), 500);
      await salvarComposicao(d.data, ativo, barras, jacares, observacao);
    }
  }
  await salvarObservacoesDoSetor(formData, semana, 'serra');
  atualizar();
  return { ok: true };
}

/** Lança produção e perda dos caminhões da semana inteira. */
export async function salvarCaminhoesSemanaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  const dias = await caminhoesDaSemana(semana);
  for (const d of dias) {
    for (const c of CAMINHOES_ATIVOS) {
      const producaoDiaria = inteiro(formData.get(`producao_${c}_${d.data}`));
      const perdaDiaria = inteiro(formData.get(`perda_${c}_${d.data}`));
      if (producaoDiaria === 'invalido' || perdaDiaria === 'invalido') return { ok: false, erro: 'Use só números inteiros no caminhão.' };
      await salvarCaminhao(d.data, c, {
        local: texto(formData.get(`local_${c}_${d.data}`), 120),
        producaoDiaria,
        perdaDiaria,
        inicioMacro1: texto(formData.get(`inicio_${c}_${d.data}`), 10),
        terminoMacro9: texto(formData.get(`termino_${c}_${d.data}`), 10),
        observacao: texto(formData.get(`obs_${c}_${d.data}`), 500),
      });
    }
  }
  await salvarObservacoesDoSetor(formData, semana, 'caminhao');
  atualizar();
  return { ok: true };
}

/** Lança o acompanhamento dos trilheiros da semana (segunda a domingo), de uma vez. */
export async function salvarTrilheirosSemanaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  const dias = await trilheirosDaSemana(semana);
  // B.O., partida, local e observação: uma informação por trilheiro (vale para os dias da semana dele).
  const porTrilheiro = {} as Record<(typeof TRILHEIROS)[number], { bo: string | null; partida: string | null; local: string | null; observacao: string | null }>;
  for (const t of TRILHEIROS) {
    const bo = String(formData.get(`bo_${t}`) ?? '').trim();
    const partida = String(formData.get(`partida_${t}`) ?? '').trim();
    if (bo !== '' && !ehIsoValido(bo)) return { ok: false, erro: `Data do B.O. de ${t} inválida.` };
    if (partida !== '' && !ehIsoValido(partida)) return { ok: false, erro: `Data de partida de ${t} inválida.` };
    porTrilheiro[t] = {
      bo: bo === '' ? null : bo,
      partida: partida === '' ? null : partida,
      local: texto(formData.get(`local_${t}`), 60),
      observacao: texto(formData.get(`obs_${t}`), 500),
    };
  }

  // Valida tudo antes de gravar.
  const lancamentos: { data: string; trilheiro: (typeof TRILHEIROS)[number]; v: { boEm: string | null; partidaEm: string | null; local: string | null; descarregadas: number | null; total: number | null; programacao: string | null; observacao: string | null } }[] = [];
  for (const d of dias) {
    for (const t of TRILHEIROS) {
      const descarregadas = inteiro(formData.get(`desc_${t}_${d.data}`));
      const total = inteiro(formData.get(`total_${t}_${d.data}`));
      if (total === 'invalido' || descarregadas === 'invalido') return { ok: false, erro: 'Use só números inteiros nas barras.' };
      if (total !== null && descarregadas !== null && descarregadas > total) {
        return { ok: false, erro: `${t}: descarregadas não pode ser maior que o total do giro.` };
      }
      const info = porTrilheiro[t];
      lancamentos.push({
        data: d.data,
        trilheiro: t,
        v: {
          boEm: info.bo,
          partidaEm: info.partida,
          local: info.local,
          descarregadas,
          total,
          // A programação do dia não é mais lançada aqui: mantém o que já estava salvo.
          programacao: d.trilheiros[t].programacao,
          observacao: info.observacao,
        },
      });
    }
  }
  for (const l of lancamentos) await salvarTrilheiroDia(l.data, l.trilheiro, l.v);
  atualizar();
  return { ok: true };
}

/** Lança a geração da semana inteira: corte, local e as carretas (com perfis) de cada líder em cada dia. */
export async function salvarGeracaoSemanaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };

  let brutos: unknown;
  try {
    brutos = JSON.parse(String(formData.get('dados') ?? '{}'));
  } catch {
    return { ok: false, erro: 'Não foi possível ler a geração. Atualize a página e tente de novo.' };
  }
  if (!brutos || typeof brutos !== 'object') return { ok: false, erro: 'Não foi possível ler a geração.' };
  const porDia = brutos as Record<string, Record<string, Record<string, unknown>>>;

  // Valida tudo antes de gravar: se algo estiver errado, nada da semana é alterado.
  const dias = await geracaoDaSemana(semana);
  const gravar: { data: string; lider: LiderValor; local: string | null; corteM: number | null; observacao: string | null; carretas: CarretaGeracaoValor[] }[] = [];
  for (const d of dias) {
    for (const l of LIDERES) {
      const item = porDia[d.data]?.[l.valor];
      if (!item) continue;
      const corteM = decimal(String(item.corte ?? ''));
      if (corteM === 'invalido') return erroNumero;
      const brutas = Array.isArray(item.carretas) ? (item.carretas as Array<Record<string, unknown>>) : [];
      const carretas: CarretaGeracaoValor[] = [];
      for (const c of brutas) {
        const perfis = Array.isArray(c.perfis) ? c.perfis.map(String) : [];
        if (perfis.some((p) => !(PERFIS as readonly string[]).includes(p))) return { ok: false, erro: 'Perfil inválido em uma carreta.' };
        const quantidade = inteiro(String(c.quantidade ?? ''));
        const carregamentoM = decimal(String(c.carregamentoM ?? ''));
        const deixadaViaM = decimal(String(c.deixadaViaM ?? ''));
        if (quantidade === 'invalido' || carregamentoM === 'invalido' || deixadaViaM === 'invalido') return erroNumero;
        const vazia = perfis.length === 0 && quantidade == null && carregamentoM == null && deixadaViaM == null;
        if (!vazia) carretas.push({ perfis, quantidade, carregamentoM, deixadaViaM });
      }
      gravar.push({ data: d.data, lider: l.valor, local: texto(String(item.local ?? ''), 120), corteM, observacao: texto(String(item.observacao ?? ''), 500), carretas });
    }
  }

  for (const g of gravar) {
    await salvarGeracaoDia(g.data, g.lider, { local: g.local, corteM: g.corteM, observacao: g.observacao, carretas: g.carretas });
  }
  atualizar();
  return { ok: true };
}
