import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-200 text-neutral-800',
  info: 'bg-primary-light text-primary-dark',
  ok: 'bg-ok-light text-ok-dark',
  warn: 'bg-warn-light text-warn-dark',
  bad: 'bg-bad-light text-bad',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
