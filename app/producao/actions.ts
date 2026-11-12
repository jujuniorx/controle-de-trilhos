'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { FABRICANTES_PRODUCAO, MAX_PARADAS_HORA, PERFIS_PRODUCAO, buscarDia, horasDoDia, minutosDaParada, salvarDiaProducao, type LinhaProducao } from '@/lib/services/producao';

/** Valor de uma hora: antes da troca fica o que ja estava registrado; a partir da troca, o novo valor. */
function valorDaHora(hora: string, horaTroca: string, novo: string, antes: string, registrado: string | undefined): string {
  if (!horaTroca) return registrado ?? novo;
  return hora < horaTroca ? registrado ?? antes : novo;
}

function inteiro(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function texto(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** Grava o dia com o que veio do formulário. Devolve a data gravada, ou null se a data não vale. */
async function gravarDia(formData: FormData): Promise<string | null> {
  const data = texto(formData.get('data'), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const dataDia = new Date(`${data}T00:00:00Z`);

  const perfilTopo = texto(formData.get('perfil'), 10);
  const fabricanteTopo = texto(formData.get('fabricante'), 30);
  const perfil = (PERFIS_PRODUCAO as readonly string[]).includes(perfilTopo) ? perfilTopo : PERFIS_PRODUCAO[0];
  const fabricante = (FABRICANTES_PRODUCAO as readonly string[]).includes(fabricanteTopo) ? fabricanteTopo : FABRICANTES_PRODUCAO[0];

  const horas = horasDoDia(dataDia);
  // Troca de trilho/fabricante feita no topo durante o dia: vale a partir da hora registrada.
  const horaValida = (v: FormDataEntryValue | null) => {
    const h = texto(v, 5);
    return horas.includes(h) ? h : '';
  };
  const horaTrocaPerfil = horaValida(formData.get('hora_troca_perfil'));
  const horaTrocaFabricante = horaValida(formData.get('hora_troca_fabricante'));
  const diaAntes = await buscarDia(dataDia);
  const linhasAntes = new Map((diaAntes?.linhas ?? []).map((l) => [l.hora, l]));
  const perfilAntes = diaAntes?.perfil ?? perfil;
  const fabricanteAntes = diaAntes?.fabricante ?? fabricante;

  // Trocas de trilho/marca dentro de cada hora: valem dali em diante (ate a proxima troca).
  let perfilTrocado: string | undefined;
  let fabricanteTrocado: string | undefined;
  const linhas: LinhaProducao[] = horas.map((hora) => {
    const pTroca = texto(formData.get(`troca_perfil_${hora}`), 10);
    const fTroca = texto(formData.get(`troca_fabricante_${hora}`), 30);
    if ((PERFIS_PRODUCAO as readonly string[]).includes(pTroca)) perfilTrocado = pTroca;
    if ((FABRICANTES_PRODUCAO as readonly string[]).includes(fTroca)) fabricanteTrocado = fTroca;
    const cortes = inteiro(formData.get(`cortes_${hora}`));
    const lidas = Array.from({ length: MAX_PARADAS_HORA }, (_, i) => i + 1)
      .map((n) => ({
        inicio: texto(formData.get(`parada_inicio_${hora}_${n}`), 5) || null,
        minutos: minutosDaParada(String(formData.get(`parada_${hora}_${n}`) ?? '')),
        descricao: texto(formData.get(`parada_descricao_${hora}_${n}`), 200) || null,
      }));
    const paradas = lidas.filter((p) => p.minutos > 0);
    // Parada que começou e ainda não tem fim: vai para o Administrativo acompanhar ao vivo.
    const andamento = lidas.filter((p) => p.minutos === 0 && p.inicio).map((p) => ({ inicio: p.inicio as string, descricao: p.descricao }));
    const tls = texto(formData.get(`tls_${hora}`), 10);
    return {
      hora,
      tls: /^(sim|nao):\d{1,3}$/.test(tls) ? tls : null,
      soldas: inteiro(formData.get(`soldas_${hora}`)),
      cortes,
      justificativaCorte: cortes > 0 ? texto(formData.get(`justificativa_${hora}`), 200) || null : null,
      paradas,
      andamento,
      perfil: perfilTrocado ?? valorDaHora(hora, horaTrocaPerfil, perfil, perfilAntes, linhasAntes.get(hora)?.perfil),
      fabricante: fabricanteTrocado ?? valorDaHora(hora, horaTrocaFabricante, fabricante, fabricanteAntes, linhasAntes.get(hora)?.fabricante),
    };
  });

  await salvarDiaProducao({
    data: dataDia,
    soldadores: texto(formData.get('soldadores'), 200),
    lider: '',
    perfil,
    fabricante,
    linhas,
  });
  return data;
}

export async function salvarProducaoAction(formData: FormData): Promise<void> {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) redirect('/producao/login');
  const data = await gravarDia(formData);
  if (!data) redirect('/producao');
  revalidatePath('/producao');
  redirect(`/producao?data=${data}&ok=1`);
}

/**
 * Envio automático enquanto o soldador preenche: o Administrativo acompanha a Produção ao vivo.
 * Não recarrega a tela nem troca de página; o "Salvar o dia" continua sendo o fechamento.
 */
export type ResultadoSincronizacao = { ok: true } | { ok: false; motivo: 'sessao' | 'erro' };

/** Envio automático da tela: diz ao aparelho se o dia chegou ao servidor, para ele não fingir que enviou. */
export async function sincronizarProducaoAction(formData: FormData): Promise<ResultadoSincronizacao> {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) return { ok: false, motivo: 'sessao' };
  try {
    const data = await gravarDia(formData);
    if (!data) console.error('[producao] envio automatico recusado: data invalida', formData.get('data'));
    return data ? { ok: true } : { ok: false, motivo: 'erro' };
  } catch (erro) {
    // Vai para o log do servidor (Vercel) para descobrir por que o dia não foi salvo.
    console.error('[producao] envio automatico falhou', erro);
    return { ok: false, motivo: 'erro' };
  }
}
