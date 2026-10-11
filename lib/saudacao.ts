/** "Bom dia" / "Boa tarde" / "Boa noite" pelo horário de Brasília. */
export function saudacao(agora: Date = new Date()): string {
  const hora = Number(agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24;
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}
