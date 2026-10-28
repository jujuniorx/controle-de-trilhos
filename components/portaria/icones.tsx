import type { ReactNode } from 'react';

const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Carga (carreta saindo): caminhão de perfil. Usado no menu e nos cartões de Carga. */
export const ICONE_REMETIDOS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />
  </svg>
);

/** Descarga (caminhão entrando): seta para dentro de uma caixa, com o caminhão embaixo. */
export const ICONE_RECEBIMENTOS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M12 2.5v7M8.5 6.5L12 10l3.5-3.5M3 13h11v6H3zM14 15h3.5l2.5 2v2h-6M6 20.5a1 1 0 1 0 0-.01M16.5 20.5a1 1 0 1 0 0-.01" />
  </svg>
);

export const ICONE_TROCAR: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M4 11l8-7 8 7M6 10v10h12V10" />
  </svg>
);

export const ICONE_MAIS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} strokeWidth={2.2} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ICONE_SETA_BAIXO: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ICONE_LIXEIRA: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
