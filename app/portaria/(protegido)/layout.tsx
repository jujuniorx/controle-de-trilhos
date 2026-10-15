import { requirePortaria } from '@/lib/services/requirePortaria';
import { PortariaShell } from '@/components/portaria/PortariaShell';
import { sairPortariaAction } from './actions';

export default async function PortariaLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await requirePortaria();
  return (
    <PortariaShell nome={nome} sair={sairPortariaAction}>
      {children}
    </PortariaShell>
  );
}
