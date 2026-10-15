import { listarChegadasPortaria } from '@/lib/services/chegada';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { BotaoNovaChegada } from './BotaoNovaChegada';
import { CartaoChegada } from './CartaoChegada';

export const dynamic = 'force-dynamic';

export default async function PortariaRecebimentosPage() {
  const itens = await listarChegadasPortaria();
  const aguardando = itens.filter((i) => i.estado === 'AGUARDANDO_LIBERACAO').length;
  const liberadas = itens.filter((i) => i.estado === 'LIBERADA').length;
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={20} />
      <div className="page-header !mb-0">
        <h1 className="page-title">Caminhões chegando (recebimento)</h1>
        <BotaoNovaChegada />
      </div>

      <div className="pend-resumo">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Aguardando liberação</p>
          <p className={`stat-value ${aguardando > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={aguardando} />
          </p>
          <p className="stat-unit">na portaria</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Liberados</p>
          <p className="stat-value">
            <ContadorAnimado valor={liberadas} />
          </p>
          <p className="stat-unit">esperando o Pátio</p>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Quando o caminhão chegar, cadastre os dados e libere para o Pátio descarregar. Para liberar é preciso a placa do cavalo ou
        da carreta — o resto é opcional.
      </p>

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum caminhão aguardando" texto="Toque em “Nova chegada” quando um caminhão chegar." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoChegada key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
