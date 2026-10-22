// Padrão único para locais de origem/destino (cidades, usinas, depósitos).
//
// As pessoas digitam do jeito que querem ("Ponta Grossa", "Ponta grossa", " PONTA  GROSSA "),
// e isso virava itens diferentes nos relatórios e gráficos. O padrão do sistema é:
// sem espaços sobrando e em MAIÚSCULAS — o mesmo da exportação para o Excel.
//
// Funções puras (sem banco): servem para o servidor gravar, para os gráficos agruparem
// e para telas exibirem também registros antigos, que ainda estão com a grafia original.

/** Espaços das pontas removidos, espaços repetidos reduzidos a um e tudo em maiúsculas. */
export function normalizarLocal(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
}

/** Chave para comparar/agrupar locais: igual a normalizarLocal, ignorando acentos ("MARINGÁ" = "MARINGA"). */
export function chaveLocal(valor: string | null | undefined): string {
  return normalizarLocal(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
