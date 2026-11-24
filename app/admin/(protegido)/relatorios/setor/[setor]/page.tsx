import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/services/requireAdmin';
import {
  ehSetor,
  hojeSP,
  periodoDoRelatorio,
  montarRelatorioSetor,
  MESES_LONGOS,
  nomeSetor,
} from '@/lib/services/relatorioSetor';
import { GraficoSetor, formatarNumero } from '@/components/relatorios/GraficoSetor';
import { BaixarImagemSerra } from '@/components/relatorios/BaixarImagemSerra';
import { alertasDoSetor } from '@/lib/services/alertasSetor';

export const dynamic = 'force-dynamic';

/** Relatório de um setor por ano inteiro ou por mês, com imagem (PNG) para mandar a quem precisa. */
export default async function RelatorioSetorPage({
  params,
  searchParams,
}: {
  params: Promise<{ setor: string }>;
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  await requireAdmin();
  const { setor } = await params;
  if (!ehSetor(setor)) notFound();

  const { ano: anoPedido, mes: mesPedido } = await searchParams;
  const hoje = hojeSP();
  const periodo = periodoDoRelatorio(anoPedido, mesPedido, hoje);
  const r = await montarRelatorioSetor(setor, periodo);
  const alertas = await alertasDoSetor(r, hoje);
  const anoAtual = Number(hoje.slice(0, 4));
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];
  const sufixoMes = periodo.mes ? `-${String(periodo.mes).padStart(2, '0')}` : '';
  const nomeArquivo = `relatorio-${setor}-${periodo.ano}${sufixoMes}.png`;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{nomeSetor(setor)}</h1>
          <p className="page-sub">Relatório do setor por ano ou por mês. Baixe a imagem para mandar ao gerente.</p>
        </div>
        <Link href="/admin/relatorios" className="btn btn-secondary">Voltar aos relatórios</Link>
      </div>

      <div className="card flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Período do relatório">
          <label className="flex flex-col gap-1">
            <span className="field-label">Ano</span>
            <select name="ano" defaultValue={periodo.ano} className="h-11">
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Mês</span>
            <select name="mes" defaultValue={periodo.mes ?? ''} className="h-11">
              <option value="">Ano inteiro</option>
              {MESES_LONGOS.map((m, i) => (
                <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-secondary h-11">Gerar</button>
        </form>
        <BaixarImagemSerra svgId="grafico-setor" nomeArquivo={nomeArquivo} />
      </div>

      <p className="text-sm text-ink-muted">
        {periodo.rotulo}
        {periodo.parcial && ' · período em andamento, ainda não fechado'}
      </p>

      {alertas.length > 0 && (
        <section className="card space-y-3" aria-label="Conferir antes de gerar">
          <h2 className="card-title">Conferir antes de gerar</h2>
          {alertas.map((a) => (
            <div
              key={a.titulo}
              className="rounded-lg px-3 py-2"
              style={{ borderLeft: `4px solid ${a.nivel === 'forte' ? '#e5484d' : '#e8b923'}`, background: 'var(--card, #141c36)' }}
            >
              <p className="font-semibold">{a.titulo}</p>
              <p className="text-sm text-ink-muted">{a.detalhe}</p>
            </div>
          ))}
        </section>
      )}

      {r.linhas.length === 0 ? (
        <div className="card">Período ainda não começou.</div>
      ) : (
        <div className="card overflow-x-auto p-0" style={{ background: '#ffffff' }}>
          <div style={{ minWidth: 720 }}>
            <GraficoSetor r={r} id="grafico-setor" />
          </div>
        </div>
      )}

      <p className="text-xs text-ink-dim">
        Total do período: {r.colunas.map((c, i) => `${c.rotulo} ${formatarNumero(r.totais[i] ?? 0, c.casas)} ${c.unidade}`).join(' · ')}
      </p>
    </main>
  );
}
