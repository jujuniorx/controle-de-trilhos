/**
 * Contagem de TLS da Produção. Sem banco aqui: serve para o servidor e para a tela.
 *
 * Trilho novo: todo TLS fecha a cada 12 soldas.
 * Reemprego: as barras têm de 7 a 12 m, então o TLS de 312 m fecha com um número
 * variável de soldas. A partir de 28 soldas o sistema pergunta "TLS encerrado?" em
 * cada hora, e o TLS só fecha quando o soldador responde que sim.
 */
export const SOLDAS_POR_TLS = 12;
export const FABRICANTE_REEMPREGO = 'Reemprego';
export const MIN_SOLDAS_TLS_REEMPREGO = 28;

/** Resposta da hora: 'sim:31' (fechou com 31 soldas), 'nao:28' (com 28 ainda não tinha fechado) ou ''. */
export function respostaTlsValida(resposta: string | null | undefined, aberto: number): boolean {
  const m = /^(sim|nao):(\d{1,3})$/.exec(resposta ?? '');
  if (!m) return false;
  const n = Number(m[2]);
  // O "não" vale só para a contagem em que foi dado: subiu uma solda, pergunta de novo.
  return m[1] === 'nao' ? n === aberto : n >= 1 && n <= aberto;
}

/** Com quantas soldas o TLS fechou nesta hora (0 = não fechou). */
export function soldasDoTlsEncerrado(resposta: string | null | undefined, aberto: number): number {
  const m = /^sim:(\d{1,3})$/.exec(resposta ?? '');
  return m && respostaTlsValida(resposta, aberto) ? Number(m[1]) : 0;
}

export interface HoraTls { soldas: number; fabricante: string; resposta?: string | null }
export interface SituacaoTls {
  /** Soldas no TLS em aberto ao fim da hora, antes de fechar. */
  aberto: number;
  /** Hora de reemprego que precisa da resposta "TLS encerrado?". */
  pergunta: boolean;
  /** Precisa da resposta e ela ainda não foi dada (ou ficou velha). */
  pendente: boolean;
  /** TLS fechado nesta hora com este número de soldas (0 = nenhum). */
  encerradoCom: number;
}

export function contarTls(sobraEntrada: number, horas: HoraTls[]): { porHora: SituacaoTls[]; tls: number; sobra: number } {
  let aberto = sobraEntrada;
  let tls = 0;
  const porHora = horas.map((h): SituacaoTls => {
    aberto += h.soldas;
    const contagem = aberto;
    if (h.fabricante !== FABRICANTE_REEMPREGO) {
      tls += Math.floor(aberto / SOLDAS_POR_TLS);
      aberto %= SOLDAS_POR_TLS;
      return { aberto: contagem, pergunta: false, pendente: false, encerradoCom: 0 };
    }
    const pergunta = h.soldas > 0 && contagem >= MIN_SOLDAS_TLS_REEMPREGO;
    const encerradoCom = pergunta ? soldasDoTlsEncerrado(h.resposta, contagem) : 0;
    if (encerradoCom) {
      tls += 1;
      aberto -= encerradoCom;
    }
    return { aberto: contagem, pergunta, pendente: pergunta && !respostaTlsValida(h.resposta, contagem), encerradoCom };
  });
  return { porHora, tls, sobra: aberto };
}

export interface ConfigTlsForm {
  horas: string[];
  sobraEntrada: number;
  /** Fabricante salvo no dia e em cada hora já salva (igual ao que o servidor usa ao gravar). */
  fabricanteSalvo: string;
  fabricantesSalvos: Record<string, string>;
}

/** Lê o formulário da Produção (na tela) e devolve a situação do TLS em cada hora. */
export function tlsDoForm(form: HTMLFormElement, cfg: ConfigTlsForm): Record<string, SituacaoTls> {
  const valor = (nome: string) => (form.elements.namedItem(nome) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() ?? '';
  const topo = valor('fabricante') || cfg.fabricanteSalvo;
  const horaTroca = valor('hora_troca_fabricante');
  let trocado: string | undefined;
  const linhas = cfg.horas.map((hora) => {
    const troca = valor(`troca_fabricante_${hora}`);
    if (troca) trocado = troca;
    const salvo = cfg.fabricantesSalvos[hora];
    const fabricante = trocado ?? (horaTroca ? (hora < horaTroca ? salvo ?? cfg.fabricanteSalvo : topo) : salvo ?? topo);
    const n = parseInt(valor(`soldas_${hora}`), 10);
    return { soldas: Number.isFinite(n) && n > 0 ? n : 0, fabricante, resposta: valor(`tls_${hora}`) };
  });
  const { porHora } = contarTls(cfg.sobraEntrada, linhas);
  return Object.fromEntries(cfg.horas.map((hora, i) => [hora, porHora[i]]));
}
