import Link from 'next/link';
import { resumoAreasEstoque } from '@/lib/services/estoqueAreas';

const ROTULO_TIPO: Record<string, string> = { ENTRADA: 'Entrada', BAIXA: 'Baixa', AJUSTE: 'Ajuste' };

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Uma linha por sala: materiais, zerados, atividade da semana e o último movimento. */
export async function ResumoEstoque() {
  const resumos = await resumoAreasEstoque();
  return (
    <section className="space-y-6" aria-labelledby="resumo-estoque">
      <div>
        <h2 id="resumo-estoque" className="section-title">Resumo das salas</h2>
        <p className="text-sm text-ink-muted">Visão geral de cada área. A atividade considera os últimos 7 dias.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resumos.map((r) => (
          <article key={r.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-ink">{r.nome}</p>
              <Link href={`/admin/estoque?area=${r.id}`} className="text-sm font-semibold text-accent">Abrir</Link>
            </div>
            <dl className="grid grid-cols-2 gap-3 tabular-nums">
              <div>
                <dt className="kv-label">Materiais</dt>
                <dd className="text-2xl font-semibold">{r.materiais}</dd>
              </div>
              <div>
                <dt className="kv-label">Sem saldo</dt>
                <dd className="text-2xl font-semibold">{r.semSaldo}</dd>
              </div>
              <div>
                <dt className="kv-label">Entradas (7 dias)</dt>
                <dd className="font-semibold">{r.entradas7d}</dd>
              </div>
              <div>
                <dt className="kv-label">Baixas (7 dias)</dt>
                <dd className="font-semibold">{r.baixas7d}</dd>
              </div>
            </dl>
            <div className="border-t border-line pt-3 text-sm">
              <p className="kv-label">Último movimento</p>
              {r.ultimoMovimento ? (
                <p className="mt-1">
                  <span className="font-semibold">{ROTULO_TIPO[r.ultimoMovimento.tipo] ?? r.ultimoMovimento.tipo}</span> de {r.ultimoMovimento.material}
                  <span className="block text-xs text-ink-muted">{quando(r.ultimoMovimento.quando)} · {r.ultimoMovimento.responsavel}</span>
                </p>
              ) : (
                <p className="mt-1 text-ink-muted">Nenhum movimento ainda.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
