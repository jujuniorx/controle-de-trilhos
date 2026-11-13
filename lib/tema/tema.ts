// Temas do sistema. A escolha fica num cookie (e não em localStorage) para o
// servidor já renderizar o <html data-tema="..."> certo — sem "piscar" de tema e
// sem script inline (o CSP com nonce do middleware.ts bloqueia scripts inline).
//
// Todos os temas trocam cores, cards, menu lateral, fundo e animações (app/globals.css).
// Quem ainda não escolheu nada (sem cookie) começa no Azul-marinho.
export const TEMA_COOKIE = 'ct_tema';

export const TEMAS = ['claro', 'escuro', 'azul', 'pastel', 'vermelho', 'laranja'] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = 'azul';

export const ROTULOS_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  escuro: 'Escuro',
  azul: 'Azul-marinho',
  pastel: 'Pastel',
  vermelho: 'Vermelho',
  laranja: 'Laranja',
};

export function temaValido(valor: string | undefined | null): Tema | undefined {
  return (TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : undefined;
}

/** Cor da barra do sistema e do fundo da abertura do app, por tema. */
export const COR_APP: Record<Tema, string> = {
  claro: '#ededeb',
  escuro: '#000000',
  azul: '#050a1c',
  pastel: '#efe6ff',
  vermelho: '#0b0b0b',
  laranja: '#f7a524',
};

/** Ícones do app por tema (pasta public/icons/<tema>). */
export function iconesDoTema(tema: Tema) {
  const pasta = `/icons/${tema}`;
  return { favicon: `${pasta}/favicon-48.png`, apple: `${pasta}/apple-touch-icon.png` };
}
