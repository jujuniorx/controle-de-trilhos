/**
 * Falha de regra de negócio / cadastro: reenviar exatamente o mesmo payload, sem
 * nenhuma intervenção (corrigir o cadastro, corrigir o payload, mudar código),
 * nunca vai passar a dar certo.
 *
 * Serve para separar este caso de uma falha de infraestrutura (banco indisponível,
 * cold start, pool esgotado, timeout de transação), que é transitória e *deve* ser
 * reenviada. Route Handlers traduzem `ErroRegraNegocio` em 422 (terminal para o
 * cliente offline) e qualquer outra exceção em 5xx (recuperável) — ver
 * `app/api/sync/route.ts` e `lib/offline/sync.ts`.
 *
 * A `message` de um ErroRegraNegocio é escrita por nós e pode ser devolvida ao
 * cliente; a de qualquer outra exceção (Prisma, runtime) não pode.
 */
export class ErroRegraNegocio extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroRegraNegocio';
  }
}
