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

/**
 * Chave para comparar/agrupar locais: ignora acentos ("MARINGÁ" = "MARINGA") e pontuação/espaços
 * ("ITU SP" = "ITU-SP" = "ITUSP"), para que grafias diferentes não virem itens separados.
 */
/** Grafias curtas que são a mesma cidade (ex.: "ITU" é Itu, SP). */
const MESMO_LOCAL: Record<string, string> = { ITU: 'ITUSP' };

export function chaveLocal(valor: string | null | undefined): string {
  const chave = normalizarLocal(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');
  return MESMO_LOCAL[chave] ?? chave;
}
