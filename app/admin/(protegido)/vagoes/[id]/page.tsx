import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { buscarRemetidoVagao } from '@/lib/services/vagaoRemetido';
import { normalizarLocal } from '@/lib/domain/local';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { rotuloNfs, nfsEmTexto } from '@/lib/nf';
import { fatorPerfil } from '@/lib/estoque/trilhos';
import { HistoricoMovimentacao } from '@/components/admin/HistoricoMovimentacao';
import { IconeImprimir } from '@/components/icones/Icones';
import { EstoquePainel } from './EstoquePainel';

const TIPO_LABEL: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}
const fmt = (n: number, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export default async function RemetidoVagaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarRemetidoVagao(id);
  if (!mov) notFound();

  const linhas = mov.grupos.map((g) => {
    const tls = pecasDoGrupo(g.medicoes);
    const metros = Number(g.metrosTotal);
    const toneladas = g.pesoInformado != null ? Number(g.pesoInformado) : g.pesoCalculado != null ? Number(g.pesoCalculado) : (metros * fatorPerfil(g.perfil));
    return { id: g.id, perfil: g.perfil, material: g.tipoMaterial === 'NOVO' ? 'Novo' : 'Reemprego', fabricante: g.fabricante ?? 'N/A', tls, metros, toneladas };
  });
  const total = linhas.reduce((t, l) => ({ tls: t.tls + l.tls, metros: t.metros + l.metros, toneladas: t.toneladas + l.toneladas }), { tls: 0, metros: 0, toneladas: 0 });
  const soma = (campo: 'pesoLiquido' | 'pesoBruto') => mov.vagoes.reduce((t, v) => t + (v[campo] != null ? Number(v[campo]) : 0), 0);
  const titulo = mov.numeroDocumento ? rotuloNfs(mov) : `${mov.trilheiro ?? 'Trilheiro'} · ${fmtData(mov.dataMovimentacao)}`;

  return (
    <main className="mx-auto w-full max-w-3xl xl:max-w-5xl space-y-4">
      <div>
        <Link href="/admin/vagoes" className="back-link">
          ← Voltar a Vagões
        </Link>
        <div className="page-header mt-1 !mb-0">
          <h1 className="page-title">Remetido de vagão — {titulo}</h1>
          <div className="flex items-center gap-2">
            <span className={`badge ${mov.movimentaEstoque ? 'badge-ok' : 'badge-muted'}`}>{mov.movimentaEstoque ? 'TIRA DO ESTOQUE' : 'SEM MEXER NO ESTOQUE'}</span>
            {/* <a> e não <Link>: o romaneio é um documento HTML puro (route handler). */}
            <a href={`/admin/remetidos/${mov.id}/romaneio`} className="btn btn-ghost btn-sm">
              <IconeImprimir size={15} /> Imprimir romaneio
            </a>
          </div>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Dados do B.O.</h2>
        <dl className="kv-grid">
          <div className="kv-item"><div className="kv-label">Data</div><div className="kv-val">{fmtData(mov.dataMovimentacao)}</div></div>
          <div className="kv-item"><div className="kv-label">Trilheiro</div><div className="kv-val font-mono">{mov.trilheiro ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Destino</div><div className="kv-val">{normalizarLocal(mov.destino)}</div></div>
          <div className="kv-item"><div className="kv-label">Tipo</div><div className="kv-val">{TIPO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Notas fiscais</div><div className="kv-val font-mono">{nfsEmTexto(mov) || '—'}</div></div>
          <div className="kv-item">
            <div className="kv-label">Valor da NF</div>
            <div className="kv-val font-mono">{mov.valorNf != null ? Number(mov.valorNf).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</div>
          </div>
          <div className="kv-item"><div className="kv-label">Lançado por</div><div className="kv-val">{mov.responsavelPatio ?? '—'}</div></div>
          {mov.observacao && (
            <div className="kv-item"><div className="kv-label">Observação</div><div className="kv-val whitespace-pre-wrap">{mov.observacao}</div></div>
          )}
        </dl>
      </section>

      <section className="card">
        <h2 className="card-title">TLS carregados</h2>
        <div className="tbl-wrap tbl-cards">
          <table>
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Material</th>
                <th>Fabricante</th>
                <th className="text-right">TLS</th>
                <th className="text-right">Metros</th>
                <th className="text-right">Toneladas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td data-label="Perfil">{l.perfil}</td>
                  <td data-label="Material">{l.material}</td>
                  <td data-label="Fabricante">{l.fabricante}</td>
                  <td data-label="TLS" className="text-right font-mono">{fmt(l.tls)}</td>
                  <td data-label="Metros" className="text-right font-mono">{fmt(l.metros)}</td>
                  <td data-label="Toneladas" className="text-right font-mono">{fmt(l.toneladas, 3)}</td>
                </tr>
              ))}
            </tbody>
            {linhas.length > 1 && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3}>Total</td>
                  <td className="text-right font-mono">{fmt(total.tls)}</td>
                  <td className="text-right font-mono">{fmt(total.metros)}</td>
                  <td className="text-right font-mono">{fmt(total.toneladas, 3)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Vagões</h2>
        {mov.vagoes.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum vagão registrado neste B.O.</p>
        ) : (
          <div className="tbl-wrap tbl-cards">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Série</th>
                  <th>Número</th>
                  <th className="text-right">P. líquido (t)</th>
                  <th className="text-right">P. bruto (t)</th>
                </tr>
              </thead>
              <tbody>
                {mov.vagoes.map((v, i) => (
                  <tr key={v.id}>
                    <td data-label="#">{i + 1}</td>
                    <td data-label="Série" className="font-mono">{v.serie}</td>
                    <td data-label="Número" className="font-mono">{v.numero}</td>
                    <td data-label="P. líquido (t)" className="text-right font-mono">{v.pesoLiquido != null ? fmt(Number(v.pesoLiquido), 2) : '—'}</td>
                    <td data-label="P. bruto (t)" className="text-right font-mono">{v.pesoBruto != null ? fmt(Number(v.pesoBruto), 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3}>{mov.vagoes.length} {mov.vagoes.length === 1 ? 'vagão' : 'vagões'}</td>
                  <td className="text-right font-mono">{fmt(soma('pesoLiquido'), 2)}</td>
                  <td className="text-right font-mono">{fmt(soma('pesoBruto'), 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="card-title">Estoque</h2>
        <EstoquePainel id={mov.id} movimenta={mov.movimentaEstoque} />
      </section>

      <section className="card">
        <h2 className="card-title">Histórico</h2>
        <HistoricoMovimentacao historico={mov.historico} />
      </section>
    </main>
  );
}
