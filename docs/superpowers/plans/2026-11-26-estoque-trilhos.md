# Estoque de trilhos automático — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as abas "Estoque Novo e Reemprego" e "Estoque sucata" da planilha por uma aba Trilhos no Estoque, com resumo e detalhado, cujo saldo anda sozinho a partir de vagões, caminhões, envios, Produção e trilheiros.

**Architecture:** O saldo é **calculado na leitura**: saldo inicial (gravado) + ajustes (gravados) + lançamentos **derivados** das fontes (movimentações conferidas, dias da Produção, cargas do trilheiro) com data depois de 25/11/2026. Derivar na leitura, em vez de gravar um livro e refazê-lo em cada edição, deixa correção, conversão, exclusão e restauração de uma movimentação refletirem sozinhas no saldo, sem ganchos espalhados (decisão de implementação; o resultado é o do design). As regras ficam em funções puras testáveis em `lib/estoque/`; os serviços só buscam dados e chamam essas funções.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma 6 + PostgreSQL (Neon), Vitest, Tailwind e CSS do projeto.

**Spec:** `docs/superpowers/specs/2026-11-26-estoque-trilhos-design.md`. Prévias aprovadas: `estoque_simples.png`, `estoque_detalhado.png` (geradas de `scratchpad/estoque/simples.html` e `detalhado.html`; o HTML é a referência visual).

## Global Constraints

- Sem emojis na interface; ícones SVG de `components/icones/Icones.tsx` (CLAUDE.md).
- Barra nova = 24 m. 1 TLS novo = 11 lisas + 2 talas = 264 m LISA + 48 m TALA do perfil e fabricante. 1 TLS reemprego = 312 m de G1 do perfil.
- Corte: saldo inicial na data 2026-11-25; só fatos com data **> 2026-11-25** mexem no saldo.
- Sucata em toneladas = metros × fator do perfil × 0,95.
- Fatores (t/m): TR22 0,022 · TR32 0,032 · TR37 0,037 · TR40 0,040 · TR45 0,045 · TR50 0,050 · TR54 0,054 · TR55 0,055 · TR57 0,057 · TR60 0,060 · UIC60 0,060 · TR68 0,068 (tabela `FatorPerfil` + UIC60).
- TR60 e UIC60 são trilhos diferentes. "Pangang 4" e "Pangang 5" = PANGANG.
- Só admin ajusta saldo, sempre com motivo.
- Push para o GitHub só com "sobe" do usuário. Commits locais à vontade.
- Este ambiente não tem `node_modules` nem rede: `npx vitest`/`tsc` não rodam aqui. Cada task roda os testes quando houver ambiente (local do usuário ou CI); aqui, a verificação é por leitura e pela prévia renderizada.

## Review Focus

1. Movimentação conferida e depois **reaberta** (edição volta para PENDENTE) — some do saldo até ser conferida de novo. Teste em Task 5.
2. Movimentação **convertida** (recebimento ↔ remetido) — o sinal troca sozinho porque o tipo é lido na hora. Teste em Task 2.
3. Dia da Produção **corrigido pelo admin** depois (TLS a mais ou a menos) — o saldo segue o dia como está agora. Teste em Task 2.
4. Saldo **negativo** (consumo de lisa que não estava na planilha) — mostra em vermelho com "confira o saldo", sem quebrar a tela nem as contas de "dá para formar" (negativo conta como 0). Teste em Task 1.
5. Remetido antigo de NOVO **sem forma** (Lisa/Tala) e grupo "Diversos" sem metros — não mexem nos metros e aparecem no histórico marcados. Teste em Task 2.

---

### Task 0: Destravar as migrações em produção (ação do usuário)

O `_prisma_migrations` de produção tem `20261111100000_paradas_por_hora` com `finished_at` nulo e `rolled_back_at` nulo; enquanto isso, `prisma migrate deploy` recusa migrações novas (o `prebuild.sh` engole o erro). As colunas dela já existem.

- [ ] **Step 1:** Pedir ao usuário para rodar (ou autorizar rodar) no branch `production` do Neon:
  `UPDATE "_prisma_migrations" SET finished_at = now(), logs = NULL WHERE migration_name = '20261111100000_paradas_por_hora' AND finished_at IS NULL;`
- [ ] **Step 2:** Conferir: `SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;` → `0`.

Bloqueia o deploy da Task 3 em diante, não o desenvolvimento.

### Task 1: Domínio do estoque de trilhos (funções puras)

**Files:**
- Create: `lib/estoque/trilhos.ts`
- Test: `tests/unit/estoque-trilhos.test.ts`

**Interfaces — Produces:**
```ts
export const CORTE_SALDO_INICIAL = '2026-11-25';
export const METROS_BARRA = 24; export const METROS_TLS = 312;
export type Secao = 'NOVO' | 'REEMPREGO' | 'SUCATA';
export type TipoNovo = 'TLS' | 'LISA' | 'TALA' | 'CURTA12' | 'MENOR12';
export type ClasseNovo = 'NORMAL' | '21M' | 'TORCIDO' | 'TESTE';
export type Fabricante = 'NIPPON' | 'EVRAZ' | 'PANGANG' | 'ARCELORMITTAL' | 'UHCX' | 'DIVERSOS';
export interface Posicao { secao: Secao; perfil: string; tipo: TipoNovo | 'BARRA'; fabricante: Fabricante | null; classe: string }
// classe: NOVO → ClasseNovo; REEMPREGO → 'G1'|'G2'|'G3'; SUCATA → 'SC1'|'SC2'|'SC3'
export type OrigemTipo = 'SALDO_INICIAL' | 'AJUSTE' | 'RECEBIMENTO' | 'REMETIDO' | 'PRODUCAO' | 'TRILHEIRO';
export interface Lancamento extends Posicao { data: string /* yyyy-mm-dd */; metros: number; unidades: number | null; origemTipo: OrigemTipo; origemId: string | null; descricao: string; alerta?: string }
export function chavePosicao(p: Posicao): string;
export function normalizarFabricante(nome: string | null | undefined): Fabricante | null; // 'Pangang 4'|'Pangang 5'|'PANGANG' → PANGANG; 'Arcelormital' → ARCELORMITTAL; desconhecido → DIVERSOS; vazio → null
export function fatorPerfil(perfil: string): number;
export function toneladas(p: Pick<Posicao,'secao'|'perfil'>, metros: number): number; // SUCATA aplica 0,95
export interface Saldo extends Posicao { metros: number; unidades: number | null }
export function somarSaldos(lancamentos: Lancamento[]): Saldo[]; // agrupa por chavePosicao; ordem: secao, perfil, fabricante, classe, tipo
export interface MovimentoPeriodo { anterior: number; entradas: number; saidas: number; saldo: number }
export function movimentoDoPeriodo(lancamentos: Lancamento[], chave: string, de: string, ate: string): MovimentoPeriodo; // em metros (unidades para TLS)
export interface TlsPossiveis { fabricante: Fabricante; tls: number; trava: 'LISA' | 'TALA' | null; lisasBarras: number; talasBarras: number; sobraLisas: number; sobraTalas: number }
export function tlsPossiveisPorFabricante(saldos: Saldo[], perfil: string): TlsPossiveis[]; // só classe NORMAL e UHCX TESTE; barras = floor(max(0,metros)/24); tls = min(floor(lisas/11), floor(talas/2)); ordenado por tls desc
```

- [ ] **Step 1: Write the failing tests** in `tests/unit/estoque-trilhos.test.ts`:
  - `normalizarFabricante('Pangang 4') === 'PANGANG'`, `('Pangang 5')`, `('Arcelormital') === 'ARCELORMITTAL'`, `('Nippon') === 'NIPPON'`.
  - `toneladas({secao:'NOVO',perfil:'TR68'}, 29640)` ≈ `2015.52`; `toneladas({secao:'SUCATA',perfil:'TR45'}, 9270.31)` ≈ `396.30` (±0,01).
  - `somarSaldos` de três lançamentos na mesma posição (+100, −30, +5) → um saldo `75`.
  - `movimentoDoPeriodo` com lançamentos em 2026-11-20 (+100), 2026-11-26 (+50), 2026-11-27 (−20), período 26–27 → `{anterior:100, entradas:50, saidas:20, saldo:130}`.
  - `tlsPossiveisPorFabricante` com TR60 PANGANG LISA 40932 m e TALA 4224 m → `{tls: 88, trava: 'TALA', lisasBarras: 1705, talasBarras: 176, sobraLisas: 737, sobraTalas: 0}`; NIPPON TR68 LISA 0, TALA 8088 → `{tls: 0, trava: 'LISA'}`; LISA −264 (negativo) → `lisasBarras: 0`.
- [ ] **Step 2:** `npx vitest run tests/unit/estoque-trilhos.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `lib/estoque/trilhos.ts` com as assinaturas acima. `fatorPerfil` lê de uma constante local (os mesmos valores da `FatorPerfil` + UIC60 0,060).
- [ ] **Step 4:** Rodar de novo → PASS.
- [ ] **Step 5:** Commit `Estoque de trilhos: dominio e calculos`.

### Task 2: Derivações das fontes (funções puras)

**Files:**
- Create: `lib/estoque/derivacoes.ts`
- Modify: `lib/producaoTls.ts` (adicionar `tlsFechadosPorHora`)
- Test: `tests/unit/estoque-derivacoes.test.ts`

**Interfaces — Consumes:** Task 1 (`Lancamento`, `normalizarFabricante`, constantes). **Produces:**
```ts
// lib/producaoTls.ts
export interface TlsFechado { hora: string; perfil: string; fabricante: string; reemprego: boolean; quantidade: number }
export function tlsFechadosPorHora(sobraEntrada: number, horas: (HoraTls & { hora: string })[]): TlsFechado[];
// diferença de contarTls(sobra, horas.slice(0, i+1)).tls entre horas consecutivas; reemprego = fabricante === FABRICANTE_REEMPREGO

// lib/estoque/derivacoes.ts
export interface MovFonte { id: string; tipo: 'RECEBIMENTO' | 'REMETIDO'; status: string; data: string; rotulo: string;
  grupos: { tipoMaterial: 'NOVO'|'REEMPREGO'|'SUCATA'; perfil: string; classificacao: 'G1'|'G2'|'G3'|null; fabricante: string|null; formaNovo: 'LISA'|'TALA'|null; metrosTotal: number;
    medicoes: { metros: number; classificacaoSC: 'SC1'|'SC2'|'SC3'|'DIVERSOS'|'JACARE'|null }[] }[] }
export function lancamentosDeMovimentacao(m: MovFonte): Lancamento[]; // só status CONFERIDO; RECEBIMENTO soma, REMETIDO subtrai
export interface DiaProducaoFonte { data: string; sobraEntrada: number; ajusteTls: number; horas: (HoraTls & { hora: string })[] }
export function lancamentosDeProducao(d: DiaProducaoFonte): Lancamento[];
export interface CargaFonte { id: string; trilheiro: string; boEm: string; perfil: string; reemprego: boolean; fabricante: string | null; quantidade: number }
export function lancamentosDeCarga(c: CargaFonte): Lancamento[]; // −quantidade TLS, −quantidade×312 m
```
Regras de `lancamentosDeMovimentacao`: NOVO → posição (NOVO, perfil, formaNovo, fabricante normalizado, NORMAL); sem `formaNovo` → **nenhum lançamento em metros**, um lançamento de 0 m com `alerta: 'Novo sem Lisa/Tala'`. REEMPREGO → (REEMPREGO, perfil, BARRA, null, classificacao), metros = `metrosTotal`. SUCATA → por medição: SC1/SC2/SC3 direto, JACARE → SC3, DIVERSOS → 0 m com `alerta: 'Diversos sem metros'`.
Regras de `lancamentosDeProducao`: horas passam por `descontarBarras(horas, ajusteTls)` antes (mesma cadeia de `recalcularAPartir`). Para cada `TlsFechado`: novo → +quantidade TLS (unidades, metros = q×312) na posição (NOVO, perfil, TLS, fabricante, NORMAL), −q×264 LISA, −q×48 TALA; reemprego → +q TLS de reemprego na posição (REEMPREGO, perfil, TLS, null, classe `'TLS'`) e −q×312 m em (REEMPREGO, perfil, BARRA, null, G1).

- [ ] **Step 1: Write the failing tests:**
  - Recebimento CONFERIDO com grupo REEMPREGO TR60 G2 312,4 m → um lançamento `+312.4` em `REEMPREGO|TR60|BARRA||G2`.
  - Mesmo objeto com `tipo: 'REMETIDO'` → `−312.4` (cobre conversão). Com `status: 'PENDENTE_CONFERENCIA'` → `[]` (cobre reabertura).
  - Sucata com medições SC1 10 m, JACARE 3 m, DIVERSOS 0 m → `+10 SC1`, `+3 SC3`, e um lançamento com `alerta`.
  - Remetido NOVO sem `formaNovo` → metros 0 e `alerta`.
  - `tlsFechadosPorHora(0, [12 soldas Pangang 4 TR68 07:00, 12 soldas 08:00])` → dois fechamentos de 1.
  - `lancamentosDeProducao` com 1 TLS TR68 "Pangang 5" → TLS `+1` (312 m), LISA `−264`, TALA `−48`, fabricante `PANGANG`; com `ajusteTls: 12` sobre 12 soldas → `[]`.
  - `lancamentosDeCarga({quantidade: 32, perfil:'TR68', fabricante:'Pangang', reemprego:false})` → TLS `−32`, metros `−9984`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar → PASS (inclui os testes existentes de `producaoTls`).
- [ ] **Step 5:** Commit `Estoque de trilhos: derivacoes de recebimento, envio, producao e trilheiro`.

### Task 3: Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261126120000_estoque_trilhos/migration.sql`

**Produces (Prisma):**
```prisma
enum FormaNovo { LISA TALA }
// Grupo: formaNovo FormaNovo?
model EstoqueTrilhoLancamento {   // só SALDO_INICIAL e AJUSTE; o resto é derivado
  id String @id @default(cuid())
  data DateTime @db.Date
  secao String; perfil String; tipo String; fabricante String?; classe String
  metros Decimal @db.Decimal(14, 3); unidades Int?
  origemTipo String // SALDO_INICIAL | AJUSTE
  motivo String?; responsavel String
  criadoEm DateTime @default(now())
  @@index([origemTipo])
}
model TrilheiroCarga {
  id String @id @default(cuid())
  trilheiro TrilheiroCod; boEm DateTime @db.Date
  perfil String; reemprego Boolean @default(false); fabricante String?; quantidade Int
  criadoEm DateTime @default(now()); atualizadoEm DateTime @updatedAt
  @@index([trilheiro, boEm])
}
model EstoqueSapValor { item String @id /* ex.: 'TLS_TR60', 'BARRAS_TR68' */ toneladas Decimal @db.Decimal(12,3) responsavel String atualizadoEm DateTime @updatedAt }
```
- [ ] **Step 1:** Editar o schema; escrever a migração SQL à mão (CREATE TYPE, ALTER TABLE "Grupo" ADD COLUMN "formaNovo", CREATE TABLE × 3, índices).
- [ ] **Step 2:** `npx prisma validate` → "The schema is valid".
- [ ] **Step 3:** Commit `Estoque de trilhos: tabelas e forma do novo no grupo`.

### Task 4: Saldo inicial da planilha

**Files:**
- Create: `lib/estoque/saldoInicial2026.ts` (dados), `lib/services/estoqueTrilhos.ts` (função `carregarSaldoInicial`)
- Test: `tests/unit/estoque-saldo-inicial.test.ts`

**Interfaces — Produces:**
```ts
export const SALDO_INICIAL_2026: Omit<Lancamento, 'origemTipo'|'origemId'|'data'|'descricao'>[];
export async function carregarSaldoInicial(responsavel: string): Promise<{ criados: number }>; // idempotente: não faz nada se já existe SALDO_INICIAL
```
Dados: gerar com um script de uma vez (ler `Controle_de_Estoque_-_2026.F.xlsx` com openpyxl, `data_only=True`):
- Aba "Estoque Novo e Reemprego", linhas 4–18 (pular 10 e 19, totais): perfil (col B; a linha UIC60 vira perfil `UIC60`), classe (C: "Novo"→NORMAL, "Novo 21 metros"→21M, "Torcido"→TORCIDO, "UHCX (Trilho Teste)"→TESTE), fabricante (D, normalizado), TLS = E (unidades) e E×312 m, LISA = H, TALA = I, CURTA12 = J, MENOR12 = K. Só linhas com valor ≠ 0.
- Mesma aba, linhas 30–43: REEMPREGO perfil (B), classe G1/G2/G3 (C), metros = H.
- Aba "Estoque sucata", A3:B34: perfil e classe do rótulo ("TR-45 1" → TR45 SC1), metros = B. Só ≠ 0.

- [ ] **Step 1: Write the failing test:** somando `SALDO_INICIAL_2026` por seção bate com a planilha: TLS TR60 = 52 e TR68 = 95 unidades; LISA TR60 = 96 032 m; TALA TR68 = 29 586 m; MENOR12 UIC60 = 796,47; REEMPREGO total = 32 298,05 m; SUCATA total = 64 325,21 m; SC3 total = 2 099,553 m.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Gerar o arquivo de dados com o script e implementar `carregarSaldoInicial` (createMany com data 2026-11-25, `origemTipo: 'SALDO_INICIAL'`).
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `Estoque de trilhos: saldo inicial da planilha de 25/11/2026`.

### Task 5: Serviço do estoque e ações do admin

**Files:**
- Modify: `lib/services/estoqueTrilhos.ts`
- Create: `app/admin/(protegido)/estoque/trilhos-actions.ts`
- Test: `tests/integration/estoque-trilhos.test.ts`

**Interfaces — Consumes:** Tasks 1, 2, 4. **Produces:**
```ts
export interface EstoqueTrilhos { saldos: Saldo[]; lancamentos: Lancamento[]; sap: Record<string, number>; atualizadoEm: string | null; temSaldoInicial: boolean }
export async function montarEstoqueTrilhos(): Promise<EstoqueTrilhos>;
// lê: EstoqueTrilhoLancamento; movimentações CONFERIDO com dataMovimentacao > corte (grupos + medições);
// ProducaoDia com data > corte (linhas, sobraEntrada, ajusteTls); TrilheiroCarga com boEm > corte; EstoqueSapValor
export async function ajustarSaldoTrilho(p: Posicao, metros: number, unidades: number | null, motivo: string, responsavel: string): Promise<void>;
export async function salvarValorSap(item: string, toneladas: number, responsavel: string): Promise<void>;
// actions (requireAdmin + registrarAuditoria): carregarSaldoInicialAction, ajustarSaldoTrilhoAction(formData), salvarSapAction(formData)
```
Validação das ações: motivo ≥ 10 letras; metros ≠ 0; item SAP em `['TLS_TR60','TLS_TR68','TLS_UIC60','BARRAS_TR60','BARRAS_TR68','BARRAS_UIC60']`.

- [ ] **Step 1: Write the failing integration tests:** banco de teste com saldo inicial carregado + um recebimento CONFERIDO de reemprego TR60 G2 10 m em 2026-11-26 → saldo G2 TR60 = 15 558,76 + 10. Reabrir o mesmo recebimento (status PENDENTE) → volta a 15 558,76. Ajuste −12 m com motivo → aparece em `lancamentos` com `origemTipo 'AJUSTE'`. `carregarSaldoInicial` duas vezes → segunda retorna `{criados: 0}`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `Estoque de trilhos: servico, ajuste e valores do SAP`.

### Task 6: Tela — resumo e detalhado

**Files:**
- Create: `components/estoque/trilhos/EstoqueTrilhos.tsx` (servidor: busca e escolhe a vista), `ResumoTrilhos.tsx`, `DetalhadoTrilhos.tsx`, `ChaveVista.tsx` (cliente: "Ver resumo / Ver detalhado", lembra em cookie `estoque_trilhos_vista`), `AjusteTrilhoForm.tsx`, `SapForm.tsx`
- Modify: `app/admin/(protegido)/estoque/page.tsx` (aba Trilhos usa `EstoqueTrilhos`; `searchParams.vista` e `de`/`ate`/`aba`), `app/temas.css` (classes `est-tr-*`)
- Remove do uso: `components/estoque/TrilhosEstoque.tsx` (manter o arquivo até a Task 10)

Comportamento (referência visual: `simples.html` e `detalhado.html`):
- Sem saldo inicial → estado vazio com botão "Carregar saldo da planilha de 25/11/2026" (`carregarSaldoInicialAction`).
- **Resumo:** selos SAP (verde "TLS bate com o SAP" quando |dif| < 0,5 TLS; âmbar com a diferença em t); cartões TR68 e TR60 (e UIC60 se tiver TLS ou lisa/tala) com TLS prontos, "+N TLS que dá para formar" (`tlsPossiveisPorFabricante`), trava e sobras; linha "Também no estoque de novo"; reemprego e sucata em barras empilhadas (largura proporcional ao maior perfil); dica de TLS de reemprego por G1 (floor(G1/312)) só para TR60, TR68, UIC60; 3 últimos lançamentos.
- **Detalhado:** período (`de`/`ate`, padrão início do mês até hoje), abas Novo e reemprego / Sucata / Conferir com o SAP / Movimentos; tabela do novo com as colunas da planilha e subtotal por perfil; toggle Saldo/Movimento (usa `movimentoDoPeriodo`); sucata com os quatro resumos (longas, curtas, tocos, total em m e t); SAP com campos editáveis e diferença; Movimentos = lista de `lancamentos` do período com origem, link para a movimentação/dia/giro e `alerta` em âmbar.
- Saldo negativo: número em vermelho e "confira o saldo".
- Celular (≤ 640 px): tabelas viram cartões, como o resto do sistema.

- [ ] **Step 1:** Implementar os componentes.
- [ ] **Step 2:** Verificar renderizando com os dados do saldo inicial: os números do resumo batem com a prévia (95 / +185 TR68; 52 / +268 TR60; reemprego 32 298 m; sucata 3 595,4 t).
- [ ] **Step 3:** Screenshot em 1440 px e 390 px; conferir que não há texto cortado nem tabela vazando da tela.
- [ ] **Step 4:** Commit `Estoque de trilhos: telas resumo e detalhado`.

### Task 7: Lisa ou Tala obrigatória no envio de novo (Pátio)

**Files:**
- Modify: `lib/validation/remetido.ts` (`grupoRemetidoNovoSchema` ganha `formaNovo: z.enum(['LISA','TALA'], { message: 'Escolha se é barra lisa ou tala.' })`), `lib/services/remetido.ts` (gravar `formaNovo` em `criarPreCadastroRemetido`, `criarRemetidoDireto`, `atualizarRemetido`), o formulário de grupo do remetido no Pátio (`app/patio/(protegido)/remetidos/novo/*`), a rota `app/api/sync/pre-cadastro` (aceita o campo), detalhe e romaneio do remetido no admin (mostrar "Lisa"/"Tala").
- Test: `tests/unit/validation-remetido.test.ts`

- [ ] **Step 1: Write the failing tests:** grupo NOVO sem `formaNovo` → erro "Escolha se é barra lisa ou tala."; com `'TALA'` → válido; grupo REEMPREGO com `formaNovo` → ignorado/rejeitado (não se aplica).
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar; no formulário, dois botões grandes "Barra lisa" e "Tala (com furos)" logo abaixo da marca, só quando o material é Novo.
- [ ] **Step 4:** Rodar → PASS, incluindo `sync-route-classificacao` e `offline-sync` (ajustar fixtures de NOVO com `formaNovo`).
- [ ] **Step 5:** Commit `Remetido: Patio escolhe barra lisa ou tala no envio de novo`.

### Task 8: Chegada de vagão no Pátio

**Files:**
- Create: `lib/validation/vagao.ts`, `app/patio/(protegido)/vagoes/novo/page.tsx`, `app/patio/(protegido)/vagoes/novo/VagaoForm.tsx`, `app/patio/(protegido)/vagoes/actions.ts`
- Modify: `lib/services/movimentacao.ts` (`criarChegadaVagao`), página inicial do Pátio (botão "Chegada de vagão"), lista de Pendências e detalhe do recebimento no admin (rótulo "Vagão", mostrar Lisa/Tala e "N barras de 24 m").
- Test: `tests/unit/validation-vagao.test.ts`, `tests/integration/vagao.test.ts`

**Interfaces — Produces:**
```ts
export const chegadaVagaoSchema: z.ZodType<ChegadaVagaoInput>;
export interface ChegadaVagaoInput { data: string; vagao: string /* identificação, obrigatória */; numeroDocumento?: string; responsavelPatio: string; observacao?: string;
  linhas: { perfil: 'TR60'|'TR68'|'UIC60'|string; marca: 'NIPPON'|'EVRAZ'|'PANGANG'|'OUTROS'; fabricanteOutro?: string; formaNovo: 'LISA'|'TALA'; barras: number /* inteiro ≥ 1 */ }[] /* ≥ 1 */ }
export async function criarChegadaVagao(input: ChegadaVagaoInput): Promise<{ id: string }>;
// Movimentacao RECEBIMENTO, tipoTransporte VAGAO, status PENDENTE_CONFERENCIA, tipoDocumento 'NF', origem 'VAGÃO <vagao>';
// um Grupo NOVO por linha (fabricante, formaNovo, metrosTotal = barras×24) com uma Medicao QTD_COMPRIMENTO (quantidade = barras, comprimento 24)
```
Decisão: tela online (server action), sem fila offline; se não houver sinal, mostra "Sem conexão. Tente de novo quando o sinal voltar." e mantém o que foi digitado.

- [ ] **Step 1: Write the failing tests:** schema rejeita linha sem `formaNovo`, `barras: 0` e lista vazia; aceita 1 linha válida. Integração: `criarChegadaVagao` com 36 lisas + 6 talas TR68 Pangang cria 2 grupos com 864 m e 144 m e status PENDENTE; depois de `conferirRecebimento`, `montarEstoqueTrilhos` soma 864 em LISA e 144 em TALA TR68 PANGANG.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar. Formulário: data, vagão, linhas (perfil, marca, Lisa/Tala, número de barras com +/−), total "N barras · N × 24 m" ao vivo, botão "Enviar para conferência".
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `Patio: chegada de vagao com barras lisas e talas`.

### Task 9: TLS carregados no giro do trilheiro

**Files:**
- Modify: `lib/services/usina.ts` (`listarCargasDoBo`, `salvarCargasDoBo`), `app/admin/(protegido)/usina/actions.ts` (`salvarCargasTrilheiroAction`), `app/admin/(protegido)/usina/page.tsx` (bloco "TLS carregados neste B.O." em cada trilheiro)
- Test: `tests/integration/trilheiro-carga.test.ts`

**Interfaces — Produces:**
```ts
export async function listarCargasDoBo(trilheiro: TrilheiroCod, boEm: string): Promise<CargaFonte[]>;
export async function salvarCargasDoBo(trilheiro: TrilheiroCod, boEm: string, linhas: { perfil: string; reemprego: boolean; fabricante: string | null; quantidade: number }[]): Promise<void>; // substitui as do B.O.
```
UI: abaixo de B.O./partida/local, linhas "perfil · fabricante (ou Reemprego) · quantidade de TLS", botão "Adicionar perfil", total do B.O. ao lado. Sem B.O. preenchido, o bloco fica desabilitado com "Preencha a data do B.O.". Validação: quantidade inteira 1–60; fabricante obrigatório quando não é reemprego.

- [ ] **Step 1: Write the failing test:** salvar 32 TR68 PANGANG + 8 TR68 NIPPON no B.O. 2026-11-27 → `listarCargasDoBo` devolve as duas; salvar de novo só com 40 PANGANG → devolve uma; `montarEstoqueTrilhos` tira 40 TLS TR68 PANGANG.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `Usina: TLS carregados por perfil e fabricante no B.O. do trilheiro`.

### Task 10: PDF do detalhado e limpeza

**Files:**
- Create: `app/api/estoque/trilhos/pdf/route.ts`, `lib/pdf/estoqueTrilhos.ts` (usa `PaginaPdf` de `lib/pdf/simples.ts`, A4 paisagem: tabela do novo, reemprego, sucata, SAP, data de atualização)
- Remove: `components/estoque/TrilhosEstoque.tsx` e o que só ele usava (conferir com grep antes)
- Test: `tests/unit/estoque-trilhos-pdf.test.ts` (gera o PDF com o saldo inicial e confere que começa com `%PDF` e contém "TR68" e "64.325")

- [ ] **Step 1:** Escrever o teste → FAIL.
- [ ] **Step 2:** Implementar a rota (requireAdmin) e o gerador.
- [ ] **Step 3:** Rodar → PASS.
- [ ] **Step 4:** Commit `Estoque de trilhos: PDF do detalhado`.

### Task 11: Verificação final

- [ ] `npx vitest run` → tudo PASS; `npx tsc --noEmit` → 0 erros; `npm run build` → sucesso.
- [ ] Passar pelas telas com dados reais (vagão → conferir → estoque; envio de novo com Tala; Produção fechando TLS; carga do trilheiro) e conferir cada saldo à mão contra a regra.
- [ ] Prévia (screenshot) do resumo e do detalhado para o usuário; subir só com "sobe".
