import type { SVGProps } from 'react';

/** Ícones do sistema: traço simples, 24x24, cor herdada do texto (currentColor). */
type Props = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number | undefined, props: Props) {
  const { size: _s, ...resto } = props;
  return {
    width: size ?? 16,
    height: size ?? 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...resto,
  };
}

export function IconeImpressora(props: Props) {
  return (
    <svg {...base(props.size, props)}>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

export function IconeAlerta(props: Props) {
  return (
    <svg {...base(props.size, props)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconeMenu(props: Props) {
  return (
    <svg {...base(props.size, props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconeFechar(props: Props) {
  return (
    <svg {...base(props.size, props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
