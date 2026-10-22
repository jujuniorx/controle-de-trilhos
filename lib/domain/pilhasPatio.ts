/** Opcoes e tipos da lista de pilhas do patio (sem banco: pode ser usado no navegador). */
export const OPCOES_MATERIAL_PILHA: ReadonlyArray<{ grupo: string; opcoes: readonly string[] }> = [
  {
    grupo: 'TLS novo',
    opcoes: [
      'TR68 Nippon', 'TR68 Pangang', 'TR68 Evraz', 'TR68 Arcelormittal', 'TR68 UHCX (teste)',
      'TR68 Nippon 21 m', 'TR68 torcido', 'TR60 Nippon', 'TR60 Evraz', 'TR60 Pangang',
      'TR60 Nippon 21 m', 'TR60 torcido', 'UIC60 novo', 'GB60 novo',
    ],
  },
  {
    grupo: 'TLS reemprego',
    opcoes: [
      'TR45 reemprego', 'TR50 reemprego', 'TR55 reemprego', 'TR57 reemprego', 'TR60 reemprego',
      'TR60 REE', 'TR68 reemprego', 'UIC60 reemprego', 'GB60 reemprego',
    ],
  },
  {
    grupo: 'Barras e talas',
    opcoes: ['Barras lisas', 'Talas (barras com furos)', 'Barras curtas 12 m ou mais', 'Barras curtas menos de 12 m'],
  },
  { grupo: 'Outros', opcoes: ['Sucata', 'Outro'] },
];


export const MATERIAIS_VALIDOS_PILHA = new Set(OPCOES_MATERIAL_PILHA.flatMap((g) => g.opcoes));

export type PilhaPatio = {
  id: string;
  nome: string;
  material: string;
  observacao: string;
  atualizadoEm: string;
};

export type DadosPilhaPatio = { nome: string; material: string; observacao: string };

