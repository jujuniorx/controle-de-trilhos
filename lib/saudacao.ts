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

const FRASES_POR_MOMENTO: Record<string, string[]> = {
  madrugada: ['Boa madrugada', 'Que madrugada produtiva'],
  manha: ['Bom dia', 'Bom dia, bora render', 'Boa manhã de trabalho'],
  tarde: ['Boa tarde', 'Boa tarde, bom trabalho', 'Boa tarde, seguimos firme'],
  noite: ['Boa noite', 'Boa noite, bom descanso'],
  segunda: ['Boa segunda', 'Bora começar a semana', 'Segunda de trilhos no lugar'],
  sexta: ['Boa sexta', 'Feliz sexta-feira', 'Chegamos na sexta'],
  fimDeSemana: ['Bom fim de semana', 'Aproveite o fim de semana'],
};

/**
 * Saudação que revezar a cada abertura: sorteia entre frases do mesmo momento
 * (madrugada, manhã, tarde, noite, segunda, sexta, fim de semana).
 * `escolher` devolve um número entre 0 e 1; por padrão é aleatório (testes passam um valor fixo).
 */
export function saudacaoRotativa(agora: Date = new Date(), escolher: () => number = Math.random): string {
  const { hora, diaSemana } = momentoBrasilia(agora);
  const chave =
    diaSemana === 0 || diaSemana === 6 ? 'fimDeSemana'
    : diaSemana === 5 ? 'sexta'
    : diaSemana === 1 ? 'segunda'
    : hora < 6 ? 'madrugada'
    : hora < 12 ? 'manha'
    : hora < 18 ? 'tarde'
    : 'noite';
  const frases = FRASES_POR_MOMENTO[chave];
  const indice = Math.min(frases.length - 1, Math.floor(escolher() * frases.length));
  return frases[indice];
}
