import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!request.cookies.get('sessao_admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname.startsWith('/patio') && pathname !== '/patio/acesso') {
    if (!request.cookies.get('acesso_patio')) {
      return NextResponse.redirect(new URL('/patio/acesso', request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/patio/:path*'] };
