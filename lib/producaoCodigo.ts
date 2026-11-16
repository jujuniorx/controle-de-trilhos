// Código gravado em cada barra pela máquina de pinação. A máquina só grava o que o sistema mostra;
// assim, quando aparece um defeito, o sistema acha a barra pelo código.
// Formato: ZTP 26/10/2026 S03 TR60R
//   ZTP        local (fixo)
//   26/10/2026 dia da solda
//   S03        número da solda dentro do TLS (reinicia a cada TLS, de 01 a 12)
//   TR60R      perfil + tipo (R = Reemprego, N = Novo)

export const LOCAL_CODIGO = 'ZTP';

/** Próximo número de solda dentro do TLS em montagem: 1 para TLS novo, depois segue a contagem. */
export function numeroDaProximaSolda(soldasNoTlsAberto: number, reemprego: boolean): number {
  if (reemprego) return soldasNoTlsAberto + 1;
  return (soldasNoTlsAberto % 12) + 1;
}

/** Código completo de uma barra. data em yyyy-mm-dd. */
export function codigoDaBarra(v: { data: string; perfil: string; fabricante: string; numero: number }): string {
  const [a, m, d] = v.data.split('-');
  const tipo = v.fabricante === 'Reemprego' ? 'R' : 'N';
  const perfil = v.perfil.replace(/\s+/g, '').toUpperCase();
  return `${LOCAL_CODIGO} ${d}/${m}/${a} S${String(v.numero).padStart(2, '0')} ${perfil}${tipo}`;
}
