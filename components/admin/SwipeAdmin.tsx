'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Deslizar para os lados no celular troca de seção (as abas da barra de baixo), com animação.
 * Gestos horizontais dentro de tabelas ou áreas com rolagem própria são da rolagem, não da troca.
 */
export function SwipeAdmin({ rotas, children }: { rotas: string[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = (usePathname() || '/').replace(/\/$/, '') || '/';
  const conteudoEl = useRef<HTMLDivElement>(null);
  const entrada = useRef<1 | -1 | 0>(0);

  const indice = rotas.findIndex((r) => (r === '/admin' ? pathname === r : pathname === r || pathname.startsWith(`${r}/`)));

  // Depois da troca de rota, o conteúdo novo entra pelo lado de onde veio o gesto.
  useEffect(() => {
    const el = conteudoEl.current;
    const dir = entrada.current;
    entrada.current = 0;
    if (!el || !dir || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dir * 28}px)`;
    el.style.opacity = '0';
    void el.offsetWidth;
    el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .28s ease';
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  }, [pathname]);

  useEffect(() => {
    if (indice < 0 || typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return;
    const el = conteudoEl.current;
    if (!el) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let x0 = 0;
    let y0 = 0;
    let ativo = false;
    let dx = 0;
    let trocando = false;

    function horizontalmenteRolavel(alvo: Element | null): boolean {
      for (let n: Element | null = alvo; n && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 4) {
          const estilo = window.getComputedStyle(n);
          if (/(auto|scroll)/.test(estilo.overflowX)) return true;
        }
      }
      return false;
    }

    function bloqueado(alvo: EventTarget | null): boolean {
      const el2 = alvo instanceof Element ? alvo : null;
      if (!el2) return true;
      if (el2.closest('input, textarea, select, [contenteditable="true"], [data-sem-gesto], [data-menu-aberto], dialog[open], [role="dialog"]')) return true;
      if (document.body.hasAttribute('data-menu-aberto')) return true;
      return horizontalmenteRolavel(el2);
    }

    function aoComecar(e: TouchEvent) {
      ativo = !trocando && e.touches.length === 1 && !bloqueado(e.target);
      if (!ativo) return;
      x0 = e.touches[0]!.clientX;
      y0 = e.touches[0]!.clientY;
      dx = 0;
      el!.style.transition = 'none';
    }

    function aoMover(e: TouchEvent) {
      if (!ativo || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 12) {
        ativo = false;
        el!.style.transform = 'translateX(0)';
        return;
      }
      if (Math.abs(dx) < 8) return;
      // Sem destino naquele lado, o conteúdo só resiste um pouco.
      const proximo = dx < 0 ? indice + 1 : indice - 1;
      const existe = proximo >= 0 && proximo < rotas.length;
      const alcance = existe ? dx : dx * 0.25;
      el!.style.transform = `translateX(${alcance}px)`;
      el!.style.opacity = String(Math.max(1 - Math.abs(alcance) / 900, 0.6));
    }

    function aoTerminar() {
      if (!ativo) return;
      ativo = false;
      const proximo = dx < -70 ? indice + 1 : dx > 70 ? indice - 1 : -1;
      if (proximo >= 0 && proximo < rotas.length) {
        trocando = true;
        const dir = dx < 0 ? -1 : 1;
        entrada.current = dir === -1 ? 1 : -1;
        el!.style.transition = `transform ${reduzir ? 0 : 0.2}s ease, opacity ${reduzir ? 0 : 0.2}s ease`;
        el!.style.transform = `translateX(${dir * -40}px)`;
        el!.style.opacity = '0';
        window.setTimeout(() => {
          router.push(rotas[proximo]!);
          window.setTimeout(() => {
            trocando = false;
          }, 600);
        }, reduzir ? 0 : 200);
      } else {
        el!.style.transition = 'transform .22s ease, opacity .22s ease';
        el!.style.transform = 'translateX(0)';
        el!.style.opacity = '1';
      }
    }

    document.addEventListener('touchstart', aoComecar, { passive: true });
    document.addEventListener('touchmove', aoMover, { passive: true });
    document.addEventListener('touchend', aoTerminar, { passive: true });
    document.addEventListener('touchcancel', aoTerminar, { passive: true });
    return () => {
      document.removeEventListener('touchstart', aoComecar);
      document.removeEventListener('touchmove', aoMover);
      document.removeEventListener('touchend', aoTerminar);
      document.removeEventListener('touchcancel', aoTerminar);
    };
  }, [indice, rotas, router]);

  return (
    <div ref={conteudoEl} className="swipe-admin min-w-0 flex-1" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
}
