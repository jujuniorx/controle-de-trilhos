// Tema claro/escuro. A escolha fica num cookie (e não em localStorage) para o
// servidor já renderizar o <html data-tema="..."> certo — sem "piscar" de tema e
// sem script inline (o CSP com nonce do middleware.ts bloqueia scripts inline).
export const TEMA_COOKIE = 'ct_tema';
export const TEMAS = ['claro', 'escuro'] as const;
export type Tema = (typeof TEMAS)[number];

export function temaValido(valor: string | undefined | null): Tema | undefined {
  return (TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : undefined;
}
