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
  | 'preparacao' | 'geismar' | 'schlatter' | 'regua' | 'rolo' | 'corte' | 'patim' | 'boleteira1' | 'boleteira2' | 'rolos' | 'patio';

export interface EstacaoLinha {
  id: IdEstacao;
  nome: string;
  texto: string;
  metros: number;
  p: number;
}

const BASE: Omit<EstacaoLinha, 'p'>[] = [
  { id: 'preparacao', nome: 'Preparação', metros: 26, texto: 'Dois pórticos de 2 t, um em cada ponta da barra. Os dois operadores vão até a pilha, engatam as talhas, erguem a barra pela botoeira e põem sobre os roletes. Depois soltam os ganchos.' },
  { id: 'geismar', nome: 'Geismar', metros: 13, texto: 'Trabalha lado a lado com a preparação. Um operador só aperta os botões: lá dentro os rebolos descem e lixam as pontas da barra, e o coletor puxa o pó.' },
  { id: 'schlatter', nome: 'Schlatter', metros: 0, texto: 'Solda elétrica por centelhamento: as pontas se aproximam, centelham e recebem o recalque. Depois o soldador raspa a borra pela portinhola.' },
  { id: 'regua', nome: 'Régua', metros: -3.8, texto: 'Logo depois da solda, a régua de aço deitada sobre o boleto confere se a emenda ficou alinhada.' },
  { id: 'rolo', nome: 'Rolo opressor 01', metros: -5.5, texto: 'Dá a tração da linha: os cilindros encostam o rolo no patim e o motor puxa a barra.' },
  { id: 'corte', nome: 'Área de corte', metros: -16, texto: 'O trilho passa por aqui. Se alguma solda dá errado, a emenda vem para este canto e o trecho é cortado, na plataforma atrás das cortinas pretas.' },
  { id: 'patim', nome: 'Patim', metros: -36, texto: 'Corre num trilho amarelo no chão, por baixo da barra, e lixa embaixo da emenda. O operador comanda pelos volantes. Trabalho a quente: viseira e avental de raspa.' },
  { id: 'boleteira1', nome: 'Boleteira 1', metros: -48, texto: 'A esmerilhadeira roda em cima do trilho, pendurada pela mola no balancim azul. O operador empurra e puxa pela barra do quadro enquanto o rebolo lixa o boleto. Os discos ficam nos cavaletes ao lado.' },
  { id: 'boleteira2', nome: 'Boleteira 2', metros: -60, texto: 'A segunda boleteira faz o mesmo acabamento. Aqui o operador fica do outro lado da linha.' },
  { id: 'rolos', nome: 'Rolos opressores', metros: -75, texto: 'Depois do rolete 49, os rolos opressores 02, 03 e 04 puxam o trilho para fora do galpão.' },
  { id: 'patio', nome: 'Pátio do TLS', metros: -95, texto: 'A céu aberto: dois operadores vão de talha em talha engatando o trilho longo soldado (TLS), erguem tudo de uma vez pelo controle e põem na pilha, sobre os cavaletes vermelhos. Depois soltam uma a uma.' },
];

export const ESTACOES_LINHA: EstacaoLinha[] = BASE.map((e, i) => ({ ...e, p: 0.06 + (i * 0.9) / (BASE.length - 1) }));

/** Altura da seção do passeio, em telas: um pouco menos de uma por estação e mais uma de folga. */
export const TELAS_PASSEIO = Math.round(ESTACOES_LINHA.length * 0.75) + 1;
