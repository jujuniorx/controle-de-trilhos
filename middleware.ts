import { NextRequest, NextResponse } from 'next/server';

/**
 * Gera um nonce aleatório por requisição, Edge-safe (Web Crypto API + btoa —
 * sem o módulo `crypto` do Node, que não está disponível no Edge Runtime).
 * Usado para permitir um Content-Security-Policy estrito (`script-src` sem
 * 'unsafe-inline') liberando apenas os scripts inline que o próprio
 * Next.js injeta (payload de RSC) e que carregam este nonce.
 */
function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binario = '';
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!request.cookies.get('sessao_admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname.startsWith('/patio') && pathname !== '/patio/acesso') {
    if (!request.cookies.get('acesso_patio')) {
      return NextResponse.redirect(new URL('/patio/acesso', request.url));
    }
  }

  const nonce = gerarNonce();

  // Em desenvolvimento o React usa `eval` para reconstruir stacks de erro do
  // servidor no navegador, então 'unsafe-eval' é obrigatório aqui — é o que a
  // própria documentação de CSP do Next.js faz neste mesmo padrão. Em produção
  // ele NÃO entra (seria justamente o furo que 'strict-dynamic' evita).
  // `process.env.NODE_ENV` é inlined no bundle do middleware pelo Next, logo é
  // legível no Edge Runtime (não depende do `process` do Node em runtime).
  const ehDesenvolvimento = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${ehDesenvolvimento ? " 'unsafe-eval'" : ''}`,
    // Sem fallback via default-src: precisam ser declarados explicitamente.
    // base-uri impede que um <base> injetado redirecione todos os scripts
    // relativos (o ataque clássico contra políticas com 'strict-dynamic');
    // form-action impede que o POST do formulário de PIN seja redirecionado
    // para um destino do atacante.
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Propaga o nonce e o CSP na própria requisição: é assim que o Next.js
  // sabe qual nonce carimbar nos scripts inline que ele mesmo gera durante o
  // SSR (ver "Nonce Processing Flow" na doc de CSP do Next.js).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  // Aplica a todas as rotas (páginas, rotas de API, etc.) exceto assets
  // estáticos do build, que não precisam de CSP com nonce — mesma exclusão
  // recomendada pela documentação do Next.js para este padrão.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
