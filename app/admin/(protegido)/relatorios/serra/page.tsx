import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { relatorioSerra } from '@/lib/services/relatorioSerra';
import { GraficoSerra } from '@/components/relatorios/GraficoSerra';
import { BaixarImagemSerra } from '@/components/relatorios/BaixarImagemSerra';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Relatório da serra ("Trilhos 2026") para o gerente executivo: atualiza sozinho com as barras de W61 e W62 lançadas
 * na Usina. A data escolhida é o "atualizado em" (por padrão, hoje); dá para gerar de novo em qualquer dia.
 */
export default async function RelatorioSerraPage({ searchParams }: { searchParams: Promise<{ ate?: string }> }) {
  await requireAdmin();
  const { ate: pedido } = await searchParams;
  const hoje = hojeSP();
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(pedido ?? '') && pedido! <= hoje ? pedido! : hoje;
  const r = await relatorioSerra(ate);
  const nome = `relatorio-serra-${ate}.png`;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório da serra</h1>
          <p className="page-sub">
            Trilhos recolhidos na serra (W61 e W62) por mês, com a meta e o pendente. Atualiza sozinho com as barras
            lançadas na Usina; baixe a imagem para mandar ao gerente.
          </p>
        </div>
        <Link href="/admin/relatorios" className="btn btn-secondary">Voltar aos relatórios</Link>
      </div>

      <div className="card flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Data do relatório">
          <label className="flex flex-col gap-1">
            <span className="field-label">Atualizado em</span>
            <input type="date" name="ate" defaultValue={ate} max={hoje} />
          </label>
          <button type="submit" className="btn btn-secondary">Gerar</button>
          {ate !== hoje && <Link href="/admin/relatorios/serra" className="btn btn-ghost">Hoje</Link>}
        </form>
        <BaixarImagemSerra svgId="grafico-serra" nomeArquivo={nome} />
      </div>

      {r.meses.length === 0 ? (
        <div className="card">Ainda não há barras de W61 ou W62 lançadas na Usina neste ano.</div>
      ) : (
        <div className="card overflow-x-auto p-0" style={{ background: '#ffffff' }}>
          <div style={{ minWidth: 720 }}>
            <GraficoSerra r={r} id="grafico-serra" />
          </div>
        </div>
      )}
      {r.usouBase && (
        <p className="text-sm" style={{ color: 'var(--ink-muted, #9fb2c8)' }}>
          Setembro (448 barras de W61) vem do relatório anterior, porque esse mês não tem barras lançadas na Usina. Se
          lançarem setembro na Usina, o relatório passa a usar o que estiver lá.
        </p>
      )}
    </main>
  );
}
