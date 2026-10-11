import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';

export async function GET(request: NextRequest) {
  // GET para aceitar parâmetros de URL
  try {
    const email = request.nextUrl.searchParams.get('email');
    const novaSenha = request.nextUrl.searchParams.get('senha');
    const token = request.nextUrl.searchParams.get('token');
    const criar = request.nextUrl.searchParams.get('criar');

    // Token de segurança simples
    const tokenValido = token === 'reset-trilhos-2026';

    if (!tokenValido) {
      return NextResponse.json(
        { erro: 'Token inválido' },
        { status: 401 }
      );
    }

    if (!novaSenha) {
      return NextResponse.json(
        { erro: 'Nova senha é obrigatória' },
        { status: 400 }
      );
    }

    // Se criar=true, cria um novo usuário em vez de atualizar
    if (criar === 'true') {
      const usuarioEmail = email || 'junior@controle-de-trilhos.local';

      // Verificar se já existe
      const existente = await prisma.user.findUnique({
        where: { username: 'junior' },
      });

      if (existente) {
        return NextResponse.json(
          { erro: 'Usuário junior já existe. Use email e senha parâmetro sem criar=true para resetar' },
          { status: 400 }
        );
      }

      const senhaHash = await hashSegredo(novaSenha);

      const novoUsuario = await prisma.user.create({
        data: {
          nome: 'Junior',
          email: usuarioEmail,
          username: 'junior',
          senhaHash,
          role: 'DONO',
          ativo: true,
        },
      });

      return NextResponse.json({
        sucesso: true,
        mensagem: 'Usuário criado com sucesso',
        usuario: {
          username: 'junior',
          email: novoUsuario.email,
          role: 'DONO',
        },
      });
    }

    // Caso contrário, atualizar usuário existente
    if (!email) {
      return NextResponse.json(
        { erro: 'Email é obrigatório para atualizar' },
        { status: 400 }
      );
    }

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
