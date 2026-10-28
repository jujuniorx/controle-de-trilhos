const FUSO = 'America/Sao_Paulo';

/** Dia (AAAA-MM-DD) no fuso de São Paulo, para comparar dias sem erro de fuso. */
function diaDe(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: FUSO });
}

/**
 * Data e hora de um lançamento de forma legível: "hoje 11:29", "ontem 14:13" ou "26/10 07:42".
 * Quem olha a lista precisa saber o dia, não só a hora (um caminhão de ontem não pode parecer de hoje).
 */
export function quandoLegivel(valor: Date | string | null | undefined, agora: Date = new Date()): string {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
  const dia = diaDe(d);
  if (dia === diaDe(agora)) return `hoje ${hora}`;
  if (dia === diaDe(new Date(agora.getTime() - 24 * 60 * 60 * 1000))) return `ontem ${hora}`;
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });
  return `${data} ${hora}`;
}
