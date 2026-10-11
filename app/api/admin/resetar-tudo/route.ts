import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';

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

    // Deletar usuário junior se existir
    await prisma.user.deleteMany({
      where: { username: 'junior' },
    });

    // Criar novo usuário junior com email correto
    const senhaHash = await hashSegredo('Ju32184364@');

    const novoJunior = await prisma.user.create({
      data: {
        nome: 'Junior',
        email: 'juniorhenrique0101@gmail.com',
        username: 'junior',
        senhaHash,
        role: 'DONO',
        ativo: true,
      },
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Usuário junior criado/resetado com sucesso',
      usuario: {
        nome: novoJunior.nome,
        email: novoJunior.email,
        username: 'junior',
        senha: 'Ju32184364@',
        role: 'DONO',
      },
    });
  } catch (error) {
    console.error('Erro ao resetar tudo:', error);
    return NextResponse.json(
      {
        erro: 'Erro interno do servidor',
        detalhes: error instanceof Error ? error.message : 'desconhecido'
      },
      { status: 500 }
    );
  }
}
