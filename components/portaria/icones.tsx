import type { ReactNode } from 'react';

const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ICONE_REMETIDOS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />
  </svg>
);

export const ICONE_RECEBIMENTOS: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M12 3v11M7.5 10L12 14.5 16.5 10M4 15v4h16v-4" />
  </svg>
);

export const ICONE_TROCAR: (tam: number) => ReactNode = (tam) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" {...t} aria-hidden="true">
    <path d="M4 11l8-7 8 7M6 10v10h12V10" />
  </svg>
);
