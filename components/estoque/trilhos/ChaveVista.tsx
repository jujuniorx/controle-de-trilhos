'use client';

import { COOKIE_VISTA_TRILHOS } from './formato';

/** "Ver resumo" / "Ver detalhado". Lembra a escolha de cada pessoa neste aparelho. */
export function ChaveVista({ vista }: { vista: 'resumo' | 'detalhado' }) {
  const lembrar = (v: string) => {
    document.cookie = `${COOKIE_VISTA_TRILHOS}=${v}; path=/admin; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };
  return (
    <nav className="etr-chave" aria-label="Como ver o estoque de trilhos">
      <a href="/admin/estoque?area=area-trilhos&vista=resumo" aria-current={vista === 'resumo' ? 'page' : undefined} onClick={() => lembrar('resumo')}>
        Ver resumo
      </a>
      <a href="/admin/estoque?area=area-trilhos&vista=detalhado" aria-current={vista === 'detalhado' ? 'page' : undefined} onClick={() => lembrar('detalhado')}>
        Ver detalhado
      </a>
    </nav>
  );
}
