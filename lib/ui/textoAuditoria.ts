/** Registros antigos da exclusão vinham como "X (vai para a lixeira). Motivo: Y"; mostra no formato novo. */
export function textoAuditoria(descricao: string): string {
  return descricao.replace(/\s*\(vai para a lixeira\)\.\s*Motivo:\s*(.*)$/i, (_, motivo: string) => ` foi para a Lixeira · Motivo: “${motivo.trim()}”`);
}
