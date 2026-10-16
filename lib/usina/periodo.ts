// Períodos do Relatório da usina: dia, semana (segunda a domingo) e mês. Datas 'AAAA-MM-DD', sem fuso.
import { somarDias } from '@/lib/usina/diasUteis';

export type Periodo = 'dia' | 'semana' | 'mes';

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Dia' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

export function ehIsoValido(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** Segunda-feira da semana que contém a data. */
export function inicioDaSemana(iso: string): string {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const deslocamento = dia === 0 ? -6 : 1 - dia;
  return somarDias(iso, deslocamento);
}

export function intervaloDoPeriodo(periodo: Periodo, data: string): { inicio: string; fim: string } {
  if (periodo === 'dia') return { inicio: data, fim: data };
  if (periodo === 'semana') {
    const inicio = inicioDaSemana(data);
    return { inicio, fim: somarDias(inicio, 6) };
  }
  const [ano, mes] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` };
}
