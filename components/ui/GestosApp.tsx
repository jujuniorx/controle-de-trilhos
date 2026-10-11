'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Nome do evento que abre o menu "Mais" (ouvido por MobileNav no admin; disparado pela barra de abas). */
export const EVENTO_MENU = 'abrir-menu';

const LIMITE_PUXAR = 88; // quanto puxar para baixo para atualizar

function ignorar(alvo: EventTarget | null): boolean {
  const el = alvo instanceof Element ? alvo : null;
  if (!el) return false;
  if (el.closest('input, textarea, select, [contenteditable="true"], [data-sem-gesto]')) return true;
  // Dentro de uma área com rolagem própria já rolada, o gesto é da rolagem.
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return true;
  }
  return false;
}

/**
 * Gesto de aplicativo no celular (só com toque): puxar a tela para baixo, no topo, atualiza os dados.
 * (Deslizar da borda esquerda não é tratado aqui: no iPhone o Safari já usa esse gesto para voltar.)
 */
export function GestosApp() {
  const router = useRouter();
  const puxarEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const puxar = puxarEl.current;
    if (!puxar) return;
    const el = puxar;

    let x0 = 0;
    let y0 = 0;
    let ativo = false;
    let decidido = false;
    let atualizando = false;

    function resetar() {
      ativo = false;
      decidido = false;
      if (atualizando) return;
      el.style.transition = 'transform .22s ease, opacity .22s ease';
      el.style.transform = 'translate(-50%, -60px)';
      el.style.opacity = '0';
      el.dataset.pronto = '0';
    }

    function aoComecar(e: TouchEvent) {
      const livre =
        e.touches.length === 1 && !atualizando && window.scrollY <= 0 && !ignorar(e.target) && !document.body.hasAttribute('data-menu-aberto');
      ativo = livre;
      decidido = false;
      if (!livre) return;
      const t = e.touches[0]!;
      x0 = t.clientX;
      y0 = t.clientY;
      el.style.transition = 'none';
    }

    function aoMover(e: TouchEvent) {
      if (!ativo || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!decidido) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) decidido = true;
        else {
          ativo = false;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      const p = Math.min(dy / LIMITE_PUXAR, 1);
      el.style.opacity = String(Math.max(p, 0.2));
      el.style.transform = `translate(-50%, ${Math.min(dy * 0.55, 76) - 44}px) rotate(${p * 270}deg)`;
      el.dataset.pronto = p >= 1 ? '1' : '0';
    }

    function aoTerminar(e: TouchEvent) {
      const t = e.changedTouches[0];
      const dy = t ? t.clientY - y0 : 0;
      if (ativo && decidido && dy >= LIMITE_PUXAR) {
        atualizando = true;
        el.style.transition = 'transform .2s ease';
        el.style.transform = 'translate(-50%, 28px)';
        el.style.opacity = '1';
        el.dataset.carregando = '1';
        router.refresh();
        window.setTimeout(
          () => {
            atualizando = false;
            el.dataset.carregando = '0';
            resetar();
          },
          reduzir ? 300 : 1100,
        );
        ativo = false;
        decidido = false;
      } else {
        resetar();
      }
    }

    document.addEventListener('touchstart', aoComecar, { passive: true });
    document.addEventListener('touchmove', aoMover, { passive: false });
    document.addEventListener('touchend', aoTerminar, { passive: true });
    document.addEventListener('touchcancel', resetar, { passive: true });
    return () => {
      document.removeEventListener('touchstart', aoComecar);
      document.removeEventListener('touchmove', aoMover);
      document.removeEventListener('touchend', aoTerminar);
      document.removeEventListener('touchcancel', resetar);
    };
  }, [router]);

  return (
    <div ref={puxarEl} className="gesto-puxar" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
      </svg>
    </div>
  );
}
