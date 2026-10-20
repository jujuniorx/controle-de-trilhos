'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { salvarEstaleiroDia, salvarEstoqueTls, salvarManutencaoSemana, salvarEscalaSemana, TIPOS_TLS, type TipoTlsValor } from '@/lib/services/usina';
import { ITENS_ESCALA, escalaVazia, gravarEscala, statusValido, cfgDeObjeto } from '@/lib/usina/escala';
import { salvarGeracao, salvarComposicao, salvarCaminhao, salvarGiro, salvarManutencaoTrilheiro, LIDERES, COMPOSICOES, CAMINHOES_ATIVOS, TRILHEIROS, type LiderValor, type CarretaGeracaoValor } from '@/lib/services/usina';
import { PERFIS } from '@/lib/validation/recebimento';
import { ehIsoValido } from '@/lib/usina/periodo';

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

export async function salvarGeracaoAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  const lider = String(formData.get('lider') ?? '') as LiderValor;
  if (!data) return { ok: false, erro: 'Data inválida.' };
  if (!LIDERES.some((l) => l.valor === lider)) return { ok: false, erro: 'Líder inválido.' };
  const corteM = decimal(formData.get('corteM'));
  if (corteM === 'invalido') return erroNumero;

  // Carretas chegam como JSON (lista editável na tela): perfis múltiplos + números por carreta.
  let brutas: unknown;
  try {
    brutas = JSON.parse(String(formData.get('carretas') ?? '[]'));
  } catch {
    return { ok: false, erro: 'Não foi possível ler as carretas. Atualize a página e tente de novo.' };
  }
  if (!Array.isArray(brutas)) return { ok: false, erro: 'Não foi possível ler as carretas.' };

  const carretas: CarretaGeracaoValor[] = [];
  for (const item of brutas as Array<Record<string, unknown>>) {
    const perfis = Array.isArray(item.perfis) ? item.perfis.map(String) : [];
    if (perfis.some((p) => !(PERFIS as readonly string[]).includes(p))) return { ok: false, erro: 'Perfil inválido em uma carreta.' };
    const quantidade = inteiro(String(item.quantidade ?? ''));
    const carregamentoM = decimal(String(item.carregamentoM ?? ''));
    const deixadaViaM = decimal(String(item.deixadaViaM ?? ''));
    if (quantidade === 'invalido' || carregamentoM === 'invalido' || deixadaViaM === 'invalido') return erroNumero;
    const vazia = perfis.length === 0 && quantidade == null && carregamentoM == null && deixadaViaM == null;
    if (!vazia) carretas.push({ perfis, quantidade, carregamentoM, deixadaViaM });
  }

  await salvarGeracao(data, lider, {
    local: texto(formData.get('local'), 120),
    corteM,
    observacao: texto(formData.get('observacao'), 500),
    carretas,
  });
  atualizar();
  return { ok: true };
}

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
