'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Marca "Ao vivo" do Administrativo: busca a Produção de novo a cada 20 s enquanto a tela está aberta. */
export function AoVivo({ atualizado }: { atualizado: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const buscar = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const t = setInterval(buscar, 20000);
    document.addEventListener('visibilitychange', buscar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', buscar); };
  }, [router]);
  return (
    <p className="vivo-selo" role="status">
      <span className="vivo-ponto" aria-hidden="true" />
      <span>Ao vivo</span>
      <span className="vivo-quando">{atualizado ? `último lançamento às ${atualizado}` : 'aguardando o primeiro lançamento'}</span>
    </p>
  );
}
