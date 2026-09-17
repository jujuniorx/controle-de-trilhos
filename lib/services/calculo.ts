export type Perfil = 'TR22' | 'TR32' | 'TR37' | 'TR40' | 'TR45' | 'TR50' | 'TR54' | 'TR55' | 'TR57' | 'TR60' | 'TR68';

export function fatorPerfil(perfil: Perfil): number {
  const numero = Number(perfil.replace('TR', ''));
  return numero / 1000;
}

export function calcularPeso(metros: number, perfil: Perfil): number {
  const peso = metros * fatorPerfil(perfil);
  return Math.round(peso * 1000) / 1000;
}

export function calcularMetros(quantidade: number, comprimento: number): number {
  return Math.round(quantidade * comprimento * 100) / 100;
}

export type ClassificacaoSC = 'SC1' | 'SC2' | 'SC3';

export function classificarSC(comprimento: number): ClassificacaoSC {
  if (comprimento >= 7.0 && comprimento <= 12.0) return 'SC1';
  if (comprimento >= 3.0 && comprimento < 7.0) return 'SC2';
  if (comprimento >= 0 && comprimento < 3.0) return 'SC3';
  throw new Error(`Comprimento fora da faixa válida para sucata: ${comprimento}`);
}

export function validarReemprego(comprimento: number): boolean {
  return comprimento >= 7.0;
}
