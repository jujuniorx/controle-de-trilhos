/** Cookie que guarda a escolha "Ver resumo" ou "Ver detalhado" de cada pessoa. */
export const COOKIE_VISTA_TRILHOS = 'estoque_trilhos_vista';

/** Números do estoque de trilhos no padrão brasileiro. */
export function fmt(n: number, casas = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Metros: inteiro quando fecha, senão até 2 casas. */
export function fmtM(n: number): string {
  const inteiro = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 });
}

export function fmtT(n: number): string {
  return fmt(n, 1);
}

/** yyyy-mm-dd → dd/mm/aaaa */
export function dataBr(iso: string): string {
  return iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
}

export function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "26/11/2026, 10:12" no horário de Brasília. */
export function dataHoraBr(isoCompleto: string): string {
  const d = new Date(new Date(isoCompleto).getTime() - 3 * 60 * 60 * 1000).toISOString();
  return `${dataBr(d.slice(0, 10))}, ${d.slice(11, 16)}`;
}
