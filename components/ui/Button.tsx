import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'sm';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'border border-primary bg-surface text-primary-dark hover:bg-primary-light',
  ghost: 'border border-line bg-surface text-ink hover:bg-primary-light',
  danger: 'bg-bad text-white',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-12 px-4 text-base',
  sm: 'h-9 px-3 text-sm',
};

function buildClassName(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean | undefined, className: string | undefined): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'default', fullWidth, className, children } = props;
  const finalClassName = buildClassName(variant, size, fullWidth, className);

  if (props.href !== undefined) {
    const { href, variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, ...rest } = props;
    return (
      <Link href={href} className={finalClassName} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, href: _h, ...rest } = props;
  return (
    <button className={finalClassName} {...rest}>
      {children}
    </button>
  );
}
