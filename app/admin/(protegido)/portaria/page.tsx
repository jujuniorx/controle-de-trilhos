import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { listarChegadasDaPortaria, listarRemetidosDaPortaria } from '@/lib/services/portaria-admin';
import { ROTULO_ESTADO, ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { BotaoApagar } from './BotaoApagar';
import { apagarChegadaAction, limparDadosPortariaAction } from './actions';

export const dynamic = 'force-dynamic';

const BADGE_REM = { MEDINDO: 'badge-muted', AGUARDANDO_CARRETA: 'badge-warn', LIBERADA: 'badge-ok' } as const;
const BADGE_CHEG = { AGUARDANDO_LIBERACAO: 'badge-warn', LIBERADA: 'badge-info', RECEBIDA: 'badge-ok', CANCELADA: 'badge-muted' } as const;

function dataHora(d: Date | null): string {
  return d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—';
}

function Obs({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
      <span className="font-semibold text-warn">Observação da Portaria: </span>
      {texto}
    </p>
  );
}

export default async function AdminPortariaPage() {
  const { role } = await requireAdmin();
  const dono = role === 'DONO';
  const [remetidos, chegadas] = await Promise.all([listarRemetidosDaPortaria(), listarChegadasDaPortaria()]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="page-title">Portaria</h1>
        <p className="text-sm text-ink-muted">O que a Portaria lançou: motorista, placas, liberações e observações. Só consulta.</p>
      </div>

      <section className="space-y-3">
        <h2 className="card-title !mb-0">Caminhões chegando (recebimento)</h2>
        {chegadas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma chegada registrada" texto="Quando a Portaria registrar um caminhão, ele aparece aqui." />
        ) : (
          chegadas.map((c) => (
            <article key={c.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{c.placaCarreta || c.placaCavalo || c.motoristaNome || 'Caminhão sem identificação'}</p>
                  <p className="text-sm text-ink-muted">
                    {c.origem ? `${c.origem} · ` : ''}chegou {dataHora(c.criadoEm)} · {c.criadoPor}
                  </p>
                </div>
                <span className={`badge ${BADGE_CHEG[c.estado]}`}>{ROTULO_ESTADO_CHEGADA[c.estado]}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {[c.transportadora, c.motoristaNome, c.placaCavalo && `cavalo ${c.placaCavalo}`, c.placaCarreta && `carreta ${c.placaCarreta}`]
                  .filter(Boolean)
                  .join(' · ') || 'Sem dados de motorista'}
              </p>
              {c.liberadaEm && (
                <p className="text-sm text-ink-muted">
                  Liberado {dataHora(c.liberadaEm)} por {c.liberadaPor}
                </p>
              )}
              <Obs texto={c.observacao} />
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/portaria/pdf-chegada/${c.id}`} download className="btn btn-ghost btn-sm">
                  Baixar PDF
                </a>
                {c.movimentacaoId && (
                  <Link href={`/admin/recebimentos/${c.movimentacaoId}`} className="btn btn-ghost btn-sm">
                    Ver recebimento
                  </Link>
                )}
                {dono && (
                  <BotaoApagar
                    rotulo="Apagar chegada"
                    aviso="Apagar esta chegada de vez? Não dá para desfazer."
                    acao={apagarChegadaAction.bind(null, c.id)}
                  />
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="card-title !mb-0">Remetidos</h2>
        {remetidos.length === 0 ? (
          <EstadoVazio titulo="Nada lançado em remetidos" texto="Aparecem aqui os remetidos com dados da Portaria." />
        ) : (
          remetidos.map((m) => (
            <article key={m.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{m.destino || 'Remetido'}</p>
                  <p className="text-sm text-ink-muted">
                    {m.reservaPedido ? `Reserva ${m.reservaPedido}` : ''}
                    {m.reservaPedido && m.numeroDocumento ? ' · ' : ''}
                    {m.numeroDocumento ? `NF ${m.numeroDocumento}` : ''}
                    {!m.reservaPedido && !m.numeroDocumento ? dataHora(m.createdAt) : ''}
                  </p>
                </div>
                <span className={`badge ${BADGE_REM[m.estado]}`}>{ROTULO_ESTADO[m.estado]}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {[m.transportadora, m.motoristaNome, m.placaCavalo && `cavalo ${m.placaCavalo}`, m.placaCarreta && `carreta ${m.placaCarreta}`]
                  .filter(Boolean)
                  .join(' · ') || 'Sem dados de motorista'}
              </p>
              {m.carretaLiberadaEm && (
                <p className="text-sm text-ink-muted">
                  Carreta liberada {dataHora(m.carretaLiberadaEm)} por {m.carretaLiberadaPor}
                </p>
              )}
              <Obs texto={m.observacaoPortaria} />
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/portaria/pdf/${m.id}`} download className="btn btn-ghost btn-sm">
                  Baixar PDF
                </a>
                <Link href={`/admin/remetidos/${m.id}`} className="btn btn-ghost btn-sm">
                  Ver remetido
                </Link>
                {dono && (
                  <BotaoApagar
                    rotulo="Apagar dados da Portaria"
                    aviso="Apagar motorista, placas, liberação e observação da Portaria deste remetido? O remetido em si continua."
                    acao={limparDadosPortariaAction.bind(null, m.id)}
                  />
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
