# Controle de Trilhos — Continuação pós-auditoria (segurança, gaps V1.2, camada offline)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to execute this plan task-by-task.

**Contexto:** Auditoria concluída na rodada anterior. O trabalho pendente (schema/fator/sucata, wizard de Recebimento, painel de Conferência) já foi commitado em 4 commits coerentes antes deste plano existir (fora do escopo deste plano — não repetir). Este plano cobre o que resta: uma correção de segurança encontrada na auditoria, 3 gaps de regra de negócio (V1.2), e a camada offline/PWA da Fundação (Tasks 12–17 do plano original `docs/superpowers/plans/2026-09-16-controle-de-trilhos-etapa1.md`), adaptada ao fato de que o wizard de Recebimento já existe e cria `Grupo`/`Medicao` diretamente (o plano original assumia, nas Tasks 12–17, apenas `Movimentacao` genérica — essa suposição não vale mais e este plano corrige isso).

**Spec:** V1.2 (documento de regras de negócio fornecido pelo usuário) + `docs/superpowers/specs/2026-09-16-controle-de-trilhos-etapa1-design.md` (seção 8, estratégia offline — a autoridade para a arquitetura de sincronização, seção 14 nota que "nível da pesagem" e storage já foram decididos: R2). Onde a spec original diverge do V1.2 (ex.: fator de perfil), o V1.2 já venceu nos commits anteriores — não reabrir essa discussão aqui.

## Decisões de arquitetura tomadas para este plano (ruling — reportar ao usuário no fechamento)

1. **`/patio/recebimentos/novo` passa a gravar em IndexedDB (Dexie) primeiro, sempre** — mesmo online. Não há mais um caminho "direto" (Server Action síncrona) e um caminho "offline" (fila) separados: existe um único caminho, local-first, que tenta sincronizar imediatamente após a gravação local. Isso é o que a spec original pede ("a gravação local é síncrona e ocorre antes de qualquer tentativa de rede") e evita manter dois códigos de criação em paralelo.
2. **A página de confirmação (`app/patio/(protegido)/recebimentos/[id]/confirmado`) muda de chave**: hoje é uma Server Component que busca por `id` do banco — isso quebra offline, porque o `id` do servidor só existe depois de sincronizar. Passa a ser `app/patio/(protegido)/recebimentos/[clientId]/confirmado`, Client Component, que lê o registro local do Dexie por `clientId` (sempre disponível, gerado no dispositivo) e mostra o resumo (grupos/medições/peso) a partir do payload local — sem round-trip ao banco. O status de sincronização (pendente/sincronizando/sincronizado/erro) é mostrado reativamente a partir do mesmo registro Dexie.
3. **`POST /api/sync` reaproveita `criarRecebimentoCaminhao` (lib/services/movimentacao.ts) diretamente**, não a Server Action `criarRecebimento` de `actions.ts` — porque essa Server Action, corrigida na Task 1 deste plano para chamar `requirePatioAcesso()` (que faz `redirect()`), não é adequada para uma rota de API que precisa devolver JSON com status HTTP (401/400/422), não um redirect. A rota de API faz sua própria checagem via `validarAcessoPatio(token)` (boolean, sem redirect) — o mesmo padrão que a Task 14 do plano original já usava para o desenho genérico do endpoint, agora estendido ao payload aninhado real (`Movimentacao`+`Grupo`+`Medicao`).
4. **A Server Action `criarRecebimento` de `actions.ts` não é removida** — ela já está corrigida (Task 1) e testada; o wizard simplesmente para de chamá-la depois da Task 6. Deixá-la no código é uma decisão deliberada (não é lixo introduzido por este plano), não uma tarefa pendente.
5. **Idempotência**: já resolvida — `criarRecebimentoCaminhao` já faz `findUnique` por `clientId` antes de criar, e só chama `registrarHistorico(..., 'CRIACAO')` na primeira criação. Reenviar o mesmo `clientId` pelo `/api/sync` (reintento do motor de sincronização) nunca duplica nem duplica histórico — sem trabalho novo aqui, só reuso.
6. **Conflito**: não há resolução de conflito bidirecional nesta etapa (confirmado na spec original §8 e não contestado pelo V1.2) — o fluxo é unidirecional (Pátio cria uma vez, Administrativo edita depois).

## Global Constraints

- TypeScript `strict` mode — `npx tsc --noEmit` limpo ao final de cada task.
- Todo teste novo roda contra o mesmo padrão já usado (Vitest + `fake-indexeddb/auto` para Dexie, banco real Neon para integração).
- Nenhuma Server Action ou Route Handler que altera dados pode pular a checagem de autorização no servidor — o padrão já estabelecido é: Server Actions usam `requireAdmin()`/`requirePatioAcesso()` (redirect em caso de falha, aceitável em Server Actions porque o cliente Next trata o redirect); Route Handlers (`app/api/**/route.ts`) usam a função boolean subjacente (`validarSessao`/`validarAcessoPatio`) e devolvem JSON com status HTTP apropriado — nunca `redirect()` dentro de uma rota de API.
- `middleware.ts` continua Edge-safe (sem Prisma/argon2 — só leitura de cookie).
- Sem marca Rumo em nenhum lugar (ícones, manifest, copy).
- Todo peso continua com 3 casas decimais (`arredondar3` de `lib/domain/regras.ts`); toda metragem com 2 casas.
- Não implementar Tala/Lisa, sucata em Remetidos, ou qualquer outro ponto listado como pendente no V1.2 (§22–25) — fora de escopo deste plano.
- Não fazer deploy na Vercel neste plano — isso é decisão do usuário, fora de qualquer task aqui.

---

## File Structure (arquivos que este plano cria ou modifica)

```
app/patio/(protegido)/
  recebimentos/
    novo/RecebimentoWizard.tsx     # MODIFICA — grava no Dexie em vez de chamar a Server Action
    novo/actions.ts                # MODIFICA (Task 1) — requirePatioAcesso(); depois ignorada pelo wizard (Task 6)
    [clientId]/confirmado/page.tsx # NOVA localização (renomeia de [id]), Client Component
  layout.tsx                       # MODIFICA (Task 7) — <IndicadorSincronizacao />
app/api/sync/route.ts              # NOVA
lib/
  domain/regras.ts                 # sem mudança estrutural — só consumido
  validation/recebimento.ts        # MODIFICA (Task 2) — placaCarreta opcional, transportadora, marca fixa
  services/movimentacao.ts         # MODIFICA (Task 2) — campo transportadora na criação
  offline/db.ts                    # NOVA (Task 4) — Dexie schema
  offline/sync.ts                  # NOVA (Task 5/6) — motor de sincronização cliente
  hooks/useOnlineStatus.ts         # NOVA (Task 7)
components/
  IndicadorSincronizacao.tsx       # NOVA (Task 7)
  RegistrarServiceWorker.tsx       # NOVA (Task 3)
public/
  manifest.json, sw.js, icons/     # NOVA (Task 3)
prisma/
  migrations/.../add_transportadora # NOVA (Task 2)
next.config.ts                     # MODIFICA (Task 8) — headers de segurança
tests/
  integration/patio-acesso-action.test.ts  # NOVA (Task 1)
  unit/validation-recebimento.test.ts      # MODIFICA (Task 2)
  integration/movimentacao.test.ts         # MODIFICA (Task 2)
  unit/offline-db.test.ts                  # NOVA (Task 4)
  unit/offline-sync.test.ts                # NOVA (Task 5)
  integration/sync-route.test.ts           # NOVA (Task 5)
  unit/indicador-sincronizacao.test.tsx    # NOVA (Task 7)
  e2e/pwa.spec.ts                          # NOVA (Task 3)
  e2e/security-headers.spec.ts             # NOVA (Task 8)
```

---

### Task 1: Correção de segurança — reverificação de acesso do Pátio na criação de Recebimento

**Files:**
- Modify: `app/patio/(protegido)/recebimentos/novo/actions.ts`
- Test: `tests/integration/patio-acesso-action.test.ts`

**Interfaces:**
- Consumes: `requirePatioAcesso` de `lib/services/requirePatioAcesso.ts` (já existe, idêntica em formato a `requireAdmin`).

**Achado da auditoria:** `criarRecebimento` (Server Action) em `app/patio/(protegido)/recebimentos/novo/actions.ts` cria uma `Movimentacao` sem revalidar o acesso do Pátio no servidor — depende só do `middleware.ts` + layout do route group. Toda ação equivalente do Administrativo (`app/admin/(protegido)/recebimentos/[id]/actions.ts`, função `usuarioAtual()`) já chama `requireAdmin()` no início de cada Server Action. Esta task aplica o mesmo padrão ao lado do Pátio.

- [ ] **Step 1: Escrever o teste que comprova a falha atual**

Criar `tests/integration/patio-acesso-action.test.ts`. O teste deve chamar `criarRecebimento` diretamente (sem passar pelo middleware — é exatamente esse bypass que a auditoria aponta como risco de IDOR/BOLA) num ambiente sem cookie `acesso_patio` válido, e comprovar que:
1. A chamada não cria nenhuma linha em `Movimentacao` (verificar via `prisma.movimentacao.count` antes/depois, ou por um `numeroDocumento` único gerado no teste).
2. A chamada resulta em redirecionamento (Next.js `redirect()` lança um erro com `digest` iniciando em `NEXT_REDIRECT` quando chamado fora de um ciclo de request real — capture esse erro, não trate como falha de teste).

Para simular "sem acesso", mock `next/headers`' `cookies()` para devolver um cookie jar vazio (sem `acesso_patio`) — use o mesmo mecanismo de mock que qualquer teste existente já usa para `next/headers`, se houver um precedente no repo (verifique `tests/` antes de inventar um novo). Se não houver precedente, use `vi.mock('next/headers', ...)`.

Rode: `npx vitest run tests/integration/patio-acesso-action.test.ts` — Esperado: FALHA (o teste que espera "não criou Movimentacao" falha porque hoje `criarRecebimento` cria mesmo sem `requirePatioAcesso()`).

- [ ] **Step 2: Corrigir**

Em `app/patio/(protegido)/recebimentos/novo/actions.ts`, adicionar `await requirePatioAcesso();` como a primeira linha do corpo de `criarRecebimento`, antes até da validação Zod — mesmo padrão de `usuarioAtual()` no lado Admin (autorização antes de qualquer outra coisa).

- [ ] **Step 3: Rodar e confirmar**

Rode: `npx vitest run tests/integration/patio-acesso-action.test.ts` — Esperado: PASS.
Rode a suíte completa (`npx vitest run`) para confirmar que nada quebrou — em particular `tests/e2e/patio-recebimento.spec.ts` não é Vitest (Playwright, fora do escopo desta verificação automática, mas fica marcado para checagem manual/E2E se houver dúvida).

- [ ] **Step 4: Commit**

```bash
git add app/patio/\(protegido\)/recebimentos/novo/actions.ts tests/integration/patio-acesso-action.test.ts
git commit -m "fix: revalidate Patio access inside criarRecebimento Server Action"
```

---

### Task 2: Fechar 3 gaps do V1.2 — placa da carreta opcional, transportadora, marcas fixas

**Files:**
- Modify: `lib/validation/recebimento.ts`, `lib/services/movimentacao.ts`, `prisma/schema.prisma`, `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`
- Create: migração Prisma para o campo `transportadora`
- Test: `tests/unit/validation-recebimento.test.ts` (modify), `tests/integration/movimentacao.test.ts` (modify)

Três gaps pequenos e do mesmo tipo (validação + schema + UI do wizard) — tratados como uma única task, um único commit.

**a) Placa da carreta opcional (V1.2 §4).**
Hoje `dadosCarregamentoSchema` em `lib/validation/recebimento.ts:19-20` exige `placaCavalo` e `placaCarreta` via `PLACA_REGEX`, ambas obrigatórias. O V1.2 permite registrar só a placa do cavalo quando não há carreta separada (a placa da carreta continua sendo a identificação preferida quando existir). Ajuste: `placaCarreta` passa a `z.string().regex(PLACA_REGEX, ...).optional()`; `placaCavalo` continua obrigatória (é o mínimo aceitável — "se não houver placa da carreta, pode ser registrada somente a placa do cavalo", não o contrário). Adicione um `.refine` a nível do objeto garantindo que pelo menos uma das duas placas está presente (evita o caso degenerado de nenhuma placa).

**b) Campo transportadora (V1.2 §4).**
Não existe hoje em lugar nenhum. Adicionar:
- `prisma/schema.prisma`: `Movimentacao.transportadora String?` (opcional — o Pátio pode não saber; texto livre, é uma empresa, não um veículo — mantenha semanticamente separado de `placaCavalo`/`placaCarreta`).
- Migração: `npx prisma migrate dev --name movimentacao_transportadora`.
- `dadosCarregamentoSchema`: adicionar `transportadora: z.string().trim().max(120).optional()`.
- `lib/services/movimentacao.ts`, dentro de `criarRecebimentoCaminhao`, incluir `transportadora: input.dados.transportadora ?? null` no `data` do `tx.movimentacao.create`.
- Wizard (Passo 1 — dados do carregamento): adicionar o campo de texto "Transportadora" perto dos campos de placa, deixando claro que é a empresa, não o veículo.

**c) Marcas fixas com "Outros" (V1.2 §11).**
Hoje `grupoNovoSchema.fabricante` é `z.string().trim().max(120).optional()`, totalmente livre. V1.2 pede lista fechada Nippon/Evraz/Pangang/Outros, com campo de texto habilitado só quando "Outros" é escolhido. Ajuste:
- `lib/validation/recebimento.ts`: adicionar `export const MARCAS = ['NIPPON', 'EVRAZ', 'PANGANG', 'OUTROS'] as const;`. `grupoNovoSchema` passa a ter `marca: z.enum(MARCAS).optional()` e `fabricanteOutro: z.string().trim().max(120).optional()`, com um `.refine` exigindo `fabricanteOutro` presente quando `marca === 'OUTROS'`, e proibindo `fabricanteOutro` quando `marca` é uma das três marcas fixas (evita dado inconsistente).
- Decida o nome final do campo que value persiste em `Grupo.fabricante` (String livre no schema, sem mudança de schema necessária aqui) — grave `marca === 'OUTROS' ? fabricanteOutro : MARCA_LABEL[marca]` nessa coluna, preservando compatibilidade com o que já existe (não é necessário migrar `Grupo.fabricante` para um enum — o schema já é texto livre, só a validação de entrada muda).
- Wizard (Passo 2 — grupos, quando `tipoMaterial === 'NOVO'`): trocar o campo de texto livre por um seletor Nippon/Evraz/Pangang/Outros, com um campo de texto que só aparece/habilita quando "Outros" é selecionado.

- [ ] **Step 1: Testes (para os 3 gaps)**

Em `tests/unit/validation-recebimento.test.ts`, adicionar/ajustar casos: aceita `placaCarreta` ausente com `placaCavalo` presente; rejeita quando nenhuma placa está presente; aceita `transportadora` ausente e presente; aceita `marca: 'NIPPON'` sem `fabricanteOutro`; rejeita `marca: 'OUTROS'` sem `fabricanteOutro`; rejeita `fabricanteOutro` presente com `marca: 'NIPPON'`.

Em `tests/integration/movimentacao.test.ts`, adicionar um caso que cria um recebimento só com `placaCavalo` (sem `placaCarreta`) e confirma que persiste com `placaCarreta: null`; e um caso que persiste `transportadora`.

Rode os testes novos antes de implementar — confirme que falham pelo motivo certo (schema ainda exige as duas placas / campo `transportadora` não existe).

- [ ] **Step 2: Implementar (a, b, c) conforme descrito acima**

- [ ] **Step 3: Rodar e confirmar**

`npx vitest run` — todos os testes (novos e existentes) devem passar. Preste atenção especial a testes existentes que hoje fixam `placaCarreta` como sempre presente ou `fabricante` como texto livre — ajuste-os para o novo formato sem perder cobertura.

`npx tsc --noEmit` — limpo.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/validation/recebimento.ts lib/services/movimentacao.ts "app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx" tests/unit/validation-recebimento.test.ts tests/integration/movimentacao.test.ts
git commit -m "feat: placa da carreta opcional, campo transportadora, marcas fixas (V1.2 S4/S11)"
```

---

### Task 3: PWA — manifest + ícones + Service Worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `components/RegistrarServiceWorker.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/e2e/pwa.spec.ts`

Equivalente à Task 12 do plano original — sem mudança de escopo (o app shell cacheado não depende do formato do payload de Recebimento). Pode reaproveitar o conteúdo já especificado em `docs/superpowers/plans/2026-09-16-controle-de-trilhos-etapa1.md`, Task 12, com uma diferença: o `start_url` do manifest deve ser `/patio/acesso` (mantido) e `APP_SHELL` em `sw.js` deve incluir `/patio` e `/admin` além das rotas de acesso, já que essas telas existem agora.

- [ ] **Step 1: Criar o manifest**

`public/manifest.json`: nome "Controle de Trilhos", `short_name` "Trilhos", `start_url: "/patio/acesso"`, `display: "standalone"`, paleta escura própria (`background_color`/`theme_color`, defina um tom neutro escuro, ex. `#12151a` — sem elementos de marca Rumo), ícones 192x192 e 512x512.

- [ ] **Step 2: Ícones placeholder**

Gere 2 PNGs placeholder (1×1 ou similar, sem arte real — arte definitiva é decisão de design fora de escopo) em `public/icons/`. Não é defeito de review nesta etapa; marque como aceito no relatório.

- [ ] **Step 3: Service Worker**

`public/sw.js`: cache do app shell (`/`, `/patio/acesso`, `/admin/login`, `/manifest.json`), estratégia network-first com fallback pro cache (mesmo padrão do plano original Task 12) — **decisão para validar com o usuário**: o Service Worker deve cachear SOMENTE leitura (GET), nunca interceptar `POST /api/sync` (a fila offline já cuida disso via Dexie, não via Service Worker/Background Sync — evita duas camadas de retry concorrentes). Garanta que o listener `fetch` do `sw.js` ignora métodos != GET (`if (event.request.method !== 'GET') return;`).

- [ ] **Step 4: Registrar**

`components/RegistrarServiceWorker.tsx` (`'use client'`, registra `/sw.js` em `useEffect`). Adicionar `<link rel="manifest" href="/manifest.json" />` e `<RegistrarServiceWorker />` em `app/layout.tsx`.

- [ ] **Step 5: E2E**

`tests/e2e/pwa.spec.ts`: navega para `/patio/acesso`, espera o Service Worker registrar, confirma que `/manifest.json` responde 200. Rode `npm run build && npm run test:e2e -- pwa`.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json public/sw.js public/icons components/RegistrarServiceWorker.tsx app/layout.tsx tests/e2e/pwa.spec.ts
git commit -m "feat: add PWA manifest and app-shell service worker"
```

---

### Task 4: Camada offline — Dexie schema para o Recebimento completo

**Files:**
- Create: `lib/offline/db.ts`
- Test: `tests/unit/offline-db.test.ts`

**Interfaces:**
- Consumes: `RecebimentoCaminhaoInput` (tipo) de `lib/validation/recebimento.ts` — o payload local é tipado com o MESMO shape que o wizard já monta e que `recebimentoCaminhaoSchema` já valida, não um `unknown` genérico (diferente do Task 13 do plano original, que antecedia o wizard e não sabia o formato final).
- Produces: `db.recebimentos` (tabela Dexie), `type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO'`, `interface RecebimentoLocal { clientId: string; payload: RecebimentoCaminhaoInput; syncStatus: SyncStatus; erro?: string; criadoEm: number; serverId?: string }`, `salvarRecebimentoLocal(payload: RecebimentoCaminhaoInput): Promise<void>`.

- [ ] **Step 1: Testes**

`tests/unit/offline-db.test.ts` (usa `import 'fake-indexeddb/auto'` no topo, mesmo padrão de `tests/unit/patio-acesso.test.ts` etc.): grava um `RecebimentoLocal` via `salvarRecebimentoLocal`, lê de volta por `clientId`, confirma `syncStatus: 'PENDENTE'` inicial; confirma que dois `clientId` diferentes não colidem; confirma que salvar duas vezes o MESMO `clientId` (reenvio do mesmo formulário) atualiza em vez de duplicar linha (checar `db.recebimentos.count()`).

Rode e confirme falha (`Cannot find module '@/lib/offline/db'`).

- [ ] **Step 2: Implementar**

`npm install dexie`. Criar `lib/offline/db.ts` com a classe `TrilhosDB extends Dexie`, `version(1).stores({ recebimentos: 'clientId, syncStatus, criadoEm' })`. `salvarRecebimentoLocal` faz `db.recebimentos.put({ clientId: payload.clientId, payload, syncStatus: 'PENDENTE', criadoEm: Date.now() })` — `put` (não `add`) para que reenviar o mesmo `clientId` sobrescreva em vez de lançar erro de chave duplicada.

- [ ] **Step 3: Rodar e confirmar**

`npx vitest run tests/unit/offline-db.test.ts` — PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/offline/db.ts tests/unit/offline-db.test.ts package.json package-lock.json
git commit -m "feat: add Dexie offline queue schema for Recebimento payloads"
```

---

### Task 5: Endpoint de sincronização `/api/sync`

**Files:**
- Create: `app/api/sync/route.ts`
- Test: `tests/integration/sync-route.test.ts`

**Interfaces:**
- Consumes: `validarAcessoPatio` de `lib/services/patioAcesso.ts`, `recebimentoCaminhaoSchema` de `lib/validation/recebimento.ts`, `criarRecebimentoCaminhao` de `lib/services/movimentacao.ts`.
- Produces: `POST /api/sync`.

Ver ruling #3 no topo do plano — esta rota faz sua PRÓPRIA checagem de autorização (boolean, `validarAcessoPatio`), nunca `requirePatioAcesso()`/`redirect()`.

- [ ] **Step 1: Teste**

`tests/integration/sync-route.test.ts`: chama o handler `POST` exportado por `app/api/sync/route.ts` diretamente com um `NextRequest` construído no teste (mesmo padrão de teste de Route Handler que o Next 16/Vitest já suporta — importar `POST` e invocar como função, passando um `Request`/`NextRequest` real). Casos:
1. Sem cookie `acesso_patio` → 401, nenhuma `Movimentacao` criada.
2. Cookie válido + payload válido → 200, `{ ok: true, id }`, `Movimentacao` criada no banco.
3. Mesmo `clientId` enviado duas vezes → segunda chamada também 200 com o MESMO `id`, sem duplicar (idempotência — reaproveita o comportamento já testado de `criarRecebimentoCaminhao`, só confirma que a rota não quebra isso).
4. Payload malformado (ex.: `grupos: []`) → 400, nenhuma `Movimentacao` criada.

Rode e confirme falha (rota não existe).

- [ ] **Step 2: Implementar**

`app/api/sync/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';

export async function POST(request: NextRequest) {
  const token = (await cookies()).get('acesso_patio')?.value;
  const autorizado = token ? await validarAcessoPatio(token) : false;
  if (!autorizado) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const parsed = recebimentoCaminhaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const movimentacao = await criarRecebimentoCaminhao(parsed.data);
    return NextResponse.json({ ok: true, id: movimentacao.id });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao sincronizar.';
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 422 });
  }
}
```
(Ajuste tipos/imports conforme a versão real do Next instalada — confirme a assinatura de Route Handlers async no Next 16 antes de codar, já que o projeto está em `next@16.3.5`.)

- [ ] **Step 3: Rodar e confirmar**

`npx vitest run tests/integration/sync-route.test.ts` — PASS. Rode a suíte completa.

- [ ] **Step 4: Commit**

```bash
git add app/api/sync tests/integration/sync-route.test.ts
git commit -m "feat: add idempotent /api/sync endpoint for queued Recebimentos"
```

---

### Task 6: Motor de sincronização no cliente + wizard local-first

**Files:**
- Create: `lib/offline/sync.ts`
- Modify: `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`
- Rename+Modify: `app/patio/(protegido)/recebimentos/[id]/confirmado/page.tsx` → `app/patio/(protegido)/recebimentos/[clientId]/confirmado/page.tsx`
- Test: `tests/unit/offline-sync.test.ts`, ajustar `tests/e2e/patio-recebimento.spec.ts` se necessário (a URL de confirmação muda de `/patio/recebimentos/{id}/confirmado` para `/patio/recebimentos/{clientId}/confirmado`)

**Interfaces:**
- Consumes: `db`, `RecebimentoLocal` de `lib/offline/db.ts` (Task 4).
- Produces: `sincronizarPendentes(fetchImpl?: typeof fetch): Promise<void>`.

Esta é a task com mais judgment do plano — ver ruling #1 e #2 no topo antes de começar.

- [ ] **Step 1: Teste do motor de sincronização**

`tests/unit/offline-sync.test.ts` (padrão igual ao `offline-db.test.ts`, `fake-indexeddb/auto`): grava um `RecebimentoLocal` PENDENTE, mocka `fetch` para responder `{ ok: true, json: async () => ({ ok: true, id: 'xyz' }) }`, chama `sincronizarPendentes(fetchMock)`, confirma que o registro fica `SINCRONIZADO` e `serverId: 'xyz'`. Segundo caso: `fetch` rejeita (erro de rede) → registro continua `PENDENTE` (nunca `ERRO` por falha de rede — falha de rede é esperada e recuperável, reservar `ERRO` para uma resposta 4xx do servidor que não vai se resolver sozinha reenviando, ex. 400 payload inválido). Terceiro caso: `fetch` responde 401 → registro vira `ERRO` com a mensagem (reenviar não vai ajudar sem re-autenticar).

- [ ] **Step 2: Implementar o motor**

`lib/offline/sync.ts`: `sincronizarPendentes` itera `db.recebimentos.where('syncStatus').equals('PENDENTE')`, marca `SINCRONIZANDO`, faz `POST /api/sync` com `JSON.stringify(registro.payload)`, trata a resposta: 2xx → `SINCRONIZADO` + `serverId`; 401/400/422 → `ERRO` + mensagem (não recuperável automaticamente); falha de rede (exceção do `fetch`) → volta para `PENDENTE` (recuperável, tentará de novo).

- [ ] **Step 3: Adaptar o wizard para local-first**

Em `RecebimentoWizard.tsx`, a função que hoje chama `criarRecebimento(payload)` (Server Action) e navega para `/patio/recebimentos/${resultado.id}/confirmado` passa a: chamar `salvarRecebimentoLocal(payload)` (síncrono/local, sempre sucede mesmo offline), disparar `sincronizarPendentes()` em best-effort (não bloquear a navegação esperando a rede — dispare e não espere, ou espere com um timeout curto só para dar feedback imediato quando online), navegar imediatamente para `/patio/recebimentos/${payload.clientId}/confirmado`. Mantenha toda a UI/validação dos passos 1–4 como está — só a submissão final muda.

- [ ] **Step 4: Página de confirmação por `clientId`**

Mova o arquivo para `app/patio/(protegido)/recebimentos/[clientId]/confirmado/page.tsx`, torne-o `'use client'`, leia `db.recebimentos.get(clientId)` (Dexie) para montar o mesmo resumo (grupos/medições/peso) que a versão anterior montava a partir do banco — os dados já estão completos no payload local, não precisa de round-trip ao servidor. Mostre o `syncStatus` atual (ex.: "Salvo neste dispositivo, sincronizando..." / "Sincronizado com sucesso" / "Falha ao sincronizar: {erro} — será tentado novamente" / re-tentativa manual). Se o registro não existir no Dexie (ex.: acesso direto à URL sem ter passado pelo wizard), `notFound()`-equivalente client-side.

- [ ] **Step 5: Disparo automático de sincronização — escopo desta task**

Nesta task, `sincronizarPendentes()` é chamada apenas: (a) logo após `salvarRecebimentoLocal` no fluxo de submissão do wizard (Step 3 acima), como tentativa best-effort imediata. **Não** adicione aqui listener de evento `online` nem intervalo periódico — isso é escopo da Task 7 (Step 2), que já monta um componente de vida longa (`IndicadorSincronizacao`, presente em toda a navegação do Pátio) e é o lugar certo para um efeito recorrente. Manter isso fora desta task evita dois lugares diferentes registrando o mesmo `setInterval`/listener.

- [ ] **Step 6: Rodar e confirmar**

`npx vitest run` — suíte completa passando. `npx tsc --noEmit` limpo. Rode manualmente (`npm run dev`) o fluxo do wizard uma vez para confirmar visualmente que a navegação para a página de confirmação funciona (verificação manual, documentar no report já que não há Playwright automatizado obrigatório nesta task — `patio-recebimento.spec.ts` já cobre parte disso e deve ser ajustado se a URL mudou).

- [ ] **Step 7: Commit**

```bash
git add lib/offline/sync.ts "app/patio/(protegido)/recebimentos" tests/unit/offline-sync.test.ts tests/e2e/patio-recebimento.spec.ts
git commit -m "feat: local-first submission for the Recebimento wizard via Dexie + sync engine"
```

---

### Task 7: Indicador de sincronização + integração no layout do Pátio

**Files:**
- Create: `lib/hooks/useOnlineStatus.ts`, `components/IndicadorSincronizacao.tsx`
- Modify: `app/patio/(protegido)/layout.tsx`
- Test: `tests/unit/indicador-sincronizacao.test.tsx`

Equivalente à Task 16 do plano original — sem mudança de escopo, exceto que a contagem de pendentes agora vem de `db.recebimentos` (não `db.movimentacoes`, que nunca existiu neste plano — foi renomeado no Task 4 acima).

- [ ] **Step 1: Teste**

`tests/unit/indicador-sincronizacao.test.tsx`: renderiza `<IndicadorSincronizacao />`, confirma `screen.getByRole('status')` presente.

- [ ] **Step 2: Implementar**

`lib/hooks/useOnlineStatus.ts` — idêntico ao Task 16 original (evento `online`/`offline`, `navigator.onLine`).
`components/IndicadorSincronizacao.tsx` — mostra "Offline" quando `!online`, contagem de `db.recebimentos.where('syncStatus').anyOf(['PENDENTE','SINCRONIZANDO','ERRO']).count()`. Este componente é responsável pelo disparo recorrente de `sincronizarPendentes()` (ruling do pré-flight scan: a Task 6 só dispara a tentativa imediata pós-submissão, não o disparo periódico) — dentro do `useEffect` do indicador, registre: uma chamada ao montar, um listener no evento `online` do `window`, e um `setInterval` (ex. 30s) enquanto o componente está montado, todos limpos no cleanup do efeito.

Adicionar `<IndicadorSincronizacao />` em `app/patio/(protegido)/layout.tsx`, visível em toda a área do Pátio (inclusive durante o wizard).

- [ ] **Step 3: Rodar e confirmar**

`npx vitest run tests/unit/indicador-sincronizacao.test.tsx` — PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useOnlineStatus.ts components/IndicadorSincronizacao.tsx "app/patio/(protegido)/layout.tsx" tests/unit/indicador-sincronizacao.test.tsx
git commit -m "feat: add online/offline and pending-sync indicator to the Patio layout"
```

---

### Task 8: Headers de segurança

**Files:**
- Modify: `next.config.ts`
- Test: `tests/e2e/security-headers.spec.ts`

Idêntico à Task 17 do plano original — sem adaptação necessária.

- [ ] **Step 1: Teste**

`tests/e2e/security-headers.spec.ts`: `GET /patio/acesso`, confirma `x-content-type-options: nosniff` e `x-frame-options: DENY` presentes.

- [ ] **Step 2: Implementar**

`next.config.ts` ganha `async headers()` devolvendo, para `/:path*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'`.

Preserve o `agentRules: false` já existente no `next.config.ts` atual.

- [ ] **Step 3: Rodar e confirmar**

`npm run build && npm run test:e2e -- security-headers` — PASS.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts tests/e2e/security-headers.spec.ts
git commit -m "feat: add baseline security headers"
```

---

### Task 9: Checkpoint de security-review

**Files:** none (task de revisão + eventual correção)

- [ ] **Step 1**: Rodar a skill/processo `security-review` sobre o diff completo introduzido pelas Tasks 1–8 deste plano.
- [ ] **Step 2**: Verificar explicitamente (não presumir) cada item pedido pelo usuário nesta rodada:
  - Toda Server Action (Pátio e Administrativo) que altera dado reverifica autorização no servidor — incluir a correção da Task 1 na verificação, e confirmar que nenhuma Server Action nova das Tasks 2–8 pulou essa checagem.
  - Teste manual/automatizado de IDOR/BOLA: um acesso do Pátio não deve conseguir ler/alterar rotas administrativas manipulando cookies/IDs diretamente; um `clientId` de outro dispositivo não deve permitir a um atacante inferir ou adulterar dados de terceiros via `/api/sync` (o endpoint só cria, nunca lê por `clientId` de outro registro — confirmar que não há endpoint de leitura por `clientId` exposto sem autorização).
  - Rate limiting/bloqueio por tentativas: confirmar que `LoginAttempt` (Admin) e a ausência equivalente para o PIN do Pátio (o PIN não tem bloqueio progressivo hoje — `verificarPin` não usa `LoginAttempt`) são avaliados; se o PIN do Pátio não tiver proteção de força bruta, isso é um achado real desta revisão, não presumir que está coberto.
  - `secure: true` hardcoded nos cookies de sessão — confirmar que isso é compatível com preview da Vercel (HTTPS nativo) e documentar a limitação conhecida para teste local em `http://localhost` puro (já levantada na auditoria anterior).
  - Superfície nova do `/api/sync`: replay do mesmo `clientId` (já coberto pela idempotência, mas confirmar que um `clientId` de OUTRO dispositivo/sessão não pode ser usado para sobrescrever ou inferir dados de um recebimento que não foi criado por quem está enviando — hoje qualquer portador do cookie `acesso_patio` válido pode criar/reenviar qualquer `clientId`, o que é aceitável dado que o PIN é compartilhado por design (V1.2 confirmou isso), mas documente essa aceitação explicitamente em vez de deixar implícita).
- [ ] **Step 3**: Para cada achado Crítico/Importante, aplicar o mesmo fix loop usado nas tasks anteriores (implementer resume → re-review escopado). Achados Menores entram no relatório final como pendências documentadas, não bloqueiam.
- [ ] **Step 4**: Registrar o resultado no ledger e no relatório final: o que foi revisado, o que foi corrigido, o que ficou em aberto (com ruling).

---

## Self-Review

**Cobertura dos itens 2–5 da rodada:** item 2 (segurança) → Task 1. Item 3 (3 gaps V1.2) → Task 2. Item 4 (Tasks 12–17 originais) → Tasks 3–8 (renumeradas e adaptadas ao wizard real; toda referência cruzada a "Task 12/13/14/15/16/17 do plano original" nas tasks acima documenta a correspondência). Item 5 (checkpoint de segurança) → Task 9.

**Fora de escopo, não implementar aqui:** deploy Vercel, Remetidos, Estoque, Relatórios, Excel, Tala/Lisa, sucata em Remetidos — confirmado pelo usuário como fora desta rodada.
