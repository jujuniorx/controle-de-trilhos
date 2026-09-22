import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return (
    <>
      <IndicadorSincronizacao />
      {children}
    </>
  );
}
