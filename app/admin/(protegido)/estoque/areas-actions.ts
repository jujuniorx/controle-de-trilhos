'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/services/requireAdmin';
import {
  apagarMaterialEstoque,
  restaurarMaterialEstoque,
  criarMaterialEstoque,
  atualizarMaterialEstoque,
  registrarMovimentoEstoque,
  registrarCalibracao,
  materialIgual,
  fatoresPerfil,
  buscarMaterial,
  UNIDADES_MATERIAL,
  type CamposMaterial,
  type TipoMovimento,
} from '@/lib/services/estoqueAreas';
import {
  AREA_METROLOGIA,
  AREA_OLEO,
  AREA_TRILHOS,
  UNIDADE_CATEGORIA,
  ehCategoriaTrilho,
  ehPerfilEstoque,
  lerNumero,
  nomeItemTrilho,
} from '@/lib/domain/estoque';
import type { ResultadoFormUsina } from '@/components/usina/FormularioUsina';

export interface ResultadoCadastro {
  ok: boolean;
  erro?: string;
  id?: string;
  areaId?: string;
}

function texto(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

/** Quantidade com vírgula ou ponto. Vazio vira zero; negativo ou inválido é recusado. */
function quantidade(v: FormDataEntryValue | null): number | 'invalido' {
  const n = lerNumero(v);
  if (n == null) return 0;
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 'invalido';
}

function opcionalNum(v: FormDataEntryValue | null): number | null | 'invalido' {
  const n = lerNumero(v);
  if (n == null) return null;
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 'invalido';
}

function data(v: FormDataEntryValue | null): string | null | 'invalido' {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : 'invalido';
}

/**
 * Lê os campos do material conforme a área. Trilhos monta o nome e a unidade a partir das escolhas
 * (perfil, tala ou barra lisa) e converte toneladas para metros pelo fator do perfil.
 */
async function lerCampos(
  areaId: string,
  fd: FormData,
): Promise<{ ok: true; campos: CamposMaterial; fatorConversao: number | null } | { ok: false; erro: string }> {
  const fabricante = texto(fd.get('fabricante'), 80).toLocaleUpperCase('pt-BR') || null;
  const minimo = opcionalNum(fd.get('minimo'));
  if (minimo === 'invalido') return { ok: false, erro: 'Use só números positivos no mínimo.' };

  const base: CamposMaterial = {
    nome: '', unidade: 'un', fabricante, minimo,
    grupo: null, endereco: null, categoria: null, perfil: null, furos: null, comprimentoBarra: null,
    calibradoEm: null, calibracaoValidade: null, capacidade: null, embalagem: null,
  };

  if (areaId === AREA_TRILHOS) {
    const categoria = texto(fd.get('categoria'), 10);
    const perfil = texto(fd.get('perfil'), 6);
    if (!ehCategoriaTrilho(categoria)) return { ok: false, erro: 'Escolha se é perfil, tala ou barra lisa.' };
    if (!ehPerfilEstoque(perfil)) return { ok: false, erro: 'Escolha o perfil (TR37, TR57, TR68...).' };
    let furos: number | null = null;
    let comprimentoBarra: number | null = null;
    if (categoria === 'TALA') {
      furos = Number(texto(fd.get('furos'), 2)) || null;
      if (furos !== 4 && furos !== 6) return { ok: false, erro: 'Escolha 4 ou 6 furos para a tala.' };
    }
    if (categoria === 'LISA') {
      const c = opcionalNum(fd.get('comprimentoBarra'));
      if (c === 'invalido' || c == null || c <= 0 || c > 40) return { ok: false, erro: 'Informe o comprimento da barra lisa em metros (ex.: 12).' };
      comprimentoBarra = c;
    }
    let fatorConversao: number | null = null;
    if (categoria === 'PERFIL' && texto(fd.get('modoQtd'), 2) === 't') {
      fatorConversao = (await fatoresPerfil())[perfil] ?? null;
      if (!fatorConversao) return { ok: false, erro: `Sem fator de peso para o ${perfil}. Informe em metros.` };
    }
    return {
      ok: true,
      fatorConversao,
      campos: {
        ...base, categoria, perfil, furos, comprimentoBarra,
        nome: nomeItemTrilho({ categoria, perfil, furos, comprimentoBarra }),
        unidade: UNIDADE_CATEGORIA[categoria],
        minimo: minimo != null && fatorConversao ? Math.round((minimo / fatorConversao) * 1000) / 1000 : minimo,
      },
    };
  }

  const nome = texto(fd.get('nome'), 80);
  const unidade = texto(fd.get('unidade'), 5);
  if (!nome) return { ok: false, erro: 'Informe o nome do material.' };
  if (!(UNIDADES_MATERIAL as readonly string[]).includes(unidade)) return { ok: false, erro: 'Escolha a unidade (un, par, kg, L ou m).' };
  const campos: CamposMaterial = { ...base, nome, unidade, grupo: texto(fd.get('grupo'), 60) || null };

  if (areaId === AREA_METROLOGIA) {
    const calibradoEm = data(fd.get('calibradoEm'));
    const validade = data(fd.get('calibracaoValidade'));
    if (calibradoEm === 'invalido' || validade === 'invalido') return { ok: false, erro: 'Data de calibração inválida.' };
    if (calibradoEm && validade && validade < calibradoEm) return { ok: false, erro: 'A validade não pode ser antes da data da calibração.' };
    campos.calibradoEm = calibradoEm;
    campos.calibracaoValidade = validade;
  } else if (areaId === AREA_OLEO) {
    const capacidade = opcionalNum(fd.get('capacidade'));
    if (capacidade === 'invalido') return { ok: false, erro: 'Use só números na capacidade.' };
    campos.capacidade = capacidade;
    campos.embalagem = texto(fd.get('embalagem'), 40) || null;
  } else {
    campos.endereco = texto(fd.get('endereco'), 12).toUpperCase() || null;
  }
  return { ok: true, campos, fatorConversao: null };
}

/** Cadastra um material numa área, com saldo inicial. Não deixa duplicar sem confirmar. */
export async function criarMaterialEstoqueAction(_: ResultadoCadastro | undefined, formData: FormData): Promise<ResultadoCadastro> {
  const { nome: responsavel } = await requireAdmin();
  const areaId = texto(formData.get('areaId'), 60);
  if (!areaId) return { ok: false, erro: 'Área não informada.' };
  const lido = await lerCampos(areaId, formData);
  if (!lido.ok) return { ok: false, erro: lido.erro };
  const q = quantidade(formData.get('quantidadeInicial'));
  if (q === 'invalido') return { ok: false, erro: 'Use só números positivos na quantidade.' };
  const quantidadeInicial = lido.fatorConversao ? Math.round((q / lido.fatorConversao) * 1000) / 1000 : q;

  if (formData.get('duplicar') !== 'sim') {
    const igual = await materialIgual(areaId, lido.campos.nome, lido.campos.fabricante);
    if (igual) return { ok: false, erro: `Já existe ${igual.nome}${lido.campos.fabricante ? ` · ${lido.campos.fabricante}` : ''}. Dê entrada nele em vez de criar outro.`, id: igual.id };
  }
  try {
    const id = await criarMaterialEstoque({
      areaId,
      ...lido.campos,
      quantidadeInicial,
      documento: texto(formData.get('documento'), 40) || null,
      responsavel,
    });
    revalidatePath('/admin/estoque');
    return { ok: true, id, areaId };
  } catch (e) {
    console.error('[estoque] falha ao cadastrar', e);
    return { ok: false, erro: 'Não foi possível cadastrar. Tente de novo.' };
  }
}

/** Muda os dados do material (nome, mínimo, prateleira, capacidade...). O saldo só muda por movimento. */
export async function atualizarMaterialEstoqueAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  await requireAdmin();
  const id = texto(formData.get('materialId'), 60);
  const material = id ? await buscarMaterial(id) : null;
  if (!material) return { ok: false, erro: 'Material não encontrado.' };
  const lido = await lerCampos(material.areaId, formData);
  if (!lido.ok) return { ok: false, erro: lido.erro };
  // Calibração tem o próprio botão; a edição de dados não apaga as datas.
  const campos = material.areaId === AREA_METROLOGIA
    ? { ...lido.campos, calibradoEm: lido.campos.calibradoEm ?? material.calibradoEm, calibracaoValidade: lido.campos.calibracaoValidade ?? material.calibracaoValidade }
    : lido.campos;
  // A unidade de um item com saldo não muda: o saldo e o histórico ficariam errados.
  if (campos.unidade !== material.unidade && material.quantidade !== 0) {
    return { ok: false, erro: `A unidade só muda com o saldo zerado (hoje há ${material.quantidade.toLocaleString('pt-BR')} ${material.unidade}).` };
  }
  await atualizarMaterialEstoque(id, campos);
  revalidatePath('/admin/estoque');
  return { ok: true };
}

/** Registra entrada, baixa ou ajuste de um material. Quem registra fica no histórico. */
export async function registrarMovimentoEstoqueAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const { nome: responsavel } = await requireAdmin();
  const materialId = texto(formData.get('materialId'), 60);
  const tipo = texto(formData.get('tipo'), 10) as TipoMovimento;
  if (!materialId) return { ok: false, erro: 'Material não informado.' };
  if (!['ENTRADA', 'BAIXA', 'AJUSTE'].includes(tipo)) return { ok: false, erro: 'Tipo de movimento inválido.' };
  const q = quantidade(formData.get('quantidade'));
  if (q === 'invalido') return { ok: false, erro: 'Use só números positivos na quantidade.' };
  if (q === 0 && tipo !== 'AJUSTE') return { ok: false, erro: 'Informe a quantidade.' };
  const motivo = texto(formData.get('motivo'), 160) || null;
  if (tipo === 'BAIXA' && !motivo) return { ok: false, erro: 'Informe o motivo da baixa (ex.: retirado para corte).' };
  if (tipo === 'AJUSTE' && !motivo) return { ok: false, erro: 'No ajuste, informe o motivo (ex.: diferença na contagem).' };
  try {
    await registrarMovimentoEstoque({
      materialId,
      tipo,
      quantidade: q,
      motivo,
      documento: texto(formData.get('documento'), 40) || null,
      responsavel,
    });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível registrar.' };
  }
  revalidatePath('/admin/estoque');
  return { ok: true };
}

/** Metrologia: registra uma calibração (data e validade) no instrumento. */
export async function registrarCalibracaoAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const { nome: responsavel } = await requireAdmin();
  const materialId = texto(formData.get('materialId'), 60);
  const calibradoEm = data(formData.get('calibradoEm'));
  const validade = data(formData.get('calibracaoValidade'));
  if (!materialId) return { ok: false, erro: 'Material não informado.' };
  if (!calibradoEm || calibradoEm === 'invalido') return { ok: false, erro: 'Informe a data da calibração.' };
  if (!validade || validade === 'invalido') return { ok: false, erro: 'Informe até quando a calibração vale.' };
  if (validade < calibradoEm) return { ok: false, erro: 'A validade não pode ser antes da data da calibração.' };
  try {
    await registrarCalibracao({ materialId, calibradoEm, validade, documento: texto(formData.get('documento'), 40) || null, responsavel });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível registrar.' };
  }
  revalidatePath('/admin/estoque');
  return { ok: true };
}

/** Manda o material para a lixeira (só com saldo zero) e volta para a área. */
export async function apagarMaterialEstoqueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const materialId = texto(formData.get('materialId'), 60);
  const areaId = texto(formData.get('areaId'), 60);
  if (materialId) await apagarMaterialEstoque(materialId);
  revalidatePath('/admin/estoque');
  if (areaId) redirect(`/admin/estoque?area=${encodeURIComponent(areaId)}`);
}

/** Tira um material da lixeira da área. */
export async function restaurarMaterialEstoqueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const materialId = texto(formData.get('materialId'), 60);
  if (materialId) await restaurarMaterialEstoque(materialId);
  revalidatePath('/admin/estoque');
}
