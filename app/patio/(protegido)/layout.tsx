import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { PatioShell } from '@/components/patio/PatioShell';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return <PatioShell>{children}</PatioShell>;
}
