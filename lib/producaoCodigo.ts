// Código de cada TLS, para localizar a barra depois de um defeito.
// Formato: ZTP 26/10/2026 S-01 TR60R
//   ZTP        local (fixo)
//   26/10/2026 dia da produção
//   S-01       número do TLS de hoje (a Schlatter é uma só; o número é o TLS gerado).
//              Conta só as soldas de hoje: a cada 12 soldas de hoje sai um número, começando em S-01.
//   TR60R      perfil + tipo (R = Reemprego, N = Novo)

export const LOCAL_CODIGO = 'ZTP';

/** Número do próximo TLS de hoje: a cada 12 soldas lançadas hoje, sai um número (S-01, S-02...). */
export function numeroDoProximoTls(soldasDeHoje: number): number {
  return Math.floor(soldasDeHoje / 12) + 1;
}

/** Código completo de uma barra. data em yyyy-mm-dd. */
export function codigoDaBarra(v: { data: string; perfil: string; fabricante: string; numero: number }): string {
  const [a, m, d] = v.data.split('-');
  const tipo = v.fabricante === 'Reemprego' ? 'R' : 'N';
  const perfil = v.perfil.replace(/\s+/g, '').toUpperCase();
  return `${LOCAL_CODIGO} ${d}/${m}/${a} S-${String(v.numero).padStart(2, '0')} ${perfil}${tipo}`;
}
