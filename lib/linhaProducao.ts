/**
 * Estações da linha de produção do estaleiro, na ordem em que o trilho passa, para o passeio da tela inicial:
 * rolando a página, a câmera da cena (components/ui/CenaFerrovia.tsx) anda de estação em estação e a legenda
 * (components/LinhaTour.tsx) mostra o nome e o que cada uma faz.
 *
 * metros: onde a estação fica, em metros a partir da Schlatter (positivo = antes dela, do lado da preparação; o
 *   trilho anda para a esquerda). A barra para a cada 12 m, então as máquinas que trabalham com ela parada ficam em
 *   múltiplos de 12. A régua e o rolo opressor 01 dependem da largura da tela e são posicionados pela cena.
 * p: ponto da rolagem da seção (0 a 1) em que a câmera fica parada na estação.
 */
export type IdEstacao =
  | 'preparacao' | 'geismar' | 'schlatter' | 'regua' | 'rolo' | 'patim' | 'boleteira1' | 'boleteira2' | 'rolos' | 'patio';

export interface EstacaoLinha {
  id: IdEstacao;
  nome: string;
  texto: string;
  metros: number;
  p: number;
}

const BASE: Omit<EstacaoLinha, 'p'>[] = [
  { id: 'preparacao', nome: 'Preparação', metros: 49, texto: 'Dois pórticos de 2 t, um em cada ponta, tiram a barra da pilha e colocam sobre os roletes.' },
  { id: 'geismar', nome: 'Geismar', metros: 12, texto: 'O operador só aperta os botões: a máquina lixa as pontas da barra sozinha, indo para frente e para trás, e o coletor puxa o pó.' },
  { id: 'schlatter', nome: 'Schlatter', metros: 0, texto: 'Solda elétrica por centelhamento: as pontas se aproximam, centelham e recebem o recalque. Depois o soldador raspa a borra pela portinhola.' },
  { id: 'regua', nome: 'Régua', metros: -3.8, texto: 'Logo depois da solda, a régua de aço deitada sobre o boleto confere se a emenda ficou alinhada.' },
  { id: 'rolo', nome: 'Rolo opressor 01', metros: -5.5, texto: 'Dá a tração da linha: os cilindros encostam o rolo no patim e o motor puxa a barra.' },
  { id: 'patim', nome: 'Patim', metros: -36, texto: 'Corre num trilho amarelo no chão, por baixo da barra, e lixa embaixo da emenda. O operador comanda pelos volantes. Trabalho a quente: viseira e avental de raspa.' },
  { id: 'boleteira1', nome: 'Boleteira 1', metros: -48, texto: 'Presa no balancim azul, lixa o boleto e a lateral do trilho. Os cantos o operador acerta com a retífica, que fica no suporte ao lado.' },
  { id: 'boleteira2', nome: 'Boleteira 2', metros: -60, texto: 'A segunda boleteira faz o mesmo acabamento. Aqui o operador fica do outro lado da linha.' },
  { id: 'rolos', nome: 'Rolos opressores', metros: -75, texto: 'Depois do rolete 49, os rolos opressores 02, 03 e 04 puxam o trilho para fora do galpão.' },
  { id: 'patio', nome: 'Pátio do TLS', metros: -95, texto: 'A céu aberto: o operador engata as talhas no trilho longo soldado (TLS), ergue tudo de uma vez e põe na pilha, sobre os cavaletes vermelhos.' },
];

export const ESTACOES_LINHA: EstacaoLinha[] = BASE.map((e, i) => ({ ...e, p: 0.06 + (i * 0.9) / (BASE.length - 1) }));

/** Altura da seção do passeio, em telas: um pouco menos de uma por estação e mais uma de folga. */
export const TELAS_PASSEIO = Math.round(ESTACOES_LINHA.length * 0.75) + 1;
