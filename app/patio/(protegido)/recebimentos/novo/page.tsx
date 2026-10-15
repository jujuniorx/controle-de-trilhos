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
  return <RecebimentoWizard fatoresCadastrados={fatores} chegada={chegada} />;
}
