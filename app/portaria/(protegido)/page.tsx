import { requirePortaria } from '@/lib/services/requirePortaria';
import { listarPortaria } from '@/lib/services/portaria';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { CartaoPortaria } from './CartaoPortaria';

export const dynamic = 'force-dynamic';

function saudacao(): string {
  const h = Number(new Date().toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default async function PortariaPage() {
  const { nome } = await requirePortaria();
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  const itens = await listarPortaria();
  // Quem está pronto para a carreta chegar primeiro; depois os ainda em medição; liberadas por último.
  const ordem = { AGUARDANDO_CARRETA: 0, MEDINDO: 1, LIBERADA: 2 } as const;
  itens.sort((a, b) => ordem[a.estado] - ordem[b.estado]);
  const prontos = itens.filter((i) => i.estado === 'AGUARDANDO_CARRETA').length;
  const medindo = itens.filter((i) => i.estado === 'MEDINDO').length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <AtualizarAuto segundos={15} />
      <div className="boas-vindas">
        <div>
          <p className="boas-vindas-saudacao">
            {saudacao()}, {primeiroNome}
          </p>
          <h1 className="page-title">Remetidos aguardando carreta</h1>
        </div>
      </div>

      <div className="pend-resumo">
        <div className="stat-tile pend-tile">
          <p className="stat-label">Prontos para a carreta</p>
          <p className={`stat-value ${prontos > 0 ? 'accent' : ''}`}>
            <ContadorAnimado valor={prontos} />
          </p>
          <p className="stat-unit">medição concluída</p>
        </div>
        <div className="stat-tile pend-tile">
          <p className="stat-label">Em medição no Pátio</p>
          <p className="stat-value">
            <ContadorAnimado valor={medindo} />
          </p>
          <p className="stat-unit">ainda não liberam</p>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Preencha os dados do motorista e do caminhão quando ele chegar. Para liberar é preciso a placa do cavalo ou da carreta — o
        resto é opcional.
      </p>

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum remetido aguardando" texto="Quando o Pátio cadastrar um, ele aparece aqui." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoPortaria key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
