'use client';

import { useEffect, useState } from 'react';
import { ChecagemAnimada } from '@/components/ui/ChecagemAnimada';

/** Aviso flutuante "Registrado!" — some sozinho e limpa o ?salvo= da barra de endereço. */
export function AvisoSucesso({ mensagem }: { mensagem?: string }) {
  const [visivel, setVisivel] = useState(Boolean(mensagem));

  useEffect(() => {
    if (!mensagem) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('salvo');
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      /* ignora */
    }
    const t = setTimeout(() => setVisivel(false), 3800);
    return () => clearTimeout(t);
  }, [mensagem]);

  if (!mensagem || !visivel) return null;
  return (
    <div className="aviso-sucesso" role="status">
      <ChecagemAnimada size={36} />
      <span>{mensagem}</span>
    </div>
  );
}
