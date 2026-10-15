import { listarChegadasPortaria } from '@/lib/services/chegada';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { BotaoNovaChegada } from './BotaoNovaChegada';
import { CartaoChegada } from './CartaoChegada';

export const dynamic = 'force-dynamic';

export default async function PortariaRecebimentosPage() {
  const itens = await listarChegadasPortaria();
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <AtualizarAuto segundos={20} />
      <div>
        <h1 className="font-condensed text-xl font-bold uppercase tracking-wide">Caminhões chegando (recebimento)</h1>
        <p className="text-sm text-ink-muted">
          Quando o caminhão chegar, cadastre os dados e libere para o Pátio descarregar. Para liberar é preciso a placa do
          cavalo ou da carreta — o resto é opcional.
        </p>
      </div>
      <BotaoNovaChegada />
      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum caminhão aguardando" texto="Toque em “Nova chegada” quando um caminhão chegar." />
      ) : (
        itens.map((item) => <CartaoChegada key={item.id} item={item} />)
      )}
    </main>
  );
}
