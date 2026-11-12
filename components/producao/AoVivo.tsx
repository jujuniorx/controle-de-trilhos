'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Topo do acompanhamento do dia no Administrativo: busca a Produção de novo a cada 10 s enquanto a tela está aberta. */
export function AoVivo({ atualizado }: { atualizado: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const buscar = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const t = setInterval(buscar, 10000);
    document.addEventListener('visibilitychange', buscar);
    window.addEventListener('focus', buscar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', buscar); window.removeEventListener('focus', buscar); };
  }, [router]);
  return (
    <p className="turno-topo" role="status">
      <span>Produção de hoje</span>
      <span>{atualizado ? `último lançamento às ${atualizado}` : 'aguardando o primeiro lançamento'}</span>
    </p>
  );
}
