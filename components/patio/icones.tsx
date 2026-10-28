import type { ReactNode } from 'react';

const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ICONE_INICIO: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M4 11l8-7 8 7M6 10v10h12V10" />
  </svg>
);

/** Receber (descarga): caminhão com seta entrando. */
export const ICONE_RECEBER: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M12 2.5v7M8.5 6.5L12 10l3.5-3.5M3 13h11v6H3zM14 15h3.5l2.5 2v2h-6M6 20.5a1 1 0 1 0 0-.01M16.5 20.5a1 1 0 1 0 0-.01" />
  </svg>
);

/** Carga (saída): caminhão com seta saindo. */
export const ICONE_CARGA: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M12 10V3M8.5 6L12 2.5 15.5 6M3 13h11v6H3zM14 15h3.5l2.5 2v2h-6M6 20.5a1 1 0 1 0 0-.01M16.5 20.5a1 1 0 1 0 0-.01" />
  </svg>
);

/** Já saíram: portão com seta para fora. */
export const ICONE_SAIDAS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/** Pilhas: barras empilhadas. */
export const ICONE_PILHAS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M3 18h18M5 14h14M7 10h10M9 6h6" />
  </svg>
);

export const ICONE_TROCAR_AREA: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />
  </svg>
);

export const ICONE_LIXEIRA_PATIO: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
