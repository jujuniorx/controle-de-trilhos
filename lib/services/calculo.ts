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

/**
 * Mesma fórmula de calcularPeso, mas para ESTIMATIVAS (Sucata no Recebimento,
 * peso ausente no Remetido) — nunca pode travar o salvamento do Pátio. Se o
 * fator do perfil ainda não foi cadastrado, devolve null (sem estimativa) em
 * vez de lançar. NOVO/REEMPREGO continuam usando calcularPeso diretamente —
 * para eles o peso é obrigatório e a ausência de fator deve mesmo bloquear.
 */
export async function calcularPesoEstimado(metros: number, perfil: Perfil): Promise<number | null> {
  try {
    return await calcularPeso(metros, perfil);
  } catch (erro) {
    if (erro instanceof ErroRegraNegocio) return null;
    throw erro;
  }
}

export async function listarFatoresCadastrados(): Promise<Partial<Record<Perfil, number>>> {
  const registros = await prisma.fatorPerfil.findMany();
  return Object.fromEntries(registros.map((r) => [r.perfil, Number(r.fator)])) as Partial<Record<Perfil, number>>;
}
