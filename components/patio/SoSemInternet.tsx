'use client';

import type { ReactNode } from 'react';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

/**
 * Mostra o conteúdo só quando o aparelho está sem internet. Com sinal, fica escondido.
 * Usado nos atalhos de lançamento: sem sinal, a pessoa ainda consegue lançar (vai para
 * a fila do aparelho), então o atalho aparece justamente nessa hora.
 */
export function SoSemInternet({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  if (online) return null;
  return <>{children}</>;
}
