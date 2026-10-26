// Períodos do Relatório da usina: dia, semana (segunda a domingo) e mês. Datas 'AAAA-MM-DD', sem fuso.
// A sexta não entra: o que foi feito na sexta só se sabe na segunda seguinte.
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

/** Faixa da semana da data, segunda a domingo, no formato dd/mm a dd/mm/aaaa. */
export function faixaSemanaSegSex(iso: string): string {
  const inicio = inicioDaSemana(iso);
  const fim = somarDias(inicio, 6);
  const br = (x: string) => x.split('-').reverse().join('/');
  return `${br(inicio).slice(0, 5)} a ${br(fim)}`;
}

/** Formato do relatório: semanal (uma tabela com a semana) ou diário (um número por dia). */
export type ModoRelatorio = 'semanal' | 'diario';

export function modoValido(v: string | undefined): ModoRelatorio {
  return v === 'diario' ? 'diario' : 'semanal';
}

/** Seletor semanal/diário: dois links que trocam o formato mantendo o dia e o setor. */
export function linksModo(base: string, modoAtual: ModoRelatorio, params: Record<string, string>): { modo: ModoRelatorio; rotulo: string; href: string; ativo: boolean }[] {
  return (['semanal', 'diario'] as const).map((modo) => {
    const qs = new URLSearchParams({ ...params, modo }).toString();
    return { modo, rotulo: modo === 'semanal' ? 'Semanal' : 'Diário', href: `${base}?${qs}`, ativo: modo === modoAtual };
  });
}
