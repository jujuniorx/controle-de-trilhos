/** Formata AAAA-MM-DD como DD/MM/AAAA. */
export function br(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Soma dias a uma data AAAA-MM-DD (cálculo em UTC, sem efeito de fuso). */
export function somarDiasPagina(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
