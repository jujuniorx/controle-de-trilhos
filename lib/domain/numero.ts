/**
 * Números do jeito que o Brasil escreve: vírgula decimal e ponto de milhar.
 * Antes a mesma medida aparecia como "14,30 m" numa tela e "14.30 m" na outra.
 */
export function metros(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

export function toneladas(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
}

/** Data AAAA-MM-DD escrita como 28/10/2026 (sem depender do fuso). */
export function dataBr(iso: string): string {
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}
