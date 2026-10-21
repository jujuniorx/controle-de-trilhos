import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { listarChegadasDaPortaria, listarRemetidosDaPortaria } from '@/lib/services/portaria-admin';
import { ROTULO_ESTADO, ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { BotaoApagar } from './BotaoApagar';
import { CartaoAdmin, type LinhaDado } from './CartaoAdmin';
import { apagarChegadaAction, limparDadosPortariaAction } from './actions';

export const dynamic = 'force-dynamic';

const BADGE_REM = { AGUARDANDO_CARRETA: 'badge-muted', CHEGOU: 'badge-warn', LIBERADA: 'badge-ok', SAIU: 'badge-info' } as const;
const BADGE_CHEG = { AGUARDANDO_LIBERACAO: 'badge-muted', LIBERADA: 'badge-warn', RECEBIDA: 'badge-ok', SAIU: 'badge-info', CANCELADA: 'badge-muted' } as const;

/** Situações que já terminaram: vão para o fim da lista. */
const ENCERRADAS_CHEG = new Set(['SAIU', 'CANCELADA']);
const ENCERRADAS_REM = new Set(['SAIU']);

function dataHora(d: Date | null): string {
  return d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—';
}

function veiculo(cavalo: string | null, carreta: string | null): string {
  return [cavalo && `cavalo ${cavalo}`, carreta && `carreta ${carreta}`].filter(Boolean).join(' · ') || '—';
}

function ordenar<T extends { estado: string; tempo: Date }>(itens: T[], encerradas: Set<string>): T[] {
  return [...itens].sort((a, b) => {
    const grupo = Number(encerradas.has(a.estado)) - Number(encerradas.has(b.estado));
    return grupo !== 0 ? grupo : b.tempo.getTime() - a.tempo.getTime();
  });
}

function Resumo({ emAndamento, encerrados }: { emAndamento: number; encerrados: number }) {
  return (
    <p className="text-sm text-ink-muted">
      <strong className="text-ink">{emAndamento}</strong> em andamento · <strong className="text-ink">{encerrados}</strong> já saíram
    </p>
  );
}

export default async function AdminPortariaPage() {
  const { role } = await requireAdmin();
  const dono = role === 'DONO';
  const [remetidos, chegadas] = await Promise.all([listarRemetidosDaPortaria(), listarChegadasDaPortaria()]);

  const chegadasOrdenadas = ordenar(
    chegadas.map((c) => ({ ...c, tempo: c.liberadaEm ?? c.criadoEm })),
    ENCERRADAS_CHEG,
  );
  const remetidosOrdenados = ordenar(
    remetidos.map((m) => ({ ...m, tempo: m.chegadaPortariaEm ?? m.createdAt })),
    ENCERRADAS_REM,
  );

  const chegadasEncerradas = chegadas.filter((c) => ENCERRADAS_CHEG.has(c.estado)).length;
  const remetidosEncerrados = remetidos.filter((m) => ENCERRADAS_REM.has(m.estado)).length;

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="page-title">Portaria</h1>
        <p className="text-sm text-ink-muted">O que a Portaria lançou. Só consulta; o dono pode apagar pelos botões de cada cartão.</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title !mb-0">Caminhões de recebimento</h2>
          <Resumo emAndamento={chegadas.length - chegadasEncerradas} encerrados={chegadasEncerradas} />
        </div>
        {chegadasOrdenadas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma chegada registrada" texto="Quando a Portaria registrar um caminhão, ele aparece aqui." />
        ) : (
          chegadasOrdenadas.map((c) => {
            const titulo = c.placaCarreta || c.placaCavalo || c.motoristaNome || 'Caminhão sem identificação';
            const dados: LinhaDado[] = [
              { rotulo: 'Motorista', valor: c.motoristaNome || '—' },
              { rotulo: 'Empresa', valor: c.transportadora || '—' },
              { rotulo: 'Veículo', valor: veiculo(c.placaCavalo, c.placaCarreta) },
              { rotulo: 'Registrou', valor: c.criadoPor || '—' },
              { rotulo: 'Liberada pela Portaria', valor: dataHora(c.liberadaEm) },
              { rotulo: 'Saiu', valor: c.saidaEm ? `${dataHora(c.saidaEm)}${c.saidaPor ? ` (${c.saidaPor})` : ''}` : '—' },
            ];
            return (
              <CartaoAdmin
                key={c.id}
                titulo={titulo}
                subtitulo={c.origem ?? null}
                situacao={ROTULO_ESTADO_CHEGADA[c.estado]}
                badge={BADGE_CHEG[c.estado]}
                dados={dados}
                observacao={c.observacao}
                acoes={
                  <>
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
                        rotulo="Apagar definitivamente"
                        aviso="Apagar esta chegada de vez? Não dá para desfazer."
                        acao={apagarChegadaAction.bind(null, c.id)}
                      />
                    )}
                  </>
                }
              />
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title !mb-0">Carretas de remetido</h2>
          <Resumo emAndamento={remetidos.length - remetidosEncerrados} encerrados={remetidosEncerrados} />
        </div>
        {remetidosOrdenados.length === 0 ? (
          <EstadoVazio titulo="Nada lançado em remetidos" texto="Aparecem aqui os remetidos com dados da Portaria." />
        ) : (
          remetidosOrdenados.map((m) => {
            const subtitulo = [m.reservaPedido && `Reserva ${m.reservaPedido}`, m.numeroDocumento && `NF ${m.numeroDocumento}`]
              .filter(Boolean)
              .join(' · ');
            const dados: LinhaDado[] = [
              { rotulo: 'Motorista', valor: m.motoristaNome || '—' },
              { rotulo: 'Empresa', valor: m.transportadora || '—' },
              { rotulo: 'Veículo', valor: veiculo(m.placaCavalo, m.placaCarreta) },
              { rotulo: 'Chegou na Portaria', valor: dataHora(m.chegadaPortariaEm) },
              { rotulo: 'Liberada pelo Pátio', valor: dataHora(m.carretaLiberadaEm) },
              { rotulo: 'Saiu', valor: m.saidaPortariaEm ? `${dataHora(m.saidaPortariaEm)}${m.saidaPortariaPor ? ` (${m.saidaPortariaPor})` : ''}` : '—' },
            ];
            return (
              <CartaoAdmin
                key={m.id}
                titulo={m.destino || 'Remetido'}
                subtitulo={subtitulo || null}
                situacao={ROTULO_ESTADO[m.estado]}
                badge={BADGE_REM[m.estado]}
                dados={dados}
                observacao={m.observacaoPortaria}
                acoes={
                  <>
                    <a href={`/portaria/pdf/${m.id}`} download className="btn btn-ghost btn-sm">
                      Baixar PDF
                    </a>
                    <Link href={`/admin/remetidos/${m.id}`} className="btn btn-ghost btn-sm">
                      Ver remetido
                    </Link>
                    {dono && (
                      <BotaoApagar
                        rotulo="Limpar dados da Portaria"
                        aviso="Apagar motorista, placas, horários e observação da Portaria deste remetido? O remetido em si continua."
                        acao={limparDadosPortariaAction.bind(null, m.id)}
                      />
                    )}
                  </>
                }
              />
            );
          })
        )}
      </section>
    </main>
  );
}
