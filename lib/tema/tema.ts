// Temas do sistema. A escolha fica num cookie (e não em localStorage) para o
// servidor já renderizar o <html data-tema="..."> certo — sem "piscar" de tema e
// sem script inline (o CSP com nonce do middleware.ts bloqueia scripts inline).
//
// Todos os temas trocam cores, cards, menu lateral, fundo e animações (app/globals.css).
// Quem ainda não escolheu nada (sem cookie) começa no Azul-marinho.
export const TEMA_COOKIE = 'ct_tema';

export const TEMAS = ['claro', 'escuro', 'vidro', 'azul', 'pastel'] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = 'azul';

export const ROTULOS_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  escuro: 'Escuro',
  // O identificador continua 'vidro' para não perder a escolha já salva no cookie de quem usa este tema.
  vidro: 'Âmbar',
  azul: 'Azul-marinho',
  pastel: 'Pastel',
};

export function temaValido(valor: string | undefined | null): Tema | undefined {
  return (TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : undefined;
}
