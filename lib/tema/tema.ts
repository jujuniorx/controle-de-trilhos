// Temas do sistema. A escolha fica num cookie (e não em localStorage) para o
// servidor já renderizar o <html data-tema="..."> certo — sem "piscar" de tema e
// sem script inline (o CSP com nonce do middleware.ts bloqueia scripts inline).
//
// "claro" e "escuro" são os temas originais (Admin claro, Pátio escuro por padrão).
// "vidro", "azul" e "pastel" são temas completos: trocam cores, cards, menu lateral
// e animações (definidos em app/globals.css).
export const TEMA_COOKIE = 'ct_tema';

export const TEMAS = ['claro', 'escuro', 'vidro', 'azul', 'pastel'] as const;
export type Tema = (typeof TEMAS)[number];

export const ROTULOS_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  escuro: 'Escuro',
  vidro: 'Vidro',
  azul: 'Azul-marinho',
  pastel: 'Pastel',
};

export function temaValido(valor: string | undefined | null): Tema | undefined {
  return (TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : undefined;
}
