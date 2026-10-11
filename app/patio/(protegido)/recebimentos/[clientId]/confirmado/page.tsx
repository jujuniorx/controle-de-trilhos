'use client';

import { useParams } from 'next/navigation';
import { ConfirmacaoRecebimento } from '@/components/patio/ConfirmacaoRecebimento';

export default function RecebimentoConfirmadoPage() {
  const { clientId } = useParams<{ clientId: string }>();
  return <ConfirmacaoRecebimento clientId={clientId} />;
}
