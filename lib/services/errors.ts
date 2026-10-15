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

/**
 * Resumo curto e seguro de uma exceção inesperada (código do Prisma ou nome + 1ª linha, sem SQL
 * nem dados). Vai na resposta 503 do sync para o tablet mostrar o motivo real em vez de ficar
 * "carregando" sem explicação.
 */
export function resumirErro(erro: unknown): string {
  if (!(erro instanceof Error)) return 'erro desconhecido';
  const codigo = (erro as { code?: unknown }).code;
  const linhas = erro.message.split('\n').map((l) => l.trim()).filter(Boolean);
  const ultima = linhas[linhas.length - 1] ?? '';
  const texto = `${typeof codigo === 'string' ? codigo : erro.name}: ${ultima}`;
  return texto.length > 160 ? `${texto.slice(0, 157)}...` : texto;
}
