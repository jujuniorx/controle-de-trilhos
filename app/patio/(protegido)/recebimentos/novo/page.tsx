import { listarFatoresCadastrados } from '@/lib/services/calculo';
import { RecebimentoWizard } from './RecebimentoWizard';

export default async function NovoRecebimentoPage() {
  const fatores = await listarFatoresCadastrados();
  return <RecebimentoWizard fatoresCadastrados={fatores} />;
}
