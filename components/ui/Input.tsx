import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const CONTROL_CLASSES =
  'h-11 w-full rounded-md border border-line-2 bg-surface-2 px-3 text-ink placeholder:text-ink-dim outline-none transition-colors focus:border-transparent focus:outline-2 focus:outline-primary focus:outline-offset-1 disabled:bg-surface disabled:text-ink-dim';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[CONTROL_CLASSES, className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[CONTROL_CLASSES, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-dim" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
