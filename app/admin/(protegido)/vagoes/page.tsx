import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { listarVagoes, type ItemListaVagao } from '@/lib/services/vagaoRemetido';
import { normalizarLocal } from '@/lib/domain/local';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { nfsEmTexto } from '@/lib/nf';
import { BotaoExcluirMovimentacao } from '@/components/admin/BotaoExcluirMovimentacao';
import { IconeMais } from '@/components/icones/Icones';

type Aba = 'remetidos' | 'recebidos';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}
const fmt = (n: number) => n.toLocaleString('pt-BR');

/** "40 TLS TR68 Novo Pangang" / "13 TLS TR60 Reemprego": o que o trilheiro levou, numa linha. */
function resumoTls(mov: ItemListaVagao): string {
  return mov.grupos
    .map((g) => `${fmt(pecasDoGrupo(g.medicoes))} TLS ${g.perfil} ${g.tipoMaterial === 'NOVO' ? `Novo${g.fabricante ? ` ${g.fabricante}` : ''}` : 'Reemprego'}`)
    .join(' · ');
}

/** Recebimento de vagão (Pátio): barras novas por perfil. */
function resumoBarras(mov: ItemListaVagao): string {
  const barras = mov.grupos.reduce((t, g) => t + pecasDoGrupo(g.medicoes), 0);
  const metros = mov.grupos.reduce((t, g) => t + Number(g.metrosTotal), 0);
  return `${fmt(barras)} ${barras === 1 ? 'barra' : 'barras'} · ${fmt(Math.round(metros))} m`;
}

export default async function VagoesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireAdmin();
  const { aba: abaParam } = await searchParams;
  const aba: Aba = abaParam === 'recebidos' ? 'recebidos' : 'remetidos';
  const itens = await listarVagoes(aba === 'remetidos' ? 'REMETIDO' : 'RECEBIMENTO');

  return (
    <main className="mx-auto w-full max-w-3xl xl:max-w-5xl space-y-4">
      <div className="page-header !mb-0">
        <h1 className="page-title">Vagões</h1>
        {aba === 'remetidos' && (
          <Link href="/admin/vagoes/lancar" className="btn btn-primary btn-sm">
            <IconeMais size={15} /> Lançar remetido
          </Link>
        )}
      </div>

      <nav className="est-chips" aria-label="Recebidos e remetidos">
        <Link href="/admin/vagoes?aba=remetidos" className="est-chip" aria-current={aba === 'remetidos' ? 'true' : undefined}>
          Remetidos
        </Link>
        <Link href="/admin/vagoes?aba=recebidos" className="est-chip" aria-current={aba === 'recebidos' ? 'true' : undefined}>
          Recebidos
        </Link>
      </nav>

      <section className="card">
        {aba === 'remetidos' ? (
          <p className="mb-3 text-sm text-ink-muted">B.O. do trilheiro lançado pelo Administrativo. Sai nos relatórios e no Excel de remetidos como VAGÕES.</p>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">Vagões de trilho novo que o Pátio registrou na chegada.</p>
        )}

        {itens.length === 0 ? (
          <p className="text-sm text-ink-muted">{aba === 'remetidos' ? 'Nenhum remetido de vagão lançado ainda.' : 'Nenhum vagão recebido ainda.'}</p>
        ) : (
          <div className="tbl-wrap tbl-cards tbl-acoes-fixas">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>{aba === 'remetidos' ? 'Trilheiro' : 'Vagão'}</th>
                  <th>NF</th>
                  <th>{aba === 'remetidos' ? 'Destino' : 'Responsável'}</th>
                  <th>{aba === 'remetidos' ? 'TLS' : 'Barras'}</th>
                  {aba === 'remetidos' && <th>Estoque</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Data">{fmtData(m.dataMovimentacao)}</td>
                    <td data-label={aba === 'remetidos' ? 'Trilheiro' : 'Vagão'} className="font-mono">
                      {aba === 'remetidos' ? m.trilheiro ?? '—' : (m.origem ?? '').replace(/^VAGÃO\s*/i, '') || '—'}
                    </td>
                    <td data-label="NF" className="font-mono">{nfsEmTexto(m) || '—'}</td>
                    <td data-label={aba === 'remetidos' ? 'Destino' : 'Responsável'} className="celula-nome">
                      {aba === 'remetidos' ? normalizarLocal(m.destino) : m.responsavelPatio ?? '—'}
                    </td>
                    <td data-label={aba === 'remetidos' ? 'TLS' : 'Barras'}>{aba === 'remetidos' ? resumoTls(m) : resumoBarras(m)}</td>
                    {aba === 'remetidos' && (
                      <td data-label="Estoque">
                        <span className={`badge whitespace-nowrap ${m.movimentaEstoque ? 'badge-ok' : 'badge-muted'}`}>{m.movimentaEstoque ? 'Tira do estoque' : 'Não mexe'}</span>
                      </td>
                    )}
                    <td className="text-right">
                      <div className="acoes-linha">
                        <Link href={aba === 'remetidos' ? `/admin/vagoes/${m.id}` : `/admin/recebimentos/${m.id}`} className="btn btn-ghost btn-sm">
                          Ver detalhes
                        </Link>
                        {aba === 'remetidos' && <BotaoExcluirMovimentacao id={m.id} rotulo={`Remetido do ${m.trilheiro ?? 'trilheiro'} de ${fmtData(m.dataMovimentacao)}`} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
