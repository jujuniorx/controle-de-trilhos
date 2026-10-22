/**
 * Rótulo e variante do badge de um remetido. O status no banco continua o mesmo; só a tela
 * muda: quando a Portaria já registrou a chegada da carreta, o remetido aparece como "Na portaria"
 * em vez de "Aguardando chegada" (que é o status até o Pátio confirmar o carregamento).
 */
export function rotuloStatusRemetido(status: string, chegadaPortariaEm: Date | string | null | undefined): { texto: string; badge: string } {
  if (status === 'AGUARDANDO_CHEGADA' && chegadaPortariaEm) return { texto: 'Na portaria', badge: 'badge-warn' };
  const mapa: Record<string, { texto: string; badge: string }> = {
    AGUARDANDO_CHEGADA: { texto: 'Aguardando chegada', badge: 'badge-muted' },
    PENDENTE_CONFERENCIA: { texto: 'Pendente de conferência', badge: 'badge-warn' },
    CONFERIDO: { texto: 'Conferido', badge: 'badge-ok' },
  };
  return mapa[status] ?? { texto: status, badge: 'badge-muted' };
}
