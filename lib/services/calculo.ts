import { prisma } from '@/lib/db';
import { arredondar3, type Perfil } from '@/lib/domain/regras';
import { ErroRegraNegocio } from '@/lib/services/errors';

export type { Perfil } from '@/lib/domain/regras';
export { calcularMetros, validarReemprego, arredondar3 } from '@/lib/domain/regras';

export async function fatorPerfil(perfil: Perfil): Promise<number> {
  const registro = await prisma.fatorPerfil.findUnique({ where: { perfil } });
  // Regra de negócio, não falha de infraestrutura: o fator precisa ser cadastrado
  // por um admin. Reenviar o mesmo recebimento não resolve — ver ErroRegraNegocio.
  if (!registro) throw new ErroRegraNegocio(`Fator do perfil ${perfil} ainda não cadastrado.`);
  return Number(registro.fator);
}

export async function calcularPeso(metros: number, perfil: Perfil): Promise<number> {
  const fator = await fatorPerfil(perfil);
  return arredondar3(metros * fator);
}

export async function listarFatoresCadastrados(): Promise<Partial<Record<Perfil, number>>> {
  const registros = await prisma.fatorPerfil.findMany();
  return Object.fromEntries(registros.map((r) => [r.perfil, Number(r.fator)])) as Partial<Record<Perfil, number>>;
}
