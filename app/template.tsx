import type { ReactNode } from 'react';

/** Remonta a cada navegação: dá uma entrada suave (fade + subida leve) em todas as páginas. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="pagina-anim">{children}</div>;
}
