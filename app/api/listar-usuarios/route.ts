import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    // Token de segurança simples
    const tokenValido = token === 'reset-trilhos-2026';

    if (!tokenValido) {
      return NextResponse.json(
        { erro: 'Token inválido' },
        { status: 401 }
      );
    }

    const usuarios = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        username: true,
        role: true,
        ativo: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      total: usuarios.length,
      usuarios,
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
