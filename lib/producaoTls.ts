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

export interface HoraTls { soldas: number; fabricante: string; perfil?: string; resposta?: string | null }
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
  let perfilAnterior: string | undefined;
  const porHora = horas.map((h): SituacaoTls => {
    // Trocou o trilho (perfil) no meio do dia: o TLS do perfil anterior fica para trás e a contagem recomeça do zero.
    if (h.perfil !== undefined && perfilAnterior !== undefined && h.perfil !== perfilAnterior) aberto = 0;
    perfilAnterior = h.perfil ?? perfilAnterior;
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
  /** Perfil e fabricante salvos no dia e em cada hora já salva (igual ao que o servidor usa ao gravar). */
  perfilSalvo?: string;
  perfisSalvos?: Record<string, string>;
  fabricanteSalvo: string;
  fabricantesSalvos: Record<string, string>;
}

/** Lê as horas do formulário da Produção (na tela): soldas, fabricante, perfil e resposta de cada hora. */
function linhasDoForm(form: HTMLFormElement, cfg: ConfigTlsForm): HoraTls[] {
  const valor = (nome: string) => (form.elements.namedItem(nome) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() ?? '';
  const topo = valor('fabricante') || cfg.fabricanteSalvo;
  const horaTroca = valor('hora_troca_fabricante');
  const topoPerfil = valor('perfil') || cfg.perfilSalvo;
  const horaTrocaPerfil = valor('hora_troca_perfil');
  let trocado: string | undefined;
  let trocadoPerfil: string | undefined;
  return cfg.horas.map((hora) => {
    const troca = valor(`troca_fabricante_${hora}`);
    if (troca) trocado = troca;
    const salvo = cfg.fabricantesSalvos[hora];
    const fabricante = trocado ?? (horaTroca ? (hora < horaTroca ? salvo ?? cfg.fabricanteSalvo : topo) : salvo ?? topo);
    const trocaPerfil = valor(`troca_perfil_${hora}`);
    if (trocaPerfil) trocadoPerfil = trocaPerfil;
    const salvoPerfil = cfg.perfisSalvos?.[hora];
    const perfil = trocadoPerfil ?? (horaTrocaPerfil ? (hora < horaTrocaPerfil ? salvoPerfil ?? cfg.perfilSalvo : topoPerfil) : salvoPerfil ?? topoPerfil);
    const n = parseInt(valor(`soldas_${hora}`), 10);
    return { soldas: Number.isFinite(n) && n > 0 ? n : 0, fabricante, perfil, resposta: valor(`tls_${hora}`) };
  });
}

/** Lê o formulário da Produção (na tela) e devolve a situação do TLS em cada hora. */
export function tlsDoForm(form: HTMLFormElement, cfg: ConfigTlsForm): Record<string, SituacaoTls> {
  const { porHora } = contarTls(cfg.sobraEntrada, linhasDoForm(form, cfg));
  return Object.fromEntries(cfg.horas.map((hora, i) => [hora, porHora[i]]));
}

export interface ResumoTls {
  /** Soldas lançadas hoje. */
  soldasHoje: number;
  /** TLS formados que contam para hoje (o que fecha o TLS que veio de ontem conta para ontem). */
  tlsHoje: number;
  /** Fechou hoje o TLS que tinha começado ontem. */
  fechouOntem: boolean;
  /** Soldas no TLS em aberto agora. */
  aberto: number;
  /** Dessas, quantas foram feitas ontem (ainda não fechou nenhum TLS hoje). */
  deOntem: number;
  /** A última hora com solda é de reemprego: o TLS não fecha em 12. */
  reemprego: boolean;
}

/** Resumo do TLS em montagem a partir do formulário, para o painel ao vivo. */
export function resumoTlsDoForm(form: HTMLFormElement, cfg: ConfigTlsForm): ResumoTls {
  const linhas = linhasDoForm(form, cfg);
  const { tls, sobra } = contarTls(cfg.sobraEntrada, linhas);
  // Trocou de perfil antes de fechar o TLS de ontem: a contagem recomeçou, e o de ontem ficou para trás.
  let recomecou = false;
  let perfilAnterior: string | undefined;
  let fechou = false;
  let aberto = cfg.sobraEntrada;
  for (const h of linhas) {
    if (!fechou && h.perfil !== undefined && perfilAnterior !== undefined && h.perfil !== perfilAnterior) recomecou = true;
    perfilAnterior = h.perfil ?? perfilAnterior;
    aberto += h.soldas;
    if (h.fabricante !== FABRICANTE_REEMPREGO ? aberto >= SOLDAS_POR_TLS : soldasDoTlsEncerrado(h.resposta, aberto) > 0) fechou = true;
  }
  const fechouOntem = cfg.sobraEntrada > 0 && tls > 0 && !recomecou;
  const ultima = [...linhas].reverse().find((h) => h.soldas > 0) ?? linhas.at(-1);
  return {
    soldasHoje: linhas.reduce((t, h) => t + h.soldas, 0),
    tlsHoje: fechouOntem ? tls - 1 : tls,
    fechouOntem,
    aberto: sobra,
    deOntem: tls === 0 && !recomecou ? Math.min(cfg.sobraEntrada, sobra) : 0,
    reemprego: ultima?.fabricante === FABRICANTE_REEMPREGO,
  };
}
