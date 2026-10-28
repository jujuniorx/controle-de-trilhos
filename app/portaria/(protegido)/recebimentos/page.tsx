import { requirePortaria } from '@/lib/services/requirePortaria';
import { listarChegadasPortaria } from '@/lib/services/chegada';
import { listarOrigensUsadas } from '@/lib/services/origensUsadas';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { SaudacaoPortaria, linhaResumo } from '@/components/portaria/SaudacaoPortaria';
import { chavePublicaPush } from '@/lib/services/push';
import { BotaoNovaChegada } from './BotaoNovaChegada';
import { CartaoChegada } from './CartaoChegada';

export const dynamic = 'force-dynamic';

export default async function PortariaRecebimentosPage() {
  const { nome } = await requirePortaria();
  const [itens, origens] = await Promise.all([listarChegadasPortaria(), listarOrigensUsadas()]);
  // Grupos por situação; dentro de cada grupo, a chegada mais recente primeiro (pela hora de chegada, não de cadastro).
  const ordem = { RECEBIDA: 0, AGUARDANDO_LIBERACAO: 1, LIBERADA: 2, SAIU: 3, CANCELADA: 4 } as const;
  const momento = (c: (typeof itens)[number]) => (c.liberadaEm ?? c.criadoEm).getTime();
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado] || momento(b) - momento(a));
  const paraRegistrar = itens.filter((i) => i.estado === 'AGUARDANDO_LIBERACAO').length;
  const aguardandoPatio = itens.filter((i) => i.estado === 'LIBERADA').length;
  const podemSair = itens.filter((i) => i.estado === 'RECEBIDA').length;

  return (
    <div className="portaria-tela mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={20} />
      <SaudacaoPortaria
        nome={nome}
        linha={linhaResumo(
          [
            { n: podemSair, singular: 'pode sair', plural: 'podem sair' },
            { n: aguardandoPatio, singular: 'aguardando o Pátio', plural: 'aguardando o Pátio' },
          ],
          'Nenhum caminhão pedindo ação agora.',
        )}
      />

      <div className="space-y-1">
        <h1 className="page-title">Descarga</h1>
        <p className="text-sm text-ink-muted">Caminhões que chegam para descarregar. Toque num cartão para ver e preencher os dados.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Para registrar</p>
          <p className="stat-value">
            <ContadorAnimado valor={paraRegistrar} />
          </p>
          <p className="stat-unit">chegadas sem registro</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Aguardando o Pátio</p>
          <p className="stat-value">
            <ContadorAnimado valor={aguardandoPatio} />
          </p>
          <p className="stat-unit">já registradas</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Podem sair</p>
          <p className={`stat-value ${podemSair > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={podemSair} />
          </p>
          <p className="stat-unit">já descarregados</p>
        </div>
      </div>

      <ol className="list-decimal space-y-1.5 rounded-xl bg-surface-2 py-3 pl-9 pr-4 text-sm text-ink-muted">
        <li>Chegou o caminhão? Toque em “Nova chegada”, preencha e toque em “Registrar chegada” (basta uma placa).</li>
        <li>O Pátio descarrega.</li>
        <li>Quando ele passar pela portaria, toque em “Saída confirmada”.</li>
      </ol>

      <BotaoNovaChegada />

      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Avisos do Pátio" descricao="Receba um aviso neste aparelho quando o Pátio liberar uma carreta ou terminar de descarregar um caminhão." ocultarQuandoLigado />

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum caminhão aguardando" texto="Toque em “Nova chegada” quando um caminhão chegar." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoChegada key={item.id} item={item} origens={origens} />
          ))}
        </div>
      )}
    </div>
  );
}
