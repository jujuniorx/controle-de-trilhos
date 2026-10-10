// Formatação numérica no padrão brasileiro (vírgula decimal, ponto de milhar).
// Antes a tela mostrava "31.180 t" para 31,18 t, o que em pt-BR lê como 31 mil.
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

const FMT_METROS = nf(2, 2);
const FMT_PESO = nf(2, 3);

/** Metros com 2 casas: 537,17 */
export function fmtMetros(v: unknown): string {
  return FMT_METROS.format(Number(v));
}

/** Toneladas com 2 a 3 casas: 31,18 / 30,7 → 30,70 / 10,504 */
export function fmtPeso(v: unknown): string {
  return FMT_PESO.format(Number(v));
}
