'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';
import { ITENS_SAP, ajustarSaldoTrilho, carregarSaldoInicial, salvarValorSap, type ItemSap } from '@/lib/services/estoqueTrilhos';
import { ORDEM_PERFIS, normalizarFabricante, type Posicao } from '@/lib/estoque/trilhos';
import { lerNumero } from '@/lib/domain/estoque';
import type { ResultadoFormUsina } from '@/components/usina/FormularioUsina';

const ATUALIZAR = () => revalidatePath('/admin/estoque');

export async function carregarSaldoInicialAction(): Promise<void> {
  const ator = await requireAdmin();
  const { criados } = await carregarSaldoInicial(ator.nome);
  if (criados > 0) await registrarAuditoria(ator, 'ESTOQUE_TRILHOS_SALDO_INICIAL', `Carregou o saldo inicial do estoque de trilhos (${criados} linhas).`);
  ATUALIZAR();
}

const SECOES = ['NOVO', 'REEMPREGO', 'SUCATA'] as const;
const TIPOS_NOVO = ['TLS', 'LISA', 'TALA', 'CURTA12', 'MENOR12'] as const;
const CLASSES: Record<(typeof SECOES)[number], string[]> = {
  NOVO: ['NORMAL', '21M', 'TORCIDO', 'TESTE'],
  REEMPREGO: ['G1', 'G2', 'G3', 'TLS'],
  SUCATA: ['SC1', 'SC2', 'SC3'],
};

/** Ajuste de uma linha do estoque: entra ou sai, em metros (TLS em quantidade). Motivo obrigatório. */
export async function ajustarSaldoTrilhoAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const ator = await requireAdmin();
  const secao = String(formData.get('secao') ?? '') as (typeof SECOES)[number];
  const perfil = String(formData.get('perfil') ?? '');
  const classe = String(formData.get('classe') ?? '');
  if (!SECOES.includes(secao)) return { ok: false, erro: 'Escolha a seção.' };
  if (!ORDEM_PERFIS.includes(perfil)) return { ok: false, erro: 'Escolha o perfil.' };
  if (!CLASSES[secao].includes(classe)) return { ok: false, erro: 'Escolha a classificação.' };
  let tipo: Posicao['tipo'] = 'BARRA';
  let fabricante: Posicao['fabricante'] = null;
  if (secao === 'NOVO') {
    const t = String(formData.get('tipo') ?? '') as (typeof TIPOS_NOVO)[number];
    if (!TIPOS_NOVO.includes(t)) return { ok: false, erro: 'Escolha o tipo (TLS, lisa, tala, curta).' };
    tipo = t;
    fabricante = normalizarFabricante(String(formData.get('fabricante') ?? ''));
    if (!fabricante) return { ok: false, erro: 'Escolha o fabricante.' };
  } else if (secao === 'REEMPREGO' && classe === 'TLS') {
    tipo = 'TLS';
  }
  const direcao = String(formData.get('direcao') ?? '');
  if (direcao !== 'ENTRA' && direcao !== 'SAI') return { ok: false, erro: 'Escolha se entra ou sai do estoque.' };
  const lida = lerNumero(formData.get('quantidade'));
  if (lida == null || !Number.isFinite(lida) || lida === 0) return { ok: false, erro: 'Informe a quantidade. Não pode ser zero.' };
  const valor = direcao === 'SAI' ? -lida : lida;
  const motivo = String(formData.get('motivo') ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (motivo.replace(/[^\p{L}]/gu, '').length < 10) return { ok: false, erro: 'Escreva o motivo do ajuste (ao menos 10 letras).' };
  const ehTls = tipo === 'TLS';
  if (ehTls && !Number.isInteger(valor)) return { ok: false, erro: 'TLS é em quantidade inteira.' };
  const metros = ehTls ? valor * 312 : Math.round(valor * 1000) / 1000;
  const posicao: Posicao = { secao, perfil, tipo, fabricante, classe };
  await ajustarSaldoTrilho(posicao, metros, ehTls ? valor : null, motivo, ator.nome);
  await registrarAuditoria(ator, 'ESTOQUE_TRILHOS_AJUSTE', `Ajuste ${secao} ${perfil} ${tipo} ${fabricante ?? ''} ${classe}: ${ehTls ? `${valor} TLS` : `${metros} m`}. Motivo: ${motivo}`);
  ATUALIZAR();
  return { ok: true };
}

/** Valores do SAP para conferir (toneladas). Campo vazio não muda o valor salvo. */
export async function salvarSapAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const ator = await requireAdmin();
  const mudou: string[] = [];
  for (const item of ITENS_SAP) {
    const bruto = String(formData.get(item) ?? '').trim();
    if (!bruto) continue;
    const n = lerNumero(bruto);
    if (n == null || !Number.isFinite(n) || n < 0) return { ok: false, erro: 'Use só números (toneladas) nos campos do SAP.' };
    await salvarValorSap(item as ItemSap, Math.round(n * 1000) / 1000, ator.nome);
    mudou.push(`${item}=${n}`);
  }
  if (mudou.length) await registrarAuditoria(ator, 'ESTOQUE_TRILHOS_SAP', `Valores do SAP: ${mudou.join(', ')}`);
  ATUALIZAR();
  return { ok: true };
}
