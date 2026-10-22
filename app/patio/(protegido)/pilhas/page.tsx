import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { listarPilhasPatio } from '@/lib/services/pilhasPatio';
import { EditorPilhas } from '@/components/pilhas/EditorPilhas';
import { criarPilhaAction, removerPilhaAction, salvarPilhaAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function PilhasPatioPage() {
  await requirePatioAcesso();
  const pilhas = await listarPilhasPatio();
  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-6 sm:max-w-3xl lg:max-w-4xl">
      <header className="space-y-1">
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide text-ink">Pilhas do pátio</h1>
        <p className="text-sm text-ink-muted">
          Para cada pilha, escreva o nome que vocês usam no pátio e escolha o que tem nela. Não precisa informar quantidade.
          Cada campo é salvo ao sair dele.
        </p>
      </header>
      <EditorPilhas
        iniciais={pilhas}
        acoes={{ criar: criarPilhaAction, salvar: salvarPilhaAction, remover: removerPilhaAction }}
      />
    </main>
  );
}
