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
export type ModoRelatorio = 'semanal' | 'diario' | 'mensal';

export function modoValido(v: string | undefined): ModoRelatorio {
  return v === 'diario' ? 'diario' : v === 'mensal' ? 'mensal' : 'semanal';
}

/** Mês da data até o próprio dia (mesmo critério da coluna No mês), no formato dd/mm/aaaa. */
export function mesAte(data: string): string {
  const [ano, mes] = data.split('-');
  return `01/${mes}/${ano} a ${data.split('-').reverse().join('/')}`;
}

/** Rótulo do período no topo do relatório: a semana, ou o dia escolhido quando o formato é diário. */
export function rotuloPeriodo(data: string, modo: ModoRelatorio): { titulo: string; valor: string } {
  if (modo === 'mensal') return { titulo: 'Mês', valor: mesAte(data) };
  if (modo === 'diario') {
    const nome = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date(`${data}T12:00:00Z`).getUTCDay()];
    return { titulo: 'Dia', valor: `${nome}, ${data.split('-').reverse().join('/')}` };
  }
  return { titulo: 'Semana (segunda a domingo)', valor: faixaSemanaSegSex(data) };
}

/** Seletor semanal/diário: dois links que trocam o formato mantendo o dia e o setor. */
export function linksModo(base: string, modoAtual: ModoRelatorio, params: Record<string, string>, comMensal = false): { modo: ModoRelatorio; rotulo: string; href: string; ativo: boolean }[] {
  const modos: ModoRelatorio[] = comMensal ? ['semanal', 'diario', 'mensal'] : ['semanal', 'diario'];
  const rotulos: Record<ModoRelatorio, string> = { semanal: 'Semanal', diario: 'Diário', mensal: 'Mensal' };
  return modos.map((modo) => {
    const qs = new URLSearchParams({ ...params, modo }).toString();
    return { modo, rotulo: rotulos[modo], href: `${base}?${qs}`, ativo: modo === modoAtual };
  });
}
