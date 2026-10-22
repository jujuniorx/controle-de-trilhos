import { requireDono } from '@/lib/services/requireAdmin';
import { listarPilhasPatio } from '@/lib/services/pilhasPatio';
import { EditorPilhas } from '@/components/pilhas/EditorPilhas';
import { criarPilhaAction, removerPilhaAction, salvarPilhaAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function PilhasDonoPage() {
  await requireDono();
  const pilhas = await listarPilhasPatio();
  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide text-ink">Pilhas do pátio</h1>
        <p className="text-sm text-ink-muted">Mesma lista que o Pátio preenche. Visível só para o dono.</p>
      </header>
      <EditorPilhas
        iniciais={pilhas}
        acoes={{ criar: criarPilhaAction, salvar: salvarPilhaAction, remover: removerPilhaAction }}
      />
    </main>
  );
}
