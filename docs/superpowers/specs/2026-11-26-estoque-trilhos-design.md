# Estoque de trilhos automático — design

Data: 26/11/2026 · Dono: Jurandir Raymundo Junior

## Por quê

O estoque de trilhos vive na planilha "Controle de Estoque - 2026", nas abas "Estoque Novo e Reemprego" e
"Estoque sucata", atualizada à mão com fórmulas soltas (ex.: `=110+20-32+1-18...`). A aba Trilhos do Estoque do
sistema está vazia em produção. O objetivo é substituir essas duas abas: o saldo anda sozinho a partir do que
já é lançado no sistema (recebimentos, envios, Produção, trilheiros), é bonito e fácil de ler, e confere com o SAP.

## Metas

- Mostrar o saldo de **Novo** (TLS, barras lisas, talas, curtas 12 m, menores de 12 m), **Reemprego** (G1, G2, G3)
  e **Sucata** (SC-1, SC-2, SC-3) por perfil, em metros e toneladas, como na prévia aprovada
  (`previa_estoque_trilhos.png`).
- Saldo inicial = a planilha de 25/11/2026. A partir daí, só movimentos do sistema mudam o saldo.
- Toda mudança de saldo tem origem rastreável (qual recebimento, envio, dia de produção, giro ou ajuste).
- Quadro para comparar com o SAP, em toneladas.

## Fora do escopo (decidido pelo usuário)

- Meta do PDM; aba "Estoque TLS" (OK, NOK, trilheiro); TLS com defeito; lista barra a barra das barras curtas;
  abas Soldas, Cálculo solda e Inventários.

## Anti-metas

- Saldo editado direto num número (perde a conta na primeira correção).
- Pedir ao Pátio informação que ele não tem.
- Duplicar entrada: o mesmo recebimento contar duas vezes no saldo.

## Regras de negócio (do usuário)

- Barra nova tem sempre 24 m.
- 1 TLS de novo = 11 barras lisas + 2 talas (barras com furos) de 24 m = 312 m, do perfil e fabricante.
- 1 TLS de reemprego = 312 m de G1 do perfil. G2 não é soldado. Vale para todos os perfis.
- O TLS entra no estoque quando fecha (a contagem diária da Produção continua no dia em que começou).
- Trilheiro sempre leva TLS; pode levar mais de um perfil, e nem sempre 40. O giro registra os TLS por perfil e o
  estoque desconta isso.
- Novo chega por vagão; reemprego e sucata chegam por caminhão.
- O **Pátio** lança a chegada do vagão, a partir do checklist: perfil, fabricante, lisa ou tala, quantidade de barras.
- No envio (remetido) de trilho novo por caminhão, o Pátio escolhe **obrigatoriamente** LISA ou TALA por grupo.
- Sucata em toneladas = metros × fator do perfil − 5% de desgaste.
- Classificações extras do novo continuam: "21 metros", "Torcido", "UHCX (trilho teste)".

## Abordagem

**Escolhida: livro de movimentos.** Uma tabela `EstoqueTrilhoMovimento` guarda cada entrada e saída, com a
"posição" (seção, perfil, tipo, fabricante, classificação), a quantidade em metros (e em unidades para TLS) e a
origem (`origemTipo` + `origemId`). Saldo = soma dos movimentos da posição (o saldo inicial também é um movimento,
do tipo SALDO_INICIAL).

Cada evento de origem tem uma função "refazer movimentos da origem X": apaga os movimentos daquela origem e grava
de novo a partir do estado atual. Assim, corrigir, converter (recebimento ↔ remetido) ou excluir um recebimento
refaz ou zera os movimentos dele, e o saldo se corrige sozinho.

**Descartada: contador editado.** Um saldo por linha somado e subtraído na hora. Mais simples, mas qualquer
correção, conversão ou exclusão exige desfazer à mão, e o histórico não explica o número.

**Descartada: reaproveitar `EstoqueMaterial`.** Ele guarda saldo por item com movimentos manuais e não tem a
dimensão fabricante × tipo × classificação. Forçar a planilha nele vira dezenas de itens soltos.

## Modelo de dados

```
EstoqueTrilhoMovimento
  id, criadoEm, data (dia do fato)
  secao        NOVO | REEMPREGO | SUCATA
  perfil       string (TR22…TR68, UIC60)
  tipo         NOVO: TLS | LISA | TALA | CURTA12 | MENOR12
               REEMPREGO: BARRA        SUCATA: BARRA
  fabricante   string? (só NOVO: NIPPON, EVRAZ, PANGANG, ARCELORMITTAL, UHCX, DIVERSOS)
  classe       string? (NOVO: NORMAL | 21M | TORCIDO | TESTE; REEMPREGO: G1|G2|G3; SUCATA: SC1|SC2|SC3)
  metros       decimal (positivo entra, negativo sai)
  unidades     int? (TLS)
  origemTipo   SALDO_INICIAL | RECEBIMENTO | REMETIDO | PRODUCAO | TRILHEIRO | AJUSTE
  origemId     string? (id da movimentação, data da produção, id do giro)
  motivo, responsavel
  @@index([origemTipo, origemId]) @@index([secao, perfil])
```

- `Grupo` ganha `formaNovo` (LISA | TALA), obrigatória quando `tipoMaterial = NOVO` em remetido e em vagão.
- Vagão: `Movimentacao` com `tipoTransporte = VAGAO`. Os grupos do vagão são por quantidade: `Medicao` com
  `quantidade = n` e `comprimento = 24`.
- Giro do trilheiro: nova tabela `TrilheiroCarga` (giroId ou trilheiro + B.O., perfil, novo/reemprego, quantidade
  de TLS).

## Fluxos

1. **Vagão (Pátio):** nova opção "Chegada de vagão" no Pátio: data, identificação do vagão, linhas com perfil,
   fabricante, LISA ou TALA e quantidade de barras. Vai para Pendências como os outros recebimentos.
   Ao **conferir**, gera movimentos de entrada (quantidade × 24 m).
2. **Recebimento por caminhão conferido:** reemprego entra em G1/G2/G3 pelo grupo; sucata entra em SC-1/2/3 pela
   classificação de cada medição. Jacaré entra como SC-3.
3. **Remetido conferido:** sai do mesmo jeito. Novo sai de LISA ou TALA (campo obrigatório do Pátio).
4. **Produção:** ao gravar o dia, refaz os movimentos daquele dia: cada TLS fechado soma 1 TLS
   (perfil e fabricante da hora em que fechou) e tira 264 m de LISA e 48 m de TALA do mesmo perfil e fabricante;
   TLS de reemprego tira 312 m de G1 e soma 1 TLS de reemprego.
5. **Trilheiro:** ao salvar o giro, refaz os movimentos do giro: tira os TLS de cada perfil.
6. **Ajuste:** só admin, com motivo, na tela do estoque.
7. **Conversão, edição e exclusão** de movimentação chamam "refazer movimentos da origem".

## Tela (aba Trilhos do Estoque)

Como a prévia: quatro totais no topo (TLS prontos, Novo em barras, Reemprego, Sucata), botões Novo / Reemprego /
Sucata / Histórico, tabelas por perfil com subtotal, últimas movimentações e o quadro do SAP. Botões: Baixar PDF,
Ajustar saldo. A chegada de vagão fica no Pátio, não aqui. Responsiva no celular (tabelas viram cartões, como o
resto do sistema). Ícones SVG do sistema, sem emojis.

## Saldo inicial

Script único (com revisão antes de gravar) que lê as duas abas e grava movimentos SALDO_INICIAL com data
25/11/2026. Só recebimentos, envios, produção e giros **depois** dessa data mexem no saldo, para não contar de novo
o que a planilha já inclui.

## Testes

- Unitários das regras: TLS novo (264 + 48 m), TLS reemprego (312 m de G1), sucata com 5%, vagão (n × 24 m).
- Integração: conferir recebimento gera movimento; editar refaz; converter troca sinal; excluir apaga.

## Minhas decisões (para o usuário conferir)

- Fabricante "Pangang 4" e "Pangang 5" da Produção contam como Pangang no estoque.
- O perfil e o fabricante do TLS são os da hora em que ele fechou.
- Envio de "Diversos" (tocos sem medição) não mexe no saldo em metros; aparece no histórico com o peso.
- UIC60 aparece no bloco do TR60, como na planilha.
- Curtas 12 m e menores de 12 m não têm fluxo próprio: vêm do saldo inicial e só mudam por ajuste.

## Em aberto (do usuário)

1. TR60 e UIC60: para o estoque, é o mesmo trilho? A Produção lança os dois separados.
2. Trilheiro: os TLS carregados precisam do fabricante, ou basta perfil e novo/reemprego?
