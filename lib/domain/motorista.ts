/** Só os números de um CPF ou telefone digitado com pontos e traços. */
export const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/** Motorista cadastrado pelo CPF (com 11 números). Sem CPF completo, devolve null. */
export function acharMotoristaPorCpf<T extends { cpf: string | null }>(lista: T[], cpfDigitado: string): T | null {
  const digitos = soDigitos(cpfDigitado);
  if (digitos.length !== 11) return null;
  return lista.find((m) => soDigitos(m.cpf) === digitos) ?? null;
}
