import Link from 'next/link';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { normalizarLocal } from '@/lib/domain/local';
import { PreCadastrosPendentes } from './PreCadastrosPendentes';
import { AvisoSucesso } from '@/components/ui/AvisoSucesso';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { chavePublicaPush } from '@/lib/services/push';
import { estadoPortaria } from '@/lib/domain/portaria';
import { listarCarretasLiberadasComNota } from '@/lib/services/notaEmitida';
import { quandoLegivel } from '@/lib/domain/quando';

const MENSAGEM_SALVO: Record<string, string> = {
  cadastro: 'Carga cadastrada!',
  carregamento: 'Carregamento registrado!',
};

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function RemetidosAguardandoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const salvo = (await searchParams).salvo;
  const mensagem = typeof salvo === 'string' ? MENSAGEM_SALVO[salvo] : undefined;
  const liberadasComNota = await listarCarretasLiberadasComNota();
  const remetidos = (await listarAguardandoChegada()).sort(
    (a, b) => Number(estadoPortaria(b) === 'CHEGOU') - Number(estadoPortaria(a) === 'CHEGOU'),
  );

  return (
    <main className="patio-tela mx-auto max-w-md lg:max-w-none p-6">
      <AvisoSucesso mensagem={mensagem} />
      <AtualizarAuto />
      <h1 className="font-condensed font-bold uppercase tracking-wide text-ink">Cargas</h1>

      <Link href="/patio/remetidos/novo" className="btn btn-primary mt-4 h-12">
        + Nova carga
      </Link>

      <h2 className="mt-6 font-condensed font-bold uppercase tracking-wide text-ink">Aguardando chegada</h2>
      {remetidos.length > 0 && (
        <p className="mt-1 text-sm text-ink-muted">
          Toque numa carga quando o caminhão chegar para confirmar o carregamento. Se ainda não chegou, o escritório avisa aqui quando a nota sair.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <PreCadastrosPendentes />
        {remetidos.map((r) => (
          <Link key={r.id} href={`/patio/remetidos/${r.id}/confirmar`} className="card patio-card-link block transition hover:brightness-110">
            <p className="font-medium text-ink">{normalizarLocal(r.destino) || 'Carga'}</p>
            <p className="text-sm text-ink-muted">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
              {r.reservaPedido ? ` · Reserva ${r.reservaPedido}` : ''}
            </p>
            {r.numeroDocumento && <p className="text-sm text-ink-dim">NF {r.numeroDocumento}</p>}
            {r.createdAt && <p className="text-sm text-ink-muted">Enviada {quandoLegivel(r.createdAt)}</p>}
            {r.observacaoPortaria && <p className="mt-1 text-sm text-warn">Portaria: {r.observacaoPortaria}</p>}
            {estadoPortaria(r) === 'CHEGOU' && <span className="badge badge-warn mt-1">Carreta na Portaria — pode carregar</span>}
            {estadoPortaria(r) === 'LIBERADA' && <span className="badge badge-ok mt-1">Carreta liberada — Portaria avisada</span>}
            {estadoPortaria(r) === 'LIBERADA' && r.notaEmitidaEm && <span className="badge badge-ok mt-1">Nota fiscal emitida</span>}
            {estadoPortaria(r) === 'LIBERADA' && !r.notaEmitidaEm && r.status === 'CONFERIDO' && <span className="badge badge-warn mt-1">Nota fiscal pendente</span>}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <EstadoVazio titulo="Nenhuma carga aguardando chegada" texto="Quando cadastrar uma, ela aparece aqui." />
        )}
      </div>
      {liberadasComNota.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Notas fiscais das carretas liberadas">
          <h2 className="font-condensed font-bold uppercase tracking-wide text-ink">Notas das carretas liberadas (últimos 3 dias)</h2>
          {liberadasComNota.map((c) => (
            <div key={c.id} className="card space-y-1">
              <p className="font-medium text-ink">{normalizarLocal(c.destino) || 'Carga'}{c.placaCarreta || c.placaCavalo ? ` · ${c.placaCarreta ?? c.placaCavalo}` : ''}</p>
              <p className="text-sm text-ink-muted">Liberada {quandoLegivel(c.carretaLiberadaEm)}</p>
              {c.notaEmitidaEm ? (
                <span className="badge badge-ok">Nota fiscal emitida{c.notaEmitidaPor ? ` por ${c.notaEmitidaPor}` : ''}</span>
              ) : c.status === 'CONFERIDO' ? (
                <span className="badge badge-warn">Nota fiscal pendente</span>
              ) : (
                <span className="badge badge-muted">Aguardando conferência para emitir a nota</span>
              )}
            </div>
          ))}
        </section>
      )}
      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Aviso de carreta na Portaria" descricao="Receba um aviso neste tablet quando a Portaria registrar a chegada de uma carreta ou de um caminhão." />
    </main>
  );
}
