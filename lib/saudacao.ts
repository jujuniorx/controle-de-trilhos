/** Hora (0–23) e dia da semana (0 = domingo) no horário de Brasília. */
function momentoBrasilia(agora: Date): { hora: number; diaSemana: number } {
  const hora = Number(agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24;
  const nomeDia = agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
  const diaSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nomeDia);
  return { hora, diaSemana };
}

/** "Bom dia" / "Boa tarde" / "Boa noite" (e "Boa madrugada") pelo horário de Brasília. */
export function saudacao(agora: Date = new Date()): string {
  const { hora } = momentoBrasilia(agora);
  if (hora < 6) return 'Boa madrugada';
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/**
 * Saudação do momento: no fim de semana, na segunda e na sexta a frase acompanha o dia;
 * nos demais dias vale só o horário. Sem nome — quem chama acrescenta o primeiro nome.
 */
export function saudacaoCompleta(agora: Date = new Date()): string {
  const { diaSemana } = momentoBrasilia(agora);
  if (diaSemana === 0 || diaSemana === 6) return 'Bom fim de semana';
  if (diaSemana === 5) return 'Boa sexta';
  if (diaSemana === 1) return 'Boa segunda';
  return saudacao(agora);
}
