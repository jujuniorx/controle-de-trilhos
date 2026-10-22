// Funções puras de negócio, sem dependência de banco de dados — seguras para
// importar tanto em código de servidor quanto em Client Components.

export type Perfil = 'TR22' | 'TR32' | 'TR37' | 'TR40' | 'TR45' | 'TR50' | 'TR54' | 'TR55' | 'TR57' | 'TR60' | 'TR68';

export function calcularMetros(quantidade: number, comprimento: number): number {
  return Math.round(quantidade * comprimento * 100) / 100;
}

export function validarReemprego(comprimento: number): boolean {
  return comprimento >= 7.0;
}

export function arredondar3(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

// Aceita "1234", "1234,50" ou "1234.50" — vírgula ou ponto como separador decimal,
// sem sinal negativo. Retorna null para vazio, texto inválido ou não finito.
export function parseNumeroBR(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classificação automática de Sucata por comprimento (Bloco 2.1): SC1 (>= 7m,
 * sem limite máximo), SC2 (3,00 a 6,99m), SC3 (0 a 2,99m). Só sugere um valor
 * inicial — o Pátio sempre pode trocar manualmente antes de salvar.
 */
export function classificarSC(comprimento: number): 'SC1' | 'SC2' | 'SC3' {
  if (comprimento >= 7) return 'SC1';
  if (comprimento >= 3) return 'SC2';
  return 'SC3';
}

export function pecasDoGrupo(medicoes: { quantidade: number }[]): number {
  return medicoes.reduce((acc, m) => acc + m.quantidade, 0);
}

/**
 * Campo de comprimento do Pátio: quem digita só os números. Os dois últimos dígitos são
 * sempre centavos de metro, e a vírgula entra sozinha: "812" vira "8,12", "1234" vira "12,34".
 */
export function formatarComprimentoDigitado(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 6).replace(/^0+(?=\d)/, '');
  if (!digitos) return '';
  return (parseInt(digitos, 10) / 100).toFixed(2).replace('.', ',');
}
