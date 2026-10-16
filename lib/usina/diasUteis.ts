// Dias úteis do Relatório da Usina. Datas trabalhadas como 'AAAA-MM-DD' (sem fuso),
// para não haver deslocamento de um dia por causa do horário.

const DIA_MS = 24 * 60 * 60 * 1000;

// Feriados que a equipe folga em Bauru-SP: nacionais, estaduais de São Paulo e municipais
// de Bauru. O admin pode editar a lista na tela (tabela Feriado); esta é a base inicial de 2026.
// PENDENTE: o feriado municipal de Bauru ainda não foi confirmado (ver FERIADOS_A_CONFIRMAR).
export const FERIADOS_2026: { data: string; nome: string }[] = [
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-02-16', nome: 'Carnaval (ponto facultativo)' },
  { data: '2026-02-17', nome: 'Carnaval (ponto facultativo)' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-06-04', nome: 'Corpus Christi' },
  { data: '2026-07-09', nome: 'Revolução Constitucionalista (SP)' },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-11-20', nome: 'Consciência Negra' },
  { data: '2026-12-25', nome: 'Natal' },
];

export const FERIADOS_A_CONFIRMAR = ['Aniversário de Bauru (municipal, data a confirmar)'];

export function ehFimDeSemana(iso: string): boolean {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return dia === 0 || dia === 6;
}

export function ehDiaUtil(iso: string, feriados: ReadonlySet<string>): boolean {
  return !ehFimDeSemana(iso) && !feriados.has(iso);
}

// Soma de dias 'AAAA-MM-DD' sem depender do fuso do servidor.
export function somarDias(iso: string, dias: number): string {
  const t = new Date(`${iso}T12:00:00Z`).getTime() + dias * DIA_MS;
  return new Date(t).toISOString().slice(0, 10);
}

// Dias úteis de chegada até partida: conta o dia da chegada e NÃO conta o dia da partida
// (o trilheiro está na usina desde a chegada até o dia em que sai). Fim de semana e feriado não contam.
// Retorna null quando falta uma das datas ou quando a partida é anterior à chegada.
export function diasUteisNaUsina(
  chegadaIso: string | null | undefined,
  partidaIso: string | null | undefined,
  feriados: ReadonlySet<string>,
): number | null {
  if (!chegadaIso || !partidaIso) return null;
  if (partidaIso < chegadaIso) return null;
  let total = 0;
  for (let d = chegadaIso; d < partidaIso; d = somarDias(d, 1)) {
    if (ehDiaUtil(d, feriados)) total++;
  }
  return total;
}

export function conjuntoFeriados(extras: string[] = []): Set<string> {
  return new Set([...FERIADOS_2026.map((f) => f.data), ...extras]);
}
