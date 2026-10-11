import Link from 'next/link';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { PreCadastrosPendentes } from './PreCadastrosPendentes';
import { AvisoSucesso } from '@/components/ui/AvisoSucesso';
import { EstadoVazio } from '@/components/ui/EstadoVazio';

const MENSAGEM_SALVO: Record<string, string> = {
  cadastro: 'Remetido cadastrado!',
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
  const remetidos = await listarAguardandoChegada();

  return (
    <main className="mx-auto max-w-md lg:max-w-xl p-6">
      <AvisoSucesso mensagem={mensagem} />
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Remetidos</h1>

      <Link href="/patio/remetidos/novo" className="btn btn-primary mt-4 h-12">
        + Novo remetido
      </Link>

      <h2 className="mt-6 font-condensed text-base font-bold uppercase tracking-wide text-ink">Aguardando chegada</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <div className="mt-3 space-y-2">
        <PreCadastrosPendentes />
        {remetidos.map((r) => (
          <Link key={r.id} href={`/patio/remetidos/${r.id}/confirmar`} className="card block transition hover:brightness-110">
            <p className="font-medium text-ink">{r.destino ?? 'Remetido'}</p>
            <p className="text-sm text-ink-muted">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
              {r.reservaPedido ? ` · Reserva ${r.reservaPedido}` : ''}
            </p>
            {r.numeroDocumento && <p className="text-sm text-ink-dim">NF {r.numeroDocumento}</p>}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <EstadoVazio titulo="Nenhum remetido aguardando chegada" texto="Quando cadastrar um, ele aparece aqui." />
        )}
      </div>
    </main>
  );
}
