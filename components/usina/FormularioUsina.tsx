'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';

export interface ResultadoFormUsina {
  ok: boolean;
  erro?: string;
}

/** Formulário que grava com uma ação do servidor e mostra o resultado no próprio lugar. */
export function FormularioUsina({
  acao,
  children,
  rotuloBotao = 'Salvar',
}: {
  acao: (estadoAnterior: ResultadoFormUsina | undefined, formData: FormData) => Promise<ResultadoFormUsina>;
  children: ReactNode;
  rotuloBotao?: string;
}) {
  // Se o sistema foi atualizado com a tela aberta, a ação antiga não existe mais no servidor.
  // Sem este tratamento, o erro cai na tela "Não deu para carregar" e o que foi digitado se perde.
  const acaoSegura = async (estadoAnterior: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> => {
    try {
      return await acao(estadoAnterior, formData);
    } catch {
      return {
        ok: false,
        erro: 'Não foi salvo: esta tela está desatualizada. Recarregue a página (F5) e lance de novo.',
      };
    }
  };
  const [estado, acaoForm, pendente] = useActionState(acaoSegura, undefined);
  // "Sujo" = algo foi mexido e ainda não foi salvo. Avisa na tela e antes de fechar ou recarregar a página.
  const [sujo, setSujo] = useState(false);
  useEffect(() => { if (estado?.ok) setSujo(false); }, [estado]);
  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);
  return (
    <form action={acaoForm} className="space-y-3" data-sujo={sujo ? 'true' : undefined} onInput={() => setSujo(true)} onChange={() => setSujo(true)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary h-11" disabled={pendente}>
          {pendente ? 'Salvando...' : rotuloBotao}
        </button>
        {sujo && !pendente && <span role="status" className="form-sujo">Alterações ainda não salvas</span>}
        {estado?.ok && !sujo && <span role="status" className="text-sm text-ok">Salvo.</span>}
        {estado && !estado.ok && <span role="alert" className="text-sm text-bad">{estado.erro}</span>}
      </div>
    </form>
  );
}
