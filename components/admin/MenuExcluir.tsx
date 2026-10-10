'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { excluirMovimentacaoAction } from '@/app/admin/(protegido)/actions-excluir';

interface Alvo {
  id: string;
  rotulo: string;
  x: number;
  y: number;
}

const SELETOR = 'tr[data-mov-id]';

/**
 * Menu de botão direito (e toque longo, no celular) sobre as linhas de movimentação
 * do Admin: "Excluir". Qualquer <tr data-mov-id data-mov-rotulo> ganha o menu.
 * A exclusão é definitiva, então sempre passa por uma confirmação.
 */
export function MenuExcluir() {
  const router = useRouter();
  const [menu, setMenu] = useState<Alvo | null>(null);
  const [confirmar, setConfirmar] = useState<Alvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function alvoDe(el: EventTarget | null, x: number, y: number): Alvo | null {
      const tr = (el as HTMLElement | null)?.closest?.(SELETOR) as HTMLElement | null;
      if (!tr?.dataset.movId) return null;
      return { id: tr.dataset.movId, rotulo: tr.dataset.movRotulo ?? 'esta movimentação', x, y };
    }
    function aoMenuContexto(e: MouseEvent) {
      const alvo = alvoDe(e.target, e.clientX, e.clientY);
      if (!alvo) return;
      e.preventDefault();
      setMenu(alvo);
    }
    function aoTocar(e: TouchEvent) {
      const t = e.touches[0];
      const alvo = alvoDe(e.target, t.clientX, t.clientY);
      if (!alvo) return;
      timer = setTimeout(() => setMenu(alvo), 650);
    }
    function cancelarToque() {
      if (timer) clearTimeout(timer);
    }
    function fechar() {
      setMenu(null);
    }
    document.addEventListener('contextmenu', aoMenuContexto);
    document.addEventListener('touchstart', aoTocar, { passive: true });
    document.addEventListener('touchend', cancelarToque);
    document.addEventListener('touchmove', cancelarToque, { passive: true });
    document.addEventListener('click', fechar);
    document.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('contextmenu', aoMenuContexto);
      document.removeEventListener('touchstart', aoTocar);
      document.removeEventListener('touchend', cancelarToque);
      document.removeEventListener('touchmove', cancelarToque);
      document.removeEventListener('click', fechar);
      document.removeEventListener('scroll', fechar, true);
    };
  }, []);

  function excluir() {
    if (!confirmar) return;
    const alvo = confirmar;
    setErro(null);
    iniciar(async () => {
      const r = await excluirMovimentacaoAction(alvo.id);
      if (r.ok) {
        setConfirmar(null);
        router.refresh();
      } else {
        setErro(r.erro ?? 'Não foi possível excluir.');
      }
    });
  }

  return (
    <>
      {menu && (
        <div
          role="menu"
          className="fixed z-50 min-w-[160px] rounded-xl border border-line-2 bg-surface p-1 shadow-lg"
          style={{ left: Math.min(menu.x, window.innerWidth - 180), top: Math.min(menu.y, window.innerHeight - 70) }}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-bad hover:bg-surface-2"
            onClick={() => {
              setConfirmar(menu);
              setErro(null);
              setMenu(null);
            }}
          >
            Excluir…
          </button>
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="excluir-titulo">
          <div className="w-full max-w-sm rounded-2xl border border-line-2 bg-surface p-5">
            <h2 id="excluir-titulo" className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">
              Excluir definitivamente?
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              <b className="text-ink">{confirmar.rotulo}</b> será apagado com todas as medições e o histórico. Isso não pode ser desfeito.
            </p>
            {erro && (
              <p role="alert" className="mt-2 text-sm text-bad">
                {erro}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmar(null)} disabled={pendente}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={excluir} disabled={pendente}>
                {pendente ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
