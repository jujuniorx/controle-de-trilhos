/**
 * Estações da linha de produção do estaleiro, na ordem em que o trilho passa, para o passeio da tela inicial:
 * rolando a página, a câmera da cena (components/ui/CenaFerrovia.tsx) anda de estação em estação e a legenda
 * (components/LinhaTour.tsx) mostra o nome e o que cada uma faz.
 *
 * p: ponto da rolagem da seção (0 a 1) em que a câmera fica parada na estação.
 * As que ainda não foram desenhadas (preparação, Gesmar, patim, boleteiras, pátio do TLS) entram aqui quando
 * ganharem desenho na cena.
 */
export interface EstacaoLinha {
  id: 'schlatter' | 'regua' | 'rolo';
  nome: string;
  texto: string;
  p: number;
}

export const ESTACOES_LINHA: EstacaoLinha[] = [
  {
    id: 'schlatter',
    nome: 'Schlatter',
    texto: 'Solda elétrica por centelhamento: as pontas das barras se aproximam, centelham e recebem o recalque. Depois o soldador raspa a borra pela portinhola.',
    p: 0.18,
  },
  {
    id: 'regua',
    nome: 'Régua',
    texto: 'Logo depois da solda, a régua de aço deitada sobre o boleto confere se a emenda ficou alinhada.',
    p: 0.52,
  },
  {
    id: 'rolo',
    nome: 'Rolo opressor 01',
    texto: 'Dá a tração da linha: os cilindros encostam o rolo no patim e o motor puxa a barra enquanto o soldador segura o joystick.',
    p: 0.86,
  },
];

/** Altura da seção do passeio, em telas: uma por estação e mais uma de folga. */
export const TELAS_PASSEIO = ESTACOES_LINHA.length + 1;
