import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';

export async function GET(request: NextRequest) {
  // GET para aceitar parâmetros de URL
  try {
    const email = request.nextUrl.searchParams.get('email');
    const novaSenha = request.nextUrl.searchParams.get('senha');
    const token = request.nextUrl.searchParams.get('token');

    // Token de segurança simples
    const tokenValido = token === 'reset-trilhos-2026';

    if (!tokenValido) {
      return NextResponse.json(
        { erro: 'Token inválido' },
        { status: 401 }
      );
    }

    if (!email || !novaSenha) {
      return NextResponse.json(
        { erro: 'Email e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar usuário
    const usuario = await prisma.user.findUnique({
      where: { email },
    });

    if (!usuario) {
      return NextResponse.json(
        { erro: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Hash da nova senha
    const senhaHash = await hashSegredo(novaSenha);

    // Atualizar
    await prisma.user.update({
      where: { email },
      data: {
        senhaHash,
        username: 'junior',
      },
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Senha atualizada com sucesso',
      usuario: {
        email,
        username: 'junior',
        novaSenha,
      },
    });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    return NextResponse.json(
      { erro: 'Erro interno do servidor: ' + (error instanceof Error ? error.message : 'desconhecido') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, novaSenha, token } = await request.json();

    // Token de segurança simples (você pode mudar isso)
    const tokenValido = token === 'reset-trilhos-2026';

    if (!tokenValido) {
      return NextResponse.json(
        { erro: 'Token inválido' },
        { status: 401 }
      );
    }

    if (!email || !novaSenha) {
      return NextResponse.json(
        { erro: 'Email e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar usuário
    const usuario = await prisma.user.findUnique({
      where: { email },
    });

    if (!usuario) {
      return NextResponse.json(
        { erro: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Hash da nova senha
    const senhaHash = await hashSegredo(novaSenha);

    // Atualizar
    await prisma.user.update({
      where: { email },
      data: {
        senhaHash,
        username: 'junior', // Também vou setar o username
      },
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Senha atualizada com sucesso',
      usuario: {
        email,
        username: 'junior',
      },
    });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
