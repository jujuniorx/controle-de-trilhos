// Formatação numérica no padrão brasileiro (vírgula decimal, ponto de milhar).
// Antes a tela mostrava "31.180 t" para 31,18 t, o que em pt-BR lê como 31 mil.
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

const FMT_METROS = nf(2, 2);
const FMT_PESO = nf(2, 3);
const FMT_TONELADAS_RESUMO = nf(1, 1);

/** Metros com 2 casas: 537,17 */
export function fmtMetros(v: unknown): string {
  return FMT_METROS.format(Number(v));
}

/** Toneladas com 2 a 3 casas: 31,18 / 30,7 → 30,70 / 10,504 */
export function fmtPeso(v: unknown): string {
  return FMT_PESO.format(Number(v));
}

/**
 * Toneladas para totais, cartões e gráficos: sempre 1 casa (1.239,4).
 * Com 3 casas, "1.239,436" lia como mais de um milhão; o detalhe com 3 casas fica nas telas de conferência.
 */
export function fmtToneladas(v: unknown): string {
  return FMT_TONELADAS_RESUMO.format(Number(v));
}

/** Inteiro com ponto de milhar (1.000), sem depender do idioma instalado no servidor. */
export function fmtInteiro(v: unknown): string {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return '0';
  const sinal = n < 0 ? '-' : '';
  return sinal + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
