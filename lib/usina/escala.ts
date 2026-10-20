// Escala semanal da usina: uma linha por caminhão, trilheiro ou pessoa da geração, com um status e um local por dia.
// Fica guardada como JSON no campo `conteudo` de EscalaSemana (sem migração). Textos antigos continuam válidos.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export const STATUS_ESCALA = [
  { valor: '-', rotulo: '-' },
  { valor: 'OK', rotulo: 'OK' },
  { valor: 'FOLGA', rotulo: 'Folga' },
  { valor: 'DESL.', rotulo: 'Desl.' },
  { valor: 'MAN.', rotulo: 'Man.' },
  { valor: 'TITAN', rotulo: 'Titan' },
  { valor: 'PRUMO', rotulo: 'Prumo' },
  { valor: 'EXTRA', rotulo: 'Extra' },
] as const;

export const ITENS_ESCALA = [
  { id: 'E18', rotulo: 'E18', grupo: 'Caminhão de solda' },
  { id: 'E17T', rotulo: 'E17 - TITAN', grupo: 'Caminhão de solda' },
  { id: 'E17P', rotulo: 'E17 - PRUMO', grupo: 'Caminhão de solda' },
  { id: 'ALECIO', rotulo: 'Alécio', grupo: 'Geração de trilho' },
  { id: 'BRUNO', rotulo: 'Bruno', grupo: 'Geração de trilho' },
  { id: 'REGINALDO', rotulo: 'Reginaldo', grupo: 'Geração de trilho' },
  { id: 'E40', rotulo: 'E40', grupo: 'Trilheiros' },
  { id: 'E42', rotulo: 'E42', grupo: 'Trilheiros' },
  { id: 'E46', rotulo: 'E46', grupo: 'Trilheiros' },
] as const;

export interface DiaEscala { status: string; local: string }
export interface EscalaSemanaValor {
  /** Nome do plantão de fim de semana em cada um dos 7 dias (seg a dom). */
  plantao: string[];
  /** Para cada item, 7 dias. */
  linhas: Record<string, DiaEscala[]>;
}

const STATUS_VALIDOS = new Set<string>(STATUS_ESCALA.map((s) => s.valor));
export const statusValido = (v: string) => STATUS_VALIDOS.has(v);

export function escalaVazia(): EscalaSemanaValor {
  const linhas: Record<string, DiaEscala[]> = {};
  for (const item of ITENS_ESCALA) linhas[item.id] = Array.from({ length: 7 }, () => ({ status: '-', local: '' }));
  return { plantao: Array(7).fill(''), linhas };
}

/** Lê o conteúdo salvo. Devolve null quando é texto antigo (ou vazio). */
export function lerEscala(texto: string | null | undefined): EscalaSemanaValor | null {
  if (!texto) return null;
  try {
    const dados = JSON.parse(texto);
    if (dados?.v !== 1 || !Array.isArray(dados.plantao) || typeof dados.linhas !== 'object') return null;
    const base = escalaVazia();
    base.plantao = dados.plantao.slice(0, 7).map((p: unknown) => String(p ?? ''));
    for (const item of ITENS_ESCALA) {
      const dias = Array.isArray(dados.linhas[item.id]) ? dados.linhas[item.id] : [];
      base.linhas[item.id] = Array.from({ length: 7 }, (_, i) => ({
        status: statusValido(String(dias[i]?.status ?? '')) ? String(dias[i].status) : '-',
        local: String(dias[i]?.local ?? ''),
      }));
    }
    return base;
  } catch {
    return null;
  }
}

export function gravarEscala(valor: EscalaSemanaValor): string {
  return JSON.stringify({ v: 1, ...valor });
}

/** Rótulos "Seg 20/10" ... para os 7 dias a partir da segunda-feira da semana (yyyy-mm-dd). */
export function diasDaSemana(semana: string): { nome: string; data: string }[] {
  const [a, m, d] = semana.split('-').map(Number);
  return DIAS_SEMANA.map((nome, i) => {
    const dt = new Date(Date.UTC(a, m - 1, d + i));
    const dia = String(dt.getUTCDate()).padStart(2, '0');
    const mes = String(dt.getUTCMonth() + 1).padStart(2, '0');
    return { nome, data: `${dia}/${mes}` };
  });
}

export const GRUPOS_ESCALA = ['Caminhão de solda', 'Geração de trilho', 'Trilheiros'] as const;

/** Texto curto de uma célula, usado na impressão. */
export function textoCelula(c: DiaEscala): string {
  if (c.status === '-' && !c.local) return '-';
  const partes = [c.status];
  if (c.local) partes.push(c.local);
  return partes.join(' · ');
}
