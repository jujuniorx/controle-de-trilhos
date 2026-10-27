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

const MENSAGEM_SALVO: Record<string, string> = {
  cadastro: 'Carga cadastrada!',
  carregamento: 'Carregamento registrado!',
};

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

function fmtHora(d: Date | null): string {
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
}

export default async function RemetidosAguardandoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const salvo = (await searchParams).salvo;
  const mensagem = typeof salvo === 'string' ? MENSAGEM_SALVO[salvo] : undefined;
  const remetidos = (await listarAguardandoChegada()).sort(
    (a, b) => Number(estadoPortaria(b) === 'CHEGOU') - Number(estadoPortaria(a) === 'CHEGOU'),
  );

  return (
    <main className="mx-auto max-w-md lg:max-w-none p-6">
      <AvisoSucesso mensagem={mensagem} />
      <AtualizarAuto />
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Cargas</h1>

      <Link href="/patio/remetidos/novo" className="btn btn-primary mt-4 h-12">
        + Nova carga
      </Link>

      <h2 className="mt-6 font-condensed text-base font-bold uppercase tracking-wide text-ink">Aguardando chegada</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <div className="mt-3 space-y-2">
        <PreCadastrosPendentes />
        {remetidos.map((r) => (
          <Link key={r.id} href={`/patio/remetidos/${r.id}/confirmar`} className="card block transition hover:brightness-110">
            <p className="font-medium text-ink">{normalizarLocal(r.destino) || 'Carga'}</p>
            <p className="text-sm text-ink-muted">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
              {r.reservaPedido ? ` · Reserva ${r.reservaPedido}` : ''}
            </p>
            {r.numeroDocumento && <p className="text-sm text-ink-dim">NF {r.numeroDocumento}</p>}
            {r.createdAt && <p className="text-xs text-ink-muted">Enviado às {fmtHora(r.createdAt)}</p>}
            {r.observacaoPortaria && <p className="mt-1 text-sm text-warn">Portaria: {r.observacaoPortaria}</p>}
            {estadoPortaria(r) === 'CHEGOU' && <span className="badge badge-warn mt-1">Carreta na Portaria — pode carregar</span>}
            {estadoPortaria(r) === 'LIBERADA' && <span className="badge badge-ok mt-1">Carreta liberada — Portaria avisada</span>}
            {estadoPortaria(r) === 'LIBERADA' && (r.notaEmitidaEm ? <span className="badge badge-ok mt-1">Nota fiscal emitida</span> : <span className="badge badge-warn mt-1">Nota fiscal pendente</span>)}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <EstadoVazio titulo="Nenhuma carga aguardando chegada" texto="Quando cadastrar uma, ela aparece aqui." />
        )}
      </div>
      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Aviso de carreta na Portaria" descricao="Receba um aviso neste tablet quando a Portaria registrar a chegada de uma carreta ou de um caminhão." />
    </main>
  );
}
