// Ícones em SVG (traço, herdam a cor do texto). Nada de emoji na interface.
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 16, children, ...rest }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconeEditar(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Base>
  );
}

export function IconeImprimir(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Base>
  );
}

export function IconeBaixar(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </Base>
  );
}

export function IconeAlerta(props: Props) {
  return (
    <Base {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Base>
  );
}

export function IconeMenu(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Base>
  );
}

export function IconeFechar(props: Props) {
  return (
    <Base {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Base>
  );
}

/** Mesmo desenho do IconeImprimir, como string HTML (para páginas geradas no servidor, como o romaneio). */
export const SVG_IMPRIMIR_HTML =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

/** Olho: mostrar a senha. Com a barra, "ocultar". */
export function IconeOlho({ ocultar = false, ...props }: Props & { ocultar?: boolean }) {
  return (
    <Base {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {ocultar && <path d="M3 3l18 18" />}
    </Base>
  );
}

/** Confirmação (item escolhido, ação concluída). */
export function IconeCheck(props: Props) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  );
}

/** Seta para baixo de menus que abrem. */
export function IconeSeta(props: Props) {
  return (
    <Base {...props}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  );
}

export function IconeLixeira(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

// ----- Estoque -----

/** Seção do trilho (boleto, alma e patim), cheia. */
export function IconeSecaoTrilho({ size = 16, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 48" aria-hidden="true" focusable="false" {...rest}>
      <path
        fill="currentColor"
        d="M13 2h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3.5v17c0 3 2 5 6 6l8 2.2V46H2.5v-6.8l8-2.2c4-1 6-3 6-6V14H13a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z"
      />
    </svg>
  );
}

export function IconeTala(props: Props) {
  return (
    <Base {...props}>
      <rect x="2.5" y="8" width="19" height="8" rx="2" />
      <circle cx="6.5" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
      <circle cx="14" cy="12" r="1.1" />
      <circle cx="17.5" cy="12" r="1.1" />
    </Base>
  );
}

export function IconeBarraLisa(props: Props) {
  return (
    <Base {...props}>
      <path d="M2.5 9.5h19M2.5 14.5h19M2.5 9.5v5M21.5 9.5v5" />
    </Base>
  );
}

export function IconeRegua(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 9h18v6H3zM6 9v3M9 9v2M12 9v3M15 9v2M18 9v3" />
    </Base>
  );
}

export function IconePaquimetro(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 5h18v4H3zM6 9v10l2 2V9M15 9v6M18 9v3" />
    </Base>
  );
}

export function IconeTermometro(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 8h11l3 3v2H9l-1 7H5l1-7H3zM19 7c1.2 1.2 1.2 3.8 0 5M21.5 5c2 2.5 2 6.5 0 9" />
    </Base>
  );
}

export function IconeNivel(props: Props) {
  return (
    <Base {...props}>
      <path d="M2 9h20v6H2zM10 9v6M14 9v6M11.2 12h1.6" />
    </Base>
  );
}

export function IconeTrena(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 6h10a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2zM16 16h6v2h-6" />
      <circle cx="10" cy="12" r="2.5" />
    </Base>
  );
}

export function IconeEsmerilhadeira(props: Props) {
  return (
    <Base {...props}>
      <circle cx="6" cy="12" r="4" />
      <path d="M10 11h10.5a1 1 0 0 1 0 2H10M14 13v5" />
    </Base>
  );
}

export function IconeRetifica(props: Props) {
  return (
    <Base {...props}>
      <path d="M2 12h4M6 10h11a2 2 0 0 1 0 4H6zM19 12h3" />
    </Base>
  );
}

/** Ferramenta genérica (chave). */
export function IconeFerramenta(props: Props) {
  return (
    <Base {...props}>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z" />
    </Base>
  );
}

/** Caixa de almoxarifado. */
export function IconeCaixa(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />
    </Base>
  );
}

/** Tambor de óleo. */
export function IconeTambor(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 4h12v16H6zM6 9.5h12M6 14.5h12" />
    </Base>
  );
}

export function IconeMais(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconeMenos(props: Props) {
  return (
    <Base {...props}>
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconeBusca(props: Props) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Base>
  );
}

/** Entrada e baixa (setas para cima e para baixo). */
export function IconeMovimentar(props: Props) {
  return (
    <Base {...props}>
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
    </Base>
  );
}

export function IconeCalibracao(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="M12 12l4-4M12 7v1M7 12h1" />
      <path d="m16 19 2 2 4-4" />
    </Base>
  );
}
