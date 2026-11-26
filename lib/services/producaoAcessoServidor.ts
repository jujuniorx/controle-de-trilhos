import { cookies } from 'next/headers';
import { validarSessao } from '@/lib/services/auth';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';

/**
 * Quem pode lançar ou corrigir a produção: quem entrou com o PIN da Produção (equipe do turno)
 * ou um administrador logado (para lançar cortes e paradas que ficaram de fora em dias passados).
 */
export async function podeLancarProducao(): Promise<boolean> {
  const jar = await cookies();
  if (cookieProducaoValido(jar.get(COOKIE_PRODUCAO)?.value)) return true;
  const token = jar.get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  return !!sessao && sessao.role !== 'PORTARIA';
}
