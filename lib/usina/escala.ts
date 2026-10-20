// Escala semanal da usina: uma linha por caminhão, trilheiro ou pessoa da geração, com um status e um local por dia.
// Fica guardada como JSON no campo `conteudo` de EscalaSemana (sem migração). Textos antigos continuam válidos.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export const STATUS_ESCALA = [
  { valor: '-', rotulo: '-' },
  { valor: 'OK', rotulo: 'OK' },
  { valor: 'FOLGA', rotulo: 'Folga' },
  { valor: 'DESL.', rotulo: 'Desl.' },
  { valor: 'MAN.', rotulo: 'Man.' },
  { valor: 'TITAN', rotulo: 'Titan' },
  { valor: 'PRUMO', rotulo: 'Prumo' },
  { valor: 'EXTRA', rotulo: 'Extra' },
] as const;

/** Itens que tem so linha de status (a linha LOCAL e compartilhada com o item de cima). */
export const ITENS_SEM_LOCAL = new Set(['E17T']);

export const ITENS_ESCALA = [
  { id: 'E18', rotulo: 'E18', grupo: 'Caminhão de solda' },
  { id: 'E17', rotulo: 'E17 · PRUMO', grupo: 'Caminhão de solda' },
  { id: 'E17T', rotulo: 'E17 · TITAN', grupo: 'Caminhão de solda' },
  { id: 'ALECIO', rotulo: 'Alécio', grupo: 'Geração de trilho' },
  { id: 'BRUNO', rotulo: 'Bruno', grupo: 'Geração de trilho' },
  { id: 'REGINALDO', rotulo: 'Reginaldo', grupo: 'Geração de trilho' },
  { id: 'E40', rotulo: 'E40', grupo: 'Trilheiros' },
  { id: 'E42', rotulo: 'E42', grupo: 'Trilheiros' },
  { id: 'E46', rotulo: 'E46', grupo: 'Trilheiros' },
] as const;

export interface DiaEscala { status: string; local: string }
export interface EscalaSemanaValor {
  /** 2 = salva pela tela atual. Semanas salvas antes (1 ou ausente) cedem a semana base da planilha. */
  versao: number;
  /** Nome do plantão de fim de semana em cada um dos 7 dias (seg a dom). */
  plantao: string[];
  /** Para cada item, 7 dias. */
  linhas: Record<string, DiaEscala[]>;
  /** Tipo de ciclo e data de inicio de cada item. */
  config: Record<string, ConfigCiclo>;
}

const STATUS_VALIDOS = new Set<string>(STATUS_ESCALA.map((s) => s.valor));
export const statusValido = (v: string) => STATUS_VALIDOS.has(v);

export const VERSAO_ATUAL = 3;

export function escalaVazia(): EscalaSemanaValor {
  const linhas: Record<string, DiaEscala[]> = {};
  for (const item of ITENS_ESCALA) linhas[item.id] = Array.from({ length: 7 }, () => ({ status: '-', local: '' }));
  return { versao: VERSAO_ATUAL, plantao: Array(7).fill(''), linhas, config: structuredClone(CONFIG_PADRAO) };
}

/** Lê o conteúdo salvo. Devolve null quando é texto antigo (ou vazio). */
export function lerEscala(texto: string | null | undefined): EscalaSemanaValor | null {
  if (!texto) return null;
  try {
    const dados = JSON.parse(texto);
    if (dados?.v !== 1 || !Array.isArray(dados.plantao) || typeof dados.linhas !== 'object') return null;
    const base = escalaVazia();
    base.versao = Number(dados.versao ?? 1);
    base.plantao = dados.plantao.slice(0, 7).map((p: unknown) => String(p ?? ''));
    // Semanas salvas antes: E17 - TITAN e E17 - PRUMO viraram uma linha so (E17), com a empresa no status do dia.
    const linhasLidas: Record<string, unknown> = { ...dados.linhas };
    if (!Array.isArray(linhasLidas.E17)) {
      const antiga = [linhasLidas.E17T, linhasLidas.E17P].find(Array.isArray) as unknown[] | undefined;
      if (antiga) linhasLidas.E17 = antiga;
    }
    for (const item of ITENS_ESCALA) {
      const dias = Array.isArray(linhasLidas[item.id]) ? (linhasLidas[item.id] as unknown[]) : [];
      base.linhas[item.id] = Array.from({ length: 7 }, (_, i) => {
        const bruto = String((dias[i] as { status?: unknown; local?: unknown } | undefined)?.status ?? '');
        const status = bruto;
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
  return JSON.stringify({ v: 1, ...valor, versao: VERSAO_ATUAL });
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
  { valor: 'e18', rotulo: 'E18 (planilha)' },
  { valor: 'manual', rotulo: 'Manual' },
] as const;
export type TipoCiclo = (typeof TIPOS_CICLO)[number]['valor'];
// e18: 10 dias de trabalho (DESL. so no primeiro dia) + 4 de folga, como na planilha.
const TIPOS_VALIDOS = new Set<string>(TIPOS_CICLO.map((t) => t.valor));

/** inicio = primeiro dia de trabalho do bloco (yyyy-mm-dd). Vazio quando nao se aplica (5x2, manual). */
export interface ConfigCiclo { tipo: TipoCiclo; inicio: string }

const ISO_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

export const CONFIG_PADRAO: Record<string, ConfigCiclo> = {
  E18: { tipo: 'e18', inicio: '2026-10-26' },
  E17: { tipo: 'manual', inicio: '' },
  E17T: { tipo: 'manual', inicio: '' },
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
  return { tipo: t, inicio: t === '11x3' || t === '10x4' || t === 'e18' ? i : '' };
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
  if (cfg.tipo === 'e18') {
    if (pos >= 10) return 'FOLGA';
    return pos === 0 ? 'DESL.' : 'OK';
  }
  const trabalho = cfg.tipo === '11x3' ? 11 : 10;
  if (pos >= trabalho) return 'FOLGA';
  if (pos === 0 || pos === trabalho - 1) return 'DESL.';
  return 'OK';
}

// ── Semana base (planilha de 19 a 25/10/2026) ──────────────────────────────
// Valores lidos da planilha. Status de Geracao e trilheiros ja saem do ciclo; aqui ficam
// os itens manuais (E18, E17), os locais e o plantao. A partir dai, tudo e automatico.
// E17: duas equipes no mesmo caminhao (PRUMO e TITAN, como na planilha), com um local so.
const DIA = (status: string, local = '') => ({ status, local });

export const SEMANA_BASE: Record<string, { plantao: string[]; linhas: Record<string, DiaEscalaBase[]> }> = {
  '2026-10-19': {
    plantao: ['', '', '', '', '', 'MARCELO', 'MARCELO'],
    linhas: {
      E18: Array.from({ length: 7 }, () => DIA('MAN.', 'MMD')),
      E17: Array.from({ length: 7 }, () => DIA('PRUMO', 'Rio Claro')),
      E17T: [
        DIA('TITAN'),
        DIA('TITAN'),
        DIA('DESL.'),
        DIA('FOLGA'),
        DIA('FOLGA'),
        DIA('FOLGA'),
        DIA('FOLGA'),
      ],
      ALECIO: [DIA('', 'ZPT'), DIA('', 'ZPT'), DIA('', 'ZPT'), DIA('', ''), DIA('', ''), DIA('', ''), DIA('', '')],
      BRUNO: [DIA('', 'ZEV'), DIA('', 'ZEV'), DIA('', 'ZEV'), DIA('', ''), DIA('', ''), DIA('', ''), DIA('', '')],
      REGINALDO: [DIA('', 'Inocência'), DIA('', 'Inocência'), DIA('', 'Inocência'), DIA('', 'Inocência'), DIA('', ''), DIA('', ''), DIA('', '')],
      E40: [DIA('', 'SPC'), DIA('', 'SPC'), DIA('', 'SPC'), DIA('', 'SPC'), DIA('', 'SPC'), DIA('', ''), DIA('', '')],
      E42: [DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', ''), DIA('', '')],
      E46: [DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', 'SPS'), DIA('', ''), DIA('', '')],
    },
  },
};

export type DiaEscalaBase = { status: string; local: string };

/** Cores de fundo e de texto de cada status, como na planilha. */
export const ESTILO_STATUS: Record<string, { fundo: string; texto: string }> = {
  OK: { fundo: '#00b050', texto: '#ffffff' },
  FOLGA: { fundo: '#ffff00', texto: '#1a1a1a' },
  'DESL.': { fundo: '#f4b183', texto: '#1a1a1a' },
  'MAN.': { fundo: '#ff0000', texto: '#ffffff' },
  TITAN: { fundo: '#fce4d6', texto: '#1a1a1a' },
  PRUMO: { fundo: '#cc33cc', texto: '#ffffff' },
  EXTRA: { fundo: '#ffc000', texto: '#1a1a1a' },
  '-': { fundo: 'transparent', texto: '#6b7280' },
};

/** Preenche os dias dos itens com ciclo; os itens Manual ficam como estao. */
export function aplicarCiclos(
  atual: Record<string, DiaEscala[]>,
  config: Record<string, ConfigCiclo>,
  semana: string,
): Record<string, DiaEscala[]> {
  const isos = isoDaSemana(semana);
  const proximo = { ...atual };
  for (const item of ITENS_ESCALA) {
    const cfg = config[item.id];
    if (!cfg) continue;
    const sts = isos.map((iso) => statusDoCiclo(cfg, iso));
    if (sts.some((x) => x === null)) continue;
    proximo[item.id] = atual[item.id].map((c, i) => ({ ...c, status: sts[i] as string }));
  }
  return proximo;
}

/**
 * Escala completa de uma semana: a salva, se existir; senao, o ciclo de cada pessoa
 * com a semana base da planilha por cima (quando houver).
 */
export function montarEscalaSemana(
  semana: string,
  textoSalvo: string | null | undefined,
  anterior?: EscalaSemanaValor,
): EscalaSemanaValor {
  const salva = lerEscala(textoSalvo);
  const base = SEMANA_BASE[semana];
  // A configuracao de ciclo vem sempre do padrao de cada pessoa; nao depende do que foi salvo.
  const configPadrao = structuredClone(CONFIG_PADRAO);
  if (salva && (!base || salva.versao >= VERSAO_ATUAL)) return { ...salva, config: configPadrao };
  const vazia = escalaVazia();
  const linhas = aplicarCiclos(vazia.linhas, vazia.config, semana);
  // Quem esta trabalhando continua no local da semana anterior, ate alguem mudar.
  if (anterior) {
    const locais = locaisDaSemana(anterior);
    for (const item of ITENS_ESCALA) {
      if (vazia.config[item.id]?.tipo === 'manual' || !locais[item.id]) continue;
      linhas[item.id] = linhas[item.id].map((c) =>
        c.status === '-' || c.status === 'FOLGA' || c.local ? c : { ...c, local: locais[item.id] },
      );
    }
  }
  if (!base) return { versao: VERSAO_ATUAL, plantao: vazia.plantao, linhas, config: configPadrao };
  for (const [id, dias] of Object.entries(base.linhas)) {
    linhas[id] = (linhas[id] ?? []).map((c, i) => ({ status: dias[i].status || c.status, local: dias[i].local }));
  }
  return { versao: VERSAO_ATUAL, plantao: base.plantao, linhas, config: configPadrao };
}

/** Semana (segunda-feira) anterior, em yyyy-mm-dd. */
export function semanaAnterior(semana: string): string {
  const d = new Date(`${semana}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Ultimo local de cada item na semana anterior (dias de trabalho, nao folga). */
export function locaisDaSemana(escala: EscalaSemanaValor): Record<string, string> {
  const locais: Record<string, string> = {};
  for (const item of ITENS_ESCALA) {
    const dias = escala.linhas[item.id] ?? [];
    for (let i = dias.length - 1; i >= 0; i--) {
      const c = dias[i];
      if (c.local && c.status !== '-' && c.status !== 'FOLGA') {
        locais[item.id] = c.local;
        break;
      }
    }
  }
  return locais;
}

export interface ResumoDia {
  trabalhando: string[];
  deslocamento: string[];
  folga: string[];
  manutencao: string[];
  semEscala: string[];
  plantao: string;
}

/** Quem esta em cada situacao numa data (yyyy-mm-dd) da semana. */
export function resumoDoDia(escala: EscalaSemanaValor, semana: string, data: string): ResumoDia | null {
  const idx = isoDaSemana(semana).indexOf(data);
  if (idx < 0) return null;
  const r: ResumoDia = { trabalhando: [], deslocamento: [], folga: [], manutencao: [], semEscala: [], plantao: escala.plantao[idx] ?? '' };
  for (const item of ITENS_ESCALA) {
    const c = escala.linhas[item.id]?.[idx];
    if (!c) continue;
    const nome = c.local ? `${item.rotulo} (${c.local})` : item.rotulo;
    if (c.status === '-' || c.status === '') r.semEscala.push(item.rotulo);
    else if (c.status === 'DESL.') r.deslocamento.push(nome);
    else if (c.status === 'FOLGA') r.folga.push(item.rotulo);
    else if (c.status === 'MAN.') r.manutencao.push(item.rotulo);
    else r.trabalhando.push(c.status === 'OK' || c.status === 'EXTRA' ? nome : `${item.rotulo} ${c.status}`);
  }
  return r;
}
