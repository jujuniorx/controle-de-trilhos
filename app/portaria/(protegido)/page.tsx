import { requirePortaria } from '@/lib/services/requirePortaria';
import { saudacaoCompleta } from '@/lib/saudacao';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { listarPortaria } from '@/lib/services/portaria';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { chavePublicaPush } from '@/lib/services/push';
import { CartaoPortaria } from './CartaoPortaria';
import { NovoEnvioPortaria } from './NovoEnvioPortaria';

export const dynamic = 'force-dynamic';

export default async function PortariaPage() {
  const { nome } = await requirePortaria();
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  const itens = await listarPortaria();
  // O que pede ação da Portaria primeiro: liberadas (confirmar saída), depois esperando a carreta chegar, depois o resto.
  const ordem = { LIBERADA: 0, AGUARDANDO_CARRETA: 1, CHEGOU: 2, SAIU: 3 } as const;
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado]);
  const podemSair = itens.filter((i) => i.estado === 'LIBERADA').length;
  const aguardandoPatio = itens.filter((i) => i.estado === 'CHEGOU').length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={15} />
      <section className="saudacao-hero">
        <FundoTrilhos />
        <div className="saudacao-hero-texto">
          <p className="saudacao-hero-saudacao">
            {saudacaoCompleta()}, {primeiroNome}
          </p>
          <p className="saudacao-hero-sub">
            {podemSair === 0 && aguardandoPatio === 0
              ? 'Nenhuma carreta pedindo ação agora.'
              : [
                  podemSair > 0 ? `${podemSair} ${podemSair === 1 ? 'pode sair' : 'podem sair'}` : null,
                  aguardandoPatio > 0 ? `${aguardandoPatio} aguardando o Pátio` : null,
                ]
                  .filter(Boolean)
                  .join(' e ') + '.'}
          </p>
        </div>
      </section>

      <div className="boas-vindas">
        <h1 className="page-title">Remetidos (carretas)</h1>
      </div>

      <div className="pend-resumo">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Podem sair</p>
          <p className={`stat-value ${podemSair > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={podemSair} />
          </p>
          <p className="stat-unit">liberadas pelo Pátio</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Aguardando o Pátio</p>
          <p className="stat-value">
            <ContadorAnimado valor={aguardandoPatio} />
          </p>
          <p className="stat-unit">já chegaram</p>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        1) Quando a carreta chegar, procure o envio na lista e toque em &ldquo;Registrar chegada&rdquo; (basta uma placa). Se ela não
        estiver na lista, toque em &ldquo;Carreta sem aviso do Pátio&rdquo;. 2) O Pátio carrega e libera. 3) Quando ela passar pela
        portaria, toque em &ldquo;Saída confirmada&rdquo;.
      </p>

      <NovoEnvioPortaria />

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum remetido em andamento" texto="Quando o Pátio cadastrar um, ele aparece aqui." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoPortaria key={item.id} item={item} />
          ))}
        </div>
      )}
      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Avisos do Pátio" descricao="Receba um aviso neste aparelho quando o Pátio liberar uma carreta ou terminar de descarregar um caminhão." />
    </div>
  );
}
