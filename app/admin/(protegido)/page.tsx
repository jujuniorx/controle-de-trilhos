import { nfsEmTexto, rotuloNfs } from '@/lib/nf';
import { BotaoExcluirMovimentacao } from '@/components/admin/BotaoExcluirMovimentacao';
import Link from 'next/link';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { normalizarLocal } from '@/lib/domain/local';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { saudacaoRotativa } from '@/lib/saudacao';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { chavePublicaPush } from '@/lib/services/push';

function fmtData(d: Date | null, fallback?: Date | null): string {
  if (d) return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  // Sem data da movimentação (ex.: chegada registrada pela Portaria antes da data): usa o dia do cadastro.
  return fallback ? fallback.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
}

function fmtHora(d: Date | null): string {
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
}

// Mapeia o status (valor armazenado no banco, intocado) para a variante visual
// do badge — só a aparência muda, nunca o valor persistido.
const STATUS_BADGE: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'badge-muted',
  PENDENTE_CONFERENCIA: 'badge-warn',
  CONFERIDO: 'badge-ok',
};

const STATUS_TEXTO: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente',
  CONFERIDO: 'Conferido',
};

export default async function AdminHomePage() {
  const { nome, role } = await requireAdmin();
  // O dono vê a saudação na Visão geral; aqui a tela vai direto ao que precisa conferir.
  const mostrarSaudacao = role !== 'DONO';
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  const [movimentacoes, aguardandoChegada] = await Promise.all([listarPendentesConferencia(), listarAguardandoChegada()]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      {mostrarSaudacao && (
      <section className="saudacao-hero">
        <FundoTrilhos />
        <div className="saudacao-hero-texto">
          <p className="saudacao-hero-saudacao">
            {saudacaoRotativa()}, {primeiroNome}
          </p>
          <p className="saudacao-hero-sub">
            {movimentacoes.length === 0
              ? 'Nada pendente para conferir agora.'
              : `${movimentacoes.length === 1 ? '1 movimentação para conferir' : `${movimentacoes.length} movimentações para conferir`}${aguardandoChegada.length > 0 ? `, e ${aguardandoChegada.length === 1 ? '1 remetido esperando chegar' : `${aguardandoChegada.length} remetidos esperando chegar`}` : ''}.`}
          </p>
        </div>
      </section>
      )}

      <div className="boas-vindas">
        <h1 className="page-title">Movimentações pendentes de conferência</h1>
        <Link href="/admin/relatorios" className="btn btn-ghost btn-sm">
          Relatórios
        </Link>
      </div>

      <div className="pend-resumo">
        <div className={`stat-tile pend-tile ${movimentacoes.length > 0 ? 'pend-tile-alerta' : ''}`}>
          <p className="stat-label">Aguardando conferência</p>
          <p className={`stat-value ${movimentacoes.length > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={movimentacoes.length} />
          </p>
          <p className="stat-unit">{movimentacoes.length === 1 ? 'movimentação' : 'movimentações'}</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Remetidos aguardando chegada</p>
          <p className="stat-value">
            <ContadorAnimado valor={aguardandoChegada.length} />
          </p>
          <p className="stat-unit">{aguardandoChegada.length === 1 ? 'pré-cadastro' : 'pré-cadastros'}</p>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap tbl-cards tbl-acoes-fixas">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Data</th>
                <th>NF</th>
                <th>Origem/Destino</th>
                <th>Caminhão</th>
                <th>Responsável</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id} data-mov-id={m.id} data-mov-rotulo={m.numeroDocumento ? rotuloNfs(m) : (m.destino ?? m.origem ?? 'Movimentação em aberto')}>
                  <td data-label="Tipo">
                    <span className="badge badge-info">{m.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</span>
                  </td>
                  <td data-label="Data">
                    <span className="data-hora">
                      {fmtData(m.dataMovimentacao, m.createdAt)}
                      <small>{fmtHora(m.createdAt)}</small>
                    </span>
                  </td>
                  <td data-label="NF" className="font-mono" title={nfsEmTexto(m) || undefined}>
                    {m.numeroDocumento ? (
                      <>
                        {m.numeroDocumento}
                        {(m.numerosDocumentoExtras?.length ?? 0) > 0 && (
                          <span className="badge badge-muted ml-1.5 !normal-case">+{m.numerosDocumentoExtras.length}</span>
                        )}
                      </>
                    ) : (
                      <span className="badge badge-muted">Em aberto</span>
                    )}
                  </td>
                  <td data-label="Origem/Destino" className="celula-nome">{normalizarLocal(m.tipo === 'RECEBIMENTO' ? m.origem : m.destino)}</td>
                  <td data-label="Caminhão">
                    {[m.placaCarreta, m.placaCarreta2, m.placaCavalo].some(Boolean) ? (
                      <span className="placas">
                        {[m.placaCarreta, m.placaCarreta2, m.placaCavalo].filter(Boolean).map((p) => (
                          <span key={p}>{p}</span>
                        ))}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Responsável" className="celula-nome">{m.responsavelPatio}</td>
                  <td data-label="Status">
                    <span className={`badge ${STATUS_BADGE[m.status] ?? 'badge-muted'}`}>
                      {STATUS_TEXTO[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="acoes-linha">
                      <Link
                        href={m.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${m.id}` : `/admin/remetidos/${m.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Conferir
                      </Link>
                      <BotaoExcluirMovimentacao id={m.id} rotulo={m.numeroDocumento ? rotuloNfs(m) : (m.destino ?? m.origem ?? 'Movimentação em aberto')} />
                    </div>
                  </td>
                </tr>
              ))}
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EstadoVazio titulo="Tudo conferido!" texto="Nenhuma movimentação pendente de conferência." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Avisos de carreta liberada" descricao="Receba um aviso neste aparelho quando o Pátio liberar uma carreta, para liberar a nota." />

      <div>
        <div className="page-header">
          <h2 className="page-title text-base">Remetidos aguardando chegada</h2>
        </div>
        <p className="-mt-4 mb-2 text-sm text-ink-muted">{aguardandoChegada.length === 1 ? '1 pré-cadastro aguardando' : `${aguardandoChegada.length} pré-cadastros aguardando`} o Pátio confirmar.</p>
        <div className="card">
          <div className="tbl-wrap tbl-cards tbl-acoes-fixas">
            <table>
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>NF</th>
                  <th>Enviado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {aguardandoChegada.map((r) => (
                  <tr key={r.id} data-mov-id={r.id} data-mov-rotulo={r.destino ?? r.reservaPedido ?? "Remetido aguardando chegada"}>
                    <td>{normalizarLocal(r.destino)}</td>
                    <td>{r.numeroDocumento ?? <span className="badge badge-muted">Em aberto</span>}</td>
                    <td>
                      <span className="data-hora">
                        {fmtData(null, r.createdAt)}
                        <small>{fmtHora(r.createdAt)}</small>
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="acoes-linha">
                        <Link href={`/admin/remetidos/${r.id}`} className="btn btn-ghost btn-sm">
                          Ver detalhes
                        </Link>
                        <BotaoExcluirMovimentacao id={r.id} rotulo={r.destino ?? r.reservaPedido ?? 'Remetido aguardando chegada'} />
                      </div>
                    </td>
                  </tr>
                ))}
                {aguardandoChegada.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EstadoVazio titulo="Nenhum remetido aguardando chegada" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
