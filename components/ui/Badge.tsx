import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'badge-muted',
  info: 'badge-info',
  ok: 'badge-ok',
  warn: 'badge-warn',
  bad: 'badge-err',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${TONE_CLASSES[tone]}`}>{children}</span>;
}
