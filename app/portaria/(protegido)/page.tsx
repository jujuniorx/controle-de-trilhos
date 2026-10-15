import { listarPortaria } from '@/lib/services/portaria';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { CartaoPortaria } from './CartaoPortaria';

export const dynamic = 'force-dynamic';

export default async function PortariaPage() {
  const itens = await listarPortaria();
  // Quem está pronto para a carreta chegar primeiro; depois os ainda em medição; liberadas por último.
  const ordem = { AGUARDANDO_CARRETA: 0, MEDINDO: 1, LIBERADA: 2 } as const;
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado]);

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <AtualizarAuto segundos={15} />
      <div>
        <h1 className="font-condensed text-xl font-bold uppercase tracking-wide">Remetidos aguardando carreta</h1>
        <p className="text-sm text-ink-muted">
          Preencha os dados do motorista e do caminhão quando ele chegar. Para liberar é preciso a placa do cavalo ou da
          carreta — o resto é opcional.
        </p>
      </div>
      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum remetido aguardando" texto="Quando o Pátio cadastrar um, ele aparece aqui." />
      ) : (
        itens.map((item) => <CartaoPortaria key={item.id} item={item} />)
      )}
    </main>
  );
}
