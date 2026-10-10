'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { alterarAtivo, criarUsuario, redefinirSenha } from '@/lib/services/usuarios';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { novaSenhaSchema, novoUsuarioSchema } from '@/lib/validation/usuario';

export interface EstadoUsuarios {
  erro?: string;
  sucesso?: string;
}

// Server actions são endpoints públicos: o papel é conferido aqui, não só na tela.
async function exigirDono() {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') throw new ErroRegraNegocio('Só o dono do sistema pode fazer isso.');
  return sessao;
}

function mensagem(e: unknown): string {
  return e instanceof ErroRegraNegocio ? e.message : 'Não foi possível concluir. Tente de novo.';
}

export async function criarUsuarioAction(_e: EstadoUsuarios, formData: FormData): Promise<EstadoUsuarios> {
  try {
    const ator = await exigirDono();
    const parsed = novoUsuarioSchema.safeParse({
      nome: String(formData.get('nome') ?? ''),
      username: String(formData.get('username') ?? ''),
      senha: String(formData.get('senha') ?? ''),
    });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
    const criado = await criarUsuario(parsed.data);
    await registrarAuditoria(ator, 'Conta criada', `${criado.nome} (usuário ${parsed.data.username})`);
    revalidatePath('/admin/usuarios');
    return { sucesso: `Conta de ${criado.nome} criada. Passe o usuário e a senha para a pessoa.` };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

export async function alterarAtivoAction(userId: string, ativo: boolean): Promise<EstadoUsuarios> {
  try {
    const ator = await exigirDono();
    const { nome } = await alterarAtivo(userId, ativo, ator.userId);
    await registrarAuditoria(ator, ativo ? 'Conta reativada' : 'Conta desativada', nome);
    revalidatePath('/admin/usuarios');
    return { sucesso: ativo ? `${nome} reativado(a).` : `${nome} desativado(a).` };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

export async function redefinirSenhaAction(userId: string, senha: string): Promise<EstadoUsuarios> {
  try {
    const ator = await exigirDono();
    const parsed = novaSenhaSchema.safeParse({ senha });
    if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? 'Senha inválida.' };
    const { nome } = await redefinirSenha(userId, parsed.data.senha);
    await registrarAuditoria(ator, 'Senha redefinida', nome);
    return { sucesso: `Senha de ${nome} redefinida. Passe a senha nova para a pessoa.` };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}
