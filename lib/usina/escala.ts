// Escala semanal da usina: uma linha por caminhão, trilheiro ou pessoa da geração, com um status e um local por dia.
// Fica guardada como JSON no campo `conteudo` de EscalaSemana (sem migração). Textos antigos continuam válidos.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export const STATUS_ESCALA = [
  { valor: '-', rotulo: '-' },
  { valor: 'OK', rotulo: 'OK' },
  { valor: 'FOLGA', rotulo: 'Folga' },
  { valor: 'DESL.', rotulo: 'Desl.' },
  { valor: 'MAN.', rotulo: 'Man.' },
  { valor: 'EXTRA', rotulo: 'Extra' },
] as const;

export const ITENS_ESCALA = [
  { id: 'E18', rotulo: 'E18', grupo: 'Caminhão de solda' },
  { id: 'E17', rotulo: 'E17', grupo: 'Caminhão de solda' },
  { id: 'ALECIO', rotulo: 'Alécio', grupo: 'Geração de trilho' },
  { id: 'BRUNO', rotulo: 'Bruno', grupo: 'Geração de trilho' },
  { id: 'REGINALDO', rotulo: 'Reginaldo', grupo: 'Geração de trilho' },
  { id: 'E40', rotulo: 'E40', grupo: 'Trilheiros' },
  { id: 'E42', rotulo: 'E42', grupo: 'Trilheiros' },
  { id: 'E46', rotulo: 'E46', grupo: 'Trilheiros' },
] as const;

export interface DiaEscala { status: string; local: string }
export interface EscalaSemanaValor {
  /** Nome do plantão de fim de semana em cada um dos 7 dias (seg a dom). */
  plantao: string[];
  /** Para cada item, 7 dias. */
  linhas: Record<string, DiaEscala[]>;
  /** Tipo de ciclo e data de inicio de cada item. */
  config: Record<string, ConfigCiclo>;
}

const STATUS_VALIDOS = new Set<string>(STATUS_ESCALA.map((s) => s.valor));
export const statusValido = (v: string) => STATUS_VALIDOS.has(v);

export function escalaVazia(): EscalaSemanaValor {
  const linhas: Record<string, DiaEscala[]> = {};
  for (const item of ITENS_ESCALA) linhas[item.id] = Array.from({ length: 7 }, () => ({ status: '-', local: '' }));
  return { plantao: Array(7).fill(''), linhas, config: structuredClone(CONFIG_PADRAO) };
}

/** Lê o conteúdo salvo. Devolve null quando é texto antigo (ou vazio). */
export function lerEscala(texto: string | null | undefined): EscalaSemanaValor | null {
  if (!texto) return null;
  try {
    const dados = JSON.parse(texto);
    if (dados?.v !== 1 || !Array.isArray(dados.plantao) || typeof dados.linhas !== 'object') return null;
    const base = escalaVazia();
    base.plantao = dados.plantao.slice(0, 7).map((p: unknown) => String(p ?? ''));
    // Semanas salvas antes: E17 - TITAN e E17 - PRUMO viraram uma linha so (E17).
    const linhasLidas: Record<string, unknown> = { ...dados.linhas };
    if (!Array.isArray(linhasLidas.E17)) {
      const antiga = [linhasLidas.E17T, linhasLidas.E17P].find(Array.isArray) as unknown[] | undefined;
      if (antiga) linhasLidas.E17 = antiga;
    }
    for (const item of ITENS_ESCALA) {
      const dias = Array.isArray(linhasLidas[item.id]) ? (linhasLidas[item.id] as unknown[]) : [];
      base.linhas[item.id] = Array.from({ length: 7 }, (_, i) => {
        const bruto = String((dias[i] as { status?: unknown; local?: unknown } | undefined)?.status ?? '');
        const status = bruto === 'TITAN' || bruto === 'PRUMO' ? 'OK' : bruto;
        return {
          status: statusValido(status) ? status : '-',
          local: String((dias[i] as { local?: unknown } | undefined)?.local ?? ''),
        };
      });
    }
    const cfg = dados.config ?? {};
    for (const item of ITENS_ESCALA) {
      const c = cfg[item.id];
      if (c) base.config[item.id] = configValida(String(c.tipo ?? ''), String(c.inicio ?? ''));
    }
    return base;
  } catch {
    return null;
  }
}

export function gravarEscala(valor: EscalaSemanaValor): string {
  return JSON.stringify({ v: 1, ...valor });
}

/** Rótulos "Seg 20/10" ... para os 7 dias a partir da segunda-feira da semana (yyyy-mm-dd). */
export function diasDaSemana(semana: string): { nome: string; data: string }[] {
  const [a, m, d] = semana.split('-').map(Number);
  return DIAS_SEMANA.map((nome, i) => {
    const dt = new Date(Date.UTC(a, m - 1, d + i));
    const dia = String(dt.getUTCDate()).padStart(2, '0');
    const mes = String(dt.getUTCMonth() + 1).padStart(2, '0');
    return { nome, data: `${dia}/${mes}` };
  });
}

export const GRUPOS_ESCALA = ['Caminhão de solda', 'Geração de trilho', 'Trilheiros'] as const;

/** Texto curto de uma célula, usado na impressão. */
export function textoCelula(c: DiaEscala): string {
  if (c.status === '-' && !c.local) return '-';
  const partes = [c.status];
  if (c.local) partes.push(c.local);
  return partes.join(' · ');
}

// ── Ciclos de trabalho ──────────────────────────────────────────────────────
// 11x3 e 10x4: 14 dias por ciclo. O primeiro e o ultimo dia de trabalho do bloco sao DESL.,
// os demais dias de trabalho sao OK e depois vem a folga.
// 5x2: sabado e domingo de folga, sem deslocamento.

export const TIPOS_CICLO = [
  { valor: '11x3', rotulo: '11x3' },
  { valor: '10x4', rotulo: '10x4' },
  { valor: '5x2', rotulo: '5x2' },
  { valor: 'manual', rotulo: 'Manual' },
] as const;
export type TipoCiclo = (typeof TIPOS_CICLO)[number]['valor'];
const TIPOS_VALIDOS = new Set<string>(TIPOS_CICLO.map((t) => t.valor));

/** inicio = primeiro dia de trabalho do bloco (yyyy-mm-dd). Vazio quando nao se aplica (5x2, manual). */
export interface ConfigCiclo { tipo: TipoCiclo; inicio: string }

const ISO_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

export const CONFIG_PADRAO: Record<string, ConfigCiclo> = {
  E18: { tipo: 'manual', inicio: '' },
  E17: { tipo: 'manual', inicio: '' },
  ALECIO: { tipo: '11x3', inicio: '2026-10-27' },
  BRUNO: { tipo: '11x3', inicio: '2026-10-27' },
  REGINALDO: { tipo: '11x3', inicio: '2026-10-27' },
  E40: { tipo: '5x2', inicio: '' },
  E42: { tipo: '5x2', inicio: '' },
  E46: { tipo: '5x2', inicio: '' },
};

export function configValida(tipo: string, inicio: string): ConfigCiclo {
  const t = TIPOS_VALIDOS.has(tipo) ? (tipo as TipoCiclo) : 'manual';
  const i = ISO_VALIDO.test(inicio) ? inicio : '';
  return { tipo: t, inicio: t === '11x3' || t === '10x4' ? i : '' };
}

/** Datas ISO (yyyy-mm-dd) dos 7 dias da semana que comeca em `semana`. */
export function isoDaSemana(semana: string): string[] {
  const [a, m, d] = semana.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(a, m - 1, d + i)).toISOString().slice(0, 10));
}

/** Status do dia pelo ciclo. Devolve null quando o item e manual ou falta a data de inicio. */
export function statusDoCiclo(cfg: ConfigCiclo, dataIso: string): string | null {
  if (cfg.tipo === 'manual') return null;
  const data = new Date(dataIso + 'T00:00:00Z').getTime();
  if (cfg.tipo === '5x2') {
    const dow = new Date(data).getUTCDay();
    return dow === 0 || dow === 6 ? 'FOLGA' : 'OK';
  }
  if (!cfg.inicio) return null;
  const inicio = new Date(cfg.inicio + 'T00:00:00Z').getTime();
  const dias = Math.round((data - inicio) / 86400000);
  const pos = ((dias % 14) + 14) % 14;
  const trabalho = cfg.tipo === '11x3' ? 11 : 10;
  if (pos >= trabalho) return 'FOLGA';
  if (pos === 0 || pos === trabalho - 1) return 'DESL.';
  return 'OK';
}
