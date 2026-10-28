import { requirePortaria } from '@/lib/services/requirePortaria';
import { listarPortaria } from '@/lib/services/portaria';
import { listarOrigensUsadas } from '@/lib/services/origensUsadas';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { SaudacaoPortaria, linhaResumo } from '@/components/portaria/SaudacaoPortaria';
import { LembretesSaidaPortaria } from './LembretesSaidaPortaria';
import { chavePublicaPush } from '@/lib/services/push';
import { CartaoPortaria } from './CartaoPortaria';
import { NovoEnvioPortaria } from './NovoEnvioPortaria';

export const dynamic = 'force-dynamic';

export default async function PortariaPage() {
  const { nome } = await requirePortaria();
  const [itens, origens] = await Promise.all([listarPortaria(), listarOrigensUsadas()]);
  // O que pede ação da Portaria primeiro: liberadas (confirmar saída), depois esperando a carreta chegar, depois o resto.
  const ordem = { LIBERADA: 0, AGUARDANDO_CARRETA: 1, CHEGOU: 2, SAIU: 3 } as const;
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado]);
  const esperando = itens.filter((i) => i.estado === 'AGUARDANDO_CARRETA').length;
  const aguardandoPatio = itens.filter((i) => i.estado === 'CHEGOU').length;
  const podemSair = itens.filter((i) => i.estado === 'LIBERADA').length;

  return (
    <div className="portaria-tela mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={15} />
      <SaudacaoPortaria
        nome={nome}
        linha={linhaResumo(
          [
            { n: podemSair, singular: 'pode sair', plural: 'podem sair' },
            { n: aguardandoPatio, singular: 'aguardando o Pátio', plural: 'aguardando o Pátio' },
          ],
          'Nenhuma carreta pedindo ação agora.',
        )}
      />

      <div className="space-y-1">
        <h1 className="page-title">Carga</h1>
        <p className="text-sm text-ink-muted">Carretas que saem carregadas. Toque num cartão para ver e preencher os dados.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Esperando chegar</p>
          <p className="stat-value">
            <ContadorAnimado valor={esperando} />
          </p>
          <p className="stat-unit">avisadas pelo Pátio</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Aguardando o Pátio</p>
          <p className="stat-value">
            <ContadorAnimado valor={aguardandoPatio} />
          </p>
          <p className="stat-unit">já chegaram</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Podem sair</p>
          <p className={`stat-value ${podemSair > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={podemSair} />
          </p>
          <p className="stat-unit">liberadas pelo Pátio</p>
        </div>
      </div>

      <ol className="list-decimal space-y-1.5 rounded-xl bg-surface-2 py-3 pl-9 pr-4 text-sm text-ink-muted">
        <li>Chegou a carreta? Encontre o envio na lista, preencha ao menos uma placa e toque em “Registrar chegada”.</li>
        <li>O Pátio carrega e libera a carreta.</li>
        <li>Quando ela passar pela portaria, toque em “Saída confirmada”.</li>
      </ol>
      <p className="-mt-3 text-sm text-ink-muted">Não achou o envio na lista? Use o botão abaixo.</p>

      <NovoEnvioPortaria origens={origens} />

      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Avisos do Pátio" descricao="Receba um aviso neste aparelho quando o Pátio liberar uma carreta ou terminar de descarregar um caminhão." ocultarQuandoLigado />

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhuma carga em andamento" texto="Quando o Pátio cadastrar uma carga, ela aparece aqui." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoPortaria key={item.id} item={item} origens={origens} />
          ))}
        </div>
      )}
      <LembretesSaidaPortaria />
    </div>
  );
}
