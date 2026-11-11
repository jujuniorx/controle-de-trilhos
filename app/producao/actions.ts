'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { FABRICANTES_PRODUCAO, PERFIS_PRODUCAO, buscarDia, horasDoDia, salvarDiaProducao, type LinhaProducao } from '@/lib/services/producao';

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

export async function salvarProducaoAction(formData: FormData): Promise<void> {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) redirect('/producao/login');

  const data = texto(formData.get('data'), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) redirect('/producao');
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

  const linhas: LinhaProducao[] = horas.map((hora) => {
    const cortes = inteiro(formData.get(`cortes_${hora}`));
    const minutos = inteiro(formData.get(`parada_${hora}`));
    return {
      hora,
      soldas: inteiro(formData.get(`soldas_${hora}`)),
      cortes,
      justificativaCorte: cortes > 0 ? texto(formData.get(`justificativa_${hora}`), 200) || null : null,
      paradaInicio: minutos > 0 ? texto(formData.get(`parada_inicio_${hora}`), 5) || null : null,
      paradaMinutos: minutos > 0 ? minutos : null,
      paradaDescricao: minutos > 0 ? texto(formData.get(`parada_descricao_${hora}`), 200) || null : null,
      perfil: valorDaHora(hora, horaTrocaPerfil, perfil, perfilAntes, linhasAntes.get(hora)?.perfil),
      fabricante: valorDaHora(hora, horaTrocaFabricante, fabricante, fabricanteAntes, linhasAntes.get(hora)?.fabricante),
    };
  });

  await salvarDiaProducao({
    data: dataDia,
    soldadores: texto(formData.get('soldadores'), 200),
    lider: texto(formData.get('lider'), 80),
    perfil,
    fabricante,
    linhas,
  });
  revalidatePath('/producao');
  redirect(`/producao?data=${data}&ok=1`);
}
