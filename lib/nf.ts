/** Um carregamento pode ter mais de uma NF: a principal (numeroDocumento) + as extras. */
export interface ComNotas {
  numeroDocumento: string | null;
  numerosDocumentoExtras?: string[] | null;
}

export function todasAsNfs(mov: ComNotas): string[] {
  return [mov.numeroDocumento, ...(mov.numerosDocumentoExtras ?? [])].filter((n): n is string => Boolean(n));
}

/** "087781, 087782" — para tabela, Excel e romaneio. Vazio quando não há NF. */
export function nfsEmTexto(mov: ComNotas): string {
  return todasAsNfs(mov).join(', ');
}

/** "NF 087781" ou "NFs 087781, 087782" — para títulos. Vazio quando não há NF. */
export function rotuloNfs(mov: ComNotas): string {
  const nfs = todasAsNfs(mov);
  if (nfs.length === 0) return '';
  return `${nfs.length > 1 ? 'NFs' : 'NF'} ${nfs.join(', ')}`;
}
