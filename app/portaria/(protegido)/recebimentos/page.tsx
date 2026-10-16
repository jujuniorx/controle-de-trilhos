import { listarChegadasPortaria } from '@/lib/services/chegada';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { chavePublicaPush } from '@/lib/services/push';
import { BotaoNovaChegada } from './BotaoNovaChegada';
import { CartaoChegada } from './CartaoChegada';

export const dynamic = 'force-dynamic';

export default async function PortariaRecebimentosPage() {
  const itens = await listarChegadasPortaria();
  const ordem = { RECEBIDA: 0, AGUARDANDO_LIBERACAO: 1, LIBERADA: 2, SAIU: 3, CANCELADA: 4 } as const;
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado]);
  const podemSair = itens.filter((i) => i.estado === 'RECEBIDA').length;
  const aguardandoPatio = itens.filter((i) => i.estado === 'LIBERADA').length;
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={20} />
      <div className="page-header !mb-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <h1 className="page-title">Caminhões chegando (descarga)</h1>
        <BotaoNovaChegada />
      </div>

      <div className="pend-resumo">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Podem sair</p>
          <p className={`stat-value ${podemSair > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={podemSair} />
          </p>
          <p className="stat-unit">já descarregados</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Aguardando o Pátio</p>
          <p className="stat-value">
            <ContadorAnimado valor={aguardandoPatio} />
          </p>
          <p className="stat-unit">já chegaram</p>
        </div>
      </div>

      <ol className="list-decimal space-y-1.5 rounded-xl bg-surface-2 py-3 pl-9 pr-4 text-sm text-ink-muted">
        <li>Chegou o caminhão? Toque em “Nova chegada”, preencha e toque em “Registrar chegada” (basta uma placa).</li>
        <li>O Pátio descarrega.</li>
        <li>Quando ele passar pela portaria, toque em “Saída confirmada”.</li>
      </ol>

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum caminhão aguardando" texto="Toque em “Nova chegada” quando um caminhão chegar." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoChegada key={item.id} item={item} />
          ))}
        </div>
      )}
      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Avisos do Pátio" descricao="Receba um aviso neste aparelho quando o Pátio liberar uma carreta ou terminar de descarregar um caminhão." />
    </div>
  );
}
