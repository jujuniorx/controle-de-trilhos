import { listarFatoresCadastrados } from '@/lib/services/calculo';
import { buscarChegadaLiberada } from '@/lib/services/chegada';
import { RecebimentoWizard } from './RecebimentoWizard';

export default async function NovoRecebimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametro = (await searchParams).chegada;
  const chegadaId = typeof parametro === 'string' ? parametro : null;
  const [fatores, chegada] = await Promise.all([
    listarFatoresCadastrados(),
    // Só pré-preenche se a Portaria já liberou e o caminhão ainda não foi descarregado.
    chegadaId ? buscarChegadaLiberada(chegadaId).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <>
      {chegada?.observacao && (
        <aside role="note" className="card mx-auto mt-4 max-w-md border-2 border-warn bg-warn/10 p-4 lg:max-w-xl">
          <p className="text-sm font-semibold text-warn">Observação da Portaria</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{chegada.observacao}</p>
        </aside>
      )}
      <RecebimentoWizard fatoresCadastrados={fatores} chegada={chegada} />
    </>
  );
}
