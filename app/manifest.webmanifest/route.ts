import { cookies } from 'next/headers';
import { COR_APP, TEMA_COOKIE, TEMA_PADRAO, temaValido } from '@/lib/tema/tema';

export const dynamic = 'force-dynamic';


/**
 * Manifesto do app instalado (PWA), montado com o tema escolhido: o ícone da tela
 * inicial sai com as cores do tema. No Android o Chrome confere o manifesto de
 * tempos em tempos e atualiza o ícone; no iPhone o ícone fica o da hora em que o
 * app foi adicionado à tela de início.
 */
export async function GET() {
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value) ?? TEMA_PADRAO;
  const pasta = `/icons/${tema}`;
  const manifesto = {
    id: '/',
    name: 'Controle de Trilhos',
    short_name: 'Controle de Trilhos',
    description: 'Recebimento, remessa e conferência de trilhos',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: COR_APP[tema],
    theme_color: COR_APP[tema],
    icons: [
      { src: `${pasta}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${pasta}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${pasta}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Novo recebimento', url: '/patio/recebimentos/novo', icons: [{ src: `${pasta}/icon-192.png`, sizes: '192x192' }] },
      { name: 'Remetidos', url: '/patio/remetidos', icons: [{ src: `${pasta}/icon-192.png`, sizes: '192x192' }] },
      { name: 'Administrativo', url: '/admin', icons: [{ src: `${pasta}/icon-192.png`, sizes: '192x192' }] },
    ],
  };
  return new Response(JSON.stringify(manifesto), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Cookie' },
  });
}
