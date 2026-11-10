'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { FABRICANTES_PRODUCAO, PERFIS_PRODUCAO, horasDoDia, salvarDiaProducao, type LinhaProducao } from '@/lib/services/producao';

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

  // Cada hora herda o trilho e o fabricante da hora anterior, até alguém registrar uma troca.
  let perfilAtual = perfil;
  let fabricanteAtual = fabricante;
  const linhas: LinhaProducao[] = horasDoDia(dataDia).map((hora) => {
    const pTroca = texto(formData.get(`perfil_${hora}`), 10);
    const fTroca = texto(formData.get(`fabricante_${hora}`), 30);
    if ((PERFIS_PRODUCAO as readonly string[]).includes(pTroca)) perfilAtual = pTroca;
    if ((FABRICANTES_PRODUCAO as readonly string[]).includes(fTroca)) fabricanteAtual = fTroca;
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
      perfil: perfilAtual,
      fabricante: fabricanteAtual,
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
