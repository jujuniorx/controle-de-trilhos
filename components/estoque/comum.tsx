import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconeMais } from '@/components/icones/Icones';
import { fmtNum, rotuloUnidade } from '@/lib/domain/estoque';
import type { MovimentoRecente } from '@/lib/services/estoqueAreas';

export function quandoCurto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function dataBr(dia: string | null): string {
  return dia ? dia.split('-').reverse().join('/') : '';
}

export function mesAnoBr(dia: string | null): string {
  return dia ? `${dia.slice(5, 7)}/${dia.slice(0, 4)}` : '';
}

/** "2.460 m", "340 pares", "48 barras". */
export function qtdTexto(q: number, unidade: string, categoria?: string | null): string {
  return `${fmtNum(q)} ${rotuloUnidade(unidade, categoria, q)}`;
}

export function Kpi({ rotulo, valor, nota, tom }: { rotulo: string; valor: ReactNode; nota?: ReactNode; tom?: 'alerta' | 'grave' }) {
  return (
    <div className={`est-kpi ${tom === 'alerta' ? 'est-kpi-alerta' : tom === 'grave' ? 'est-kpi-grave' : ''}`}>
      <span className="est-kpi-rotulo">{rotulo}</span>
      <span className="est-kpi-valor">{valor}</span>
      {nota ? <span className="est-kpi-nota">{nota}</span> : null}
    </div>
  );
}

export function TopoArea({ titulo, texto, areaId, rotuloNovo }: { titulo: string; texto: string; areaId: string; rotuloNovo: string }) {
  return (
    <section className="est-topo">
      <div>
        <h1 className="est-h1">{titulo}</h1>
        <p className="est-sub">{texto}</p>
      </div>
      <div className="est-acoes">
        <Link href={`/admin/estoque/novo?area=${encodeURIComponent(areaId)}`} className="btn btn-primary h-12">
          <IconeMais size={18} />
          {rotuloNovo}
        </Link>
      </div>
    </section>
  );
}

const ROTULO_MOV: Record<string, string> = { ENTRADA: 'Entrada', BAIXA: 'Baixa', AJUSTE: 'Ajuste', CALIBRACAO: 'Calibração' };

export function rotuloMovimento(tipo: string): string {
  return ROTULO_MOV[tipo] ?? tipo;
}

/** "+240 m", "−120 m", "= 340 pares". */
export function variacaoTexto(m: { tipo: string; quantidade: number; saldoApos: number; unidade: string; categoria?: string | null }): string {
  if (m.tipo === 'ENTRADA') return `+${qtdTexto(m.quantidade, m.unidade, m.categoria)}`;
  if (m.tipo === 'BAIXA') return `−${qtdTexto(m.quantidade, m.unidade, m.categoria)}`;
  if (m.tipo === 'CALIBRACAO') return 'calibrado';
  return `= ${qtdTexto(m.saldoApos, m.unidade, m.categoria)}`;
}

export function SinalMovimento({ tipo }: { tipo: string }) {
  const classe = tipo === 'ENTRADA' ? 'est-sinal-entrada' : tipo === 'AJUSTE' || tipo === 'CALIBRACAO' ? 'est-sinal-ajuste' : '';
  return (
    <span className={`est-sinal ${classe}`} aria-hidden="true">
      {tipo === 'ENTRADA' ? '+' : tipo === 'BAIXA' ? '−' : '='}
    </span>
  );
}

/** Lista de últimas movimentações (de uma área ou de todas). */
export function ListaMovimentos({ movimentos, mostrarArea = false, vazio }: { movimentos: MovimentoRecente[]; mostrarArea?: boolean; vazio: string }) {
  if (movimentos.length === 0) return <p className="text-sm text-ink-muted">{vazio}</p>;
  return (
    <ol className="est-lista-mov">
      {movimentos.map((m) => (
        <li key={m.id}>
          <SinalMovimento tipo={m.tipo} />
          <div className="min-w-0">
            <Link href={`/admin/estoque/material/${m.materialId}`} className="font-semibold text-ink hover:underline">
              {rotuloMovimento(m.tipo)} · {m.material}
            </Link>
            <p className="truncate text-xs text-ink-muted">
              {[mostrarArea ? m.area : null, m.documento ? `NF ${m.documento}` : null, m.motivo, m.responsavel].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-ink-muted">{quandoCurto(m.criadoEm)}</p>
          </div>
          <span className={`est-num text-sm font-semibold ${m.tipo === 'ENTRADA' ? 'est-txt-ok' : ''}`}>{variacaoTexto(m)}</span>
        </li>
      ))}
    </ol>
  );
}
