import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const CONTROL_CLASSES =
  'h-11 w-full rounded-md border border-line bg-surface px-3 text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary-light disabled:bg-neutral-100';

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
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={htmlFor}>
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
