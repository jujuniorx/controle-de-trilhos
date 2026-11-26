import { ORDEM_PERFIS, ROTULO_FABRICANTE, type Fabricante } from '@/lib/estoque/trilhos';

/** Uma linha de TLS carregados no B.O. do trilheiro. */
export interface LinhaCarga {
  perfil: string;
  reemprego: boolean;
  /** Código do fabricante (NIPPON, PANGANG…); null no reemprego. */
  fabricante: Fabricante | null;
  quantidade: number;
}

export const MAX_TLS_POR_LINHA = 60;
/** Valor do campo de fabricante que indica TLS de reemprego. */
export const FAB_REEMPREGO = 'REEMPREGO';
export const FABRICANTES_CARGA = Object.keys(ROTULO_FABRICANTE) as Fabricante[];

interface CamposForm {
  get(nome: string): FormDataEntryValue | null;
}

const ler = (f: CamposForm, nome: string) => String(f.get(nome) ?? '').trim();

/**
 * Lê as linhas "perfil · fabricante (ou Reemprego) · quantidade" de um trilheiro no formulário da semana.
 * Campos: cargas_<T>_n (quantas linhas) e carga_<T>_<i>_perfil | _fab | _qtd.
 */
export function lerCargasTrilheiro(f: CamposForm, trilheiro: string): { ok: true; linhas: LinhaCarga[] } | { ok: false; erro: string } {
  const n = Math.min(20, Math.max(0, parseInt(ler(f, `cargas_${trilheiro}_n`) || '0', 10) || 0));
  const linhas: LinhaCarga[] = [];
  for (let i = 0; i < n; i++) {
    const perfil = ler(f, `carga_${trilheiro}_${i}_perfil`);
    const fab = ler(f, `carga_${trilheiro}_${i}_fab`);
    const qtdTexto = ler(f, `carga_${trilheiro}_${i}_qtd`);
    if (!fab && !qtdTexto) continue;
    if (!ORDEM_PERFIS.includes(perfil)) return { ok: false, erro: `${trilheiro}: perfil dos TLS carregados inválido.` };
    if (!fab) return { ok: false, erro: `${trilheiro}: escolha o fabricante (ou Reemprego) dos TLS carregados.` };
    if (fab !== FAB_REEMPREGO && !FABRICANTES_CARGA.includes(fab as Fabricante)) return { ok: false, erro: `${trilheiro}: fabricante dos TLS carregados inválido.` };
    const quantidade = /^\d+$/.test(qtdTexto) ? parseInt(qtdTexto, 10) : NaN;
    if (!(quantidade >= 1 && quantidade <= MAX_TLS_POR_LINHA)) {
      return { ok: false, erro: `${trilheiro}: a quantidade de TLS é um número inteiro de 1 a ${MAX_TLS_POR_LINHA}.` };
    }
    const reemprego = fab === FAB_REEMPREGO;
    linhas.push({ perfil, reemprego, fabricante: reemprego ? null : (fab as Fabricante), quantidade });
  }
  return { ok: true, linhas };
}

/**
 * Linhas que o bloco mostra para o B.O. digitado: as salvas só valem para o B.O. em que foram
 * salvas. Com B.O. novo (giro novo) começa vazio — senão os mesmos TLS sairiam do estoque duas vezes.
 */
export function linhasDoBo<T>(boAtual: string, boSalvo: string, salvas: T[]): T[] {
  return boAtual !== '' && boAtual === boSalvo ? salvas : [];
}
