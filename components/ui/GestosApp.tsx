'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Nome do evento que abre o menu lateral (ouvido por MobileNav no admin e por GavetaApp no Pátio). */
export const EVENTO_MENU = 'abrir-menu';

const ZONA_BORDA = 24; // px a partir da borda esquerda onde o gesto de borda começa
const LIMITE_BORDA = 72; // quanto arrastar para confirmar
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
 * Gestos de aplicativo no celular (só com toque):
 * - deslizar da borda esquerda: na tela inicial da área abre o menu; nas demais, volta;
 * - puxar a tela para baixo, no topo: atualiza os dados.
 */
export function GestosApp({ raiz }: { raiz: '/patio' | '/admin' }) {
  const router = useRouter();
  const pathname = usePathname();
  const naRaiz = useRef(false);
  naRaiz.current = pathname.replace(/\/$/, '') === raiz;
  const voltarEl = useRef<HTMLDivElement>(null);
  const puxarEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let x0 = 0;
    let y0 = 0;
    let modo: 'borda' | 'puxar' | 'nenhum' | null = null;
    let naBorda = false;
    let noTopo = false;
    let atualizando = false;

    const voltar = voltarEl.current;
    const puxar = puxarEl.current;

    function resetar() {
      modo = null;
      if (voltar) {
        voltar.style.transition = 'transform .22s ease, opacity .22s ease';
        voltar.style.transform = 'translate(-60px, -50%)';
        voltar.style.opacity = '0';
      }
      if (puxar && !atualizando) {
        puxar.style.transition = 'transform .22s ease, opacity .22s ease';
        puxar.style.transform = 'translate(-50%, -60px)';
        puxar.style.opacity = '0';
      }
    }

    function aoComecar(e: TouchEvent) {
      if (e.touches.length !== 1 || atualizando || document.body.hasAttribute('data-gaveta-aberta')) {
        modo = 'nenhum';
        return;
      }
      const t = e.touches[0]!;
      x0 = t.clientX;
      y0 = t.clientY;
      naBorda = x0 <= ZONA_BORDA;
      noTopo = window.scrollY <= 0 && !ignorar(e.target);
      modo = ignorar(e.target) && !naBorda ? 'nenhum' : null;
      if (voltar) voltar.style.transition = 'none';
      if (puxar) puxar.style.transition = 'none';
    }

    function aoMover(e: TouchEvent) {
      if (modo === 'nenhum' || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;

      if (modo === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (naBorda && dx > 0 && Math.abs(dx) > Math.abs(dy)) modo = 'borda';
        else if (noTopo && dy > 0 && Math.abs(dy) > Math.abs(dx)) modo = 'puxar';
        else modo = 'nenhum';
        if (modo === 'nenhum') return;
      }

      if (e.cancelable) e.preventDefault();

      if (modo === 'borda' && voltar) {
        const p = Math.min(dx / LIMITE_BORDA, 1);
        voltar.style.opacity = String(Math.max(p, 0.15));
        voltar.style.transform = `translate(${Math.min(dx, 90) - 44}px, -50%) scale(${0.7 + 0.3 * p})`;
        voltar.dataset.pronto = p >= 1 ? '1' : '0';
      }
      if (modo === 'puxar' && puxar) {
        const p = Math.min(dy / LIMITE_PUXAR, 1);
        puxar.style.opacity = String(Math.max(p, 0.2));
        puxar.style.transform = `translate(-50%, ${Math.min(dy * 0.55, 76) - 44}px) rotate(${p * 270}deg)`;
        puxar.dataset.pronto = p >= 1 ? '1' : '0';
      }
    }

    function aoTerminar(e: TouchEvent) {
      const t = e.changedTouches[0];
      const dx = t ? t.clientX - x0 : 0;
      const dy = t ? t.clientY - y0 : 0;
      const m = modo;
      if (m === 'borda' && dx >= LIMITE_BORDA) {
        if (naRaiz.current) window.dispatchEvent(new Event(EVENTO_MENU));
        else if (window.history.length > 1) router.back();
        else router.push(raiz);
      }
      if (m === 'puxar' && dy >= LIMITE_PUXAR && puxar) {
        atualizando = true;
        puxar.style.transition = 'transform .2s ease';
        puxar.style.transform = 'translate(-50%, 28px)';
        puxar.style.opacity = '1';
        puxar.dataset.carregando = '1';
        router.refresh();
        window.setTimeout(
          () => {
            atualizando = false;
            puxar.dataset.carregando = '0';
            resetar();
          },
          reduzir ? 300 : 1100,
        );
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
  }, [router, raiz]);

  return (
    <>
      <div ref={voltarEl} className="gesto-voltar" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </div>
      <div ref={puxarEl} className="gesto-puxar" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
        </svg>
      </div>
    </>
  );
}
