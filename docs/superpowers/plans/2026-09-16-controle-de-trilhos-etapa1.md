# Controle de Trilhos — Etapa 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of Controle de Trilhos — project scaffold, shared Prisma schema, admin authentication, Pátio PIN gate, PWA/offline queue and sync mechanism, audit logging and security headers — without building any Recebimento/Remetido business screens, upload flows, or business rules that belong to later stages.

**Architecture:** Single Next.js (App Router) application with two protected route trees, `/admin` and `/patio`, each gated by a cheap Edge-safe cookie-presence check in `middleware.ts` and an authoritative Node-runtime/Prisma-backed check (`requireAdmin`/`requirePatioAcesso`) in a route-group layout. All business math (peso, SC classification, reemprego rule) lives in dependency-free pure functions shared by both future flows. Offline writes go to IndexedDB (Dexie) first and sync to `/api/sync` using a client-generated `clientId` as the idempotency key.

**Tech Stack:** Next.js (App Router) + TypeScript, Prisma + PostgreSQL (Neon), Argon2 (`argon2` package) for password/PIN hashing, Dexie for IndexedDB, Zod for validation, Vitest (+ `fake-indexeddb`, `@testing-library/react`) for unit/integration tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-09-16-controle-de-trilhos-etapa1-design.md`

## Global Constraints

- TypeScript `strict` mode.
- Entity IDs: `cuid()`. Sync/idempotency IDs: `clientId` (UUID v4, `crypto.randomUUID()`).
- All measurement/weight math uses rounding to avoid float drift (`Math.round(x * 1000) / 1000` for 3-decimal peso); no new decimal library dependency.
- No hardcoded secrets — everything through environment variables (`.env.local`, never committed).
- Password and PIN hashing: always Argon2id via the `argon2` package. Session/access tokens use SHA-256 for the DB lookup index (fast, deterministic) — Argon2id is reserved for low-entropy secrets (passwords, PIN) where offline brute-force resistance matters; a random 128-bit token doesn't need it.
- No Rumo brand asset, name, or symbol anywhere in code, copy, or icons.
- Middleware (`middleware.ts`) runs on the Edge Runtime and must never import Prisma or `argon2` directly — it only checks cookie presence for a fast redirect. The authoritative, DB-backed check always happens in a Node-runtime layout/Server Action.
- Do not build Recebimento/Remetido creation screens, Grupo/Medicao business rules, or file upload flows in this plan — those belong to Etapas 2–4. Where a task needs to prove the shared foundation works (e.g. the sync mechanism), use the generic `Movimentacao`-level fields only, not `Grupo`/`Medicao`.

---

## File Structure

```
/app
  layout.tsx
  page.tsx
  admin/
    login/
      page.tsx
      actions.ts
    (protegido)/
      layout.tsx
      page.tsx
  patio/
    acesso/
      page.tsx
      actions.ts
    (protegido)/
      layout.tsx
      page.tsx
  api/
    sync/route.ts
middleware.ts
/lib
  db.ts
  services/
    calculo.ts
    historico.ts
    auth.ts
    loginService.ts
    requireAdmin.ts
    patioAcesso.ts
    requirePatioAcesso.ts
    sync.ts
  offline/
    db.ts
    sync.ts
  hooks/
    useOnlineStatus.ts
/components
  IndicadorSincronizacao.tsx
/prisma
  schema.prisma
  seed.ts
/public
  manifest.json
  sw.js
  icons/ (ícones próprios, sem elementos da marca Rumo)
/tests
  unit/
    calculo.test.ts
    auth.test.ts
    offline-db.test.ts
    offline-sync.test.ts
    indicador-sincronizacao.test.tsx
  integration/
    schema.test.ts
    historico.test.ts
    auth-session.test.ts
    login.test.ts
    sync.test.ts
  e2e/
    smoke.spec.ts
    security-headers.spec.ts
    pwa.spec.ts
```

---

### Task 1: Bootstrap do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: working Next.js App Router skeleton, `@/*` path alias, `npm test` (Vitest) and `npm run test:e2e` (Playwright) wired.

- [ ] **Step 1: Scaffold the Next.js app**

Run: `npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"`
Expected: project files created in the current directory.

- [ ] **Step 2: Install test tooling**

Run: `npm install -D vitest @vitejs/plugin-react @testing-library/react jsdom @playwright/test fake-indexeddb tsx`

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 4: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 6: Create `.env.example`**

```
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_SENHA_INICIAL=
PATIO_PIN_HASH=
PATIO_PIN_TESTE=
```

`PATIO_PIN_TESTE` is the plaintext PIN used only by local/E2E test runs — it must be the plaintext whose Argon2 hash is `PATIO_PIN_HASH` in that same environment (Task 18 depends on this pairing).

- [ ] **Step 7: Verify dev server**

Run: `npm run dev`
Expected: `http://localhost:3000` serves the default Next.js page with no console errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js project with Tailwind, Vitest and Playwright"
```

---

### Task 2: Funções de cálculo puro

**Files:**
- Create: `lib/services/calculo.ts`
- Test: `tests/unit/calculo.test.ts`

**Interfaces:**
- Produces: `type Perfil`, `fatorPerfil(perfil: Perfil): number`, `calcularPeso(metros: number, perfil: Perfil): number`, `calcularMetros(quantidade: number, comprimento: number): number`, `type ClassificacaoSC`, `classificarSC(comprimento: number): ClassificacaoSC`, `validarReemprego(comprimento: number): boolean`.

These are shared, flow-agnostic math used identically by Recebimentos and Remetidos — not a Recebimento/Remetido feature — so they belong in the foundation.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/calculo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fatorPerfil, calcularPeso, calcularMetros, classificarSC, validarReemprego } from '@/lib/services/calculo';

describe('fatorPerfil', () => {
  it('calcula o fator a partir do número do perfil', () => {
    expect(fatorPerfil('TR68')).toBe(0.068);
    expect(fatorPerfil('TR22')).toBe(0.022);
  });
});

describe('calcularPeso', () => {
  it('calcula peso com 3 casas decimais', () => {
    expect(calcularPeso(100, 'TR68')).toBe(6.8);
  });
});

describe('calcularMetros', () => {
  it('multiplica quantidade por comprimento', () => {
    expect(calcularMetros(20, 12)).toBe(240);
  });
});

describe('classificarSC', () => {
  it('classifica os limites exatos de cada faixa', () => {
    expect(classificarSC(7.0)).toBe('SC1');
    expect(classificarSC(12.0)).toBe('SC1');
    expect(classificarSC(6.99)).toBe('SC2');
    expect(classificarSC(3.0)).toBe('SC2');
    expect(classificarSC(2.99)).toBe('SC3');
    expect(classificarSC(0)).toBe('SC3');
  });

  it('rejeita comprimento fora da faixa válida', () => {
    expect(() => classificarSC(12.01)).toThrow();
    expect(() => classificarSC(-1)).toThrow();
  });
});

describe('validarReemprego', () => {
  it('rejeita comprimento abaixo de 7 metros', () => {
    expect(validarReemprego(6.99)).toBe(false);
    expect(validarReemprego(7.0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- calculo`
Expected: FAIL — `Cannot find module '@/lib/services/calculo'`.

- [ ] **Step 3: Implement**

Create `lib/services/calculo.ts`:

```ts
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- calculo`
Expected: PASS (all cases, including boundaries).

- [ ] **Step 5: Commit**

```bash
git add lib/services/calculo.ts tests/unit/calculo.test.ts
git commit -m "feat: add shared calculation functions for peso, SC classification and reemprego validation"
```

---

### Task 3: Conexão Prisma + Neon

**Files:**
- Create: `prisma/schema.prisma` (datasource + generator only), `lib/db.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton) from `lib/db.ts`.

- [ ] **Step 1: Install Prisma**

Run: `npm install prisma @prisma/client` then `npx prisma init --datasource-provider postgresql`

- [ ] **Step 2: Set the Neon connection string**

Add the real Neon `DATABASE_URL` to `.env.local` (not committed — ask the user for the connection string if not already provided).

- [ ] **Step 3: Create the Prisma client singleton**

Create `lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Verify the connection**

Run: `npx prisma migrate dev --name init`
Expected: an (empty) migration is created and applied against Neon with no connection error.

- [ ] **Step 5: Commit**

```bash
git add prisma lib/db.ts .env.example
git commit -m "chore: configure Prisma with Neon connection"
```

---

### Task 4: Schema completo + migration inicial

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/integration/schema.test.ts`

**Interfaces:**
- Produces: Prisma Client types for `User`, `Session`, `LoginAttempt`, `PatioAcessoToken`, `Movimentacao`, `RemetidoDetalhe`, `Grupo`, `Medicao`, `Anexo`, `HistoricoAlteracao` and all enums from the spec (seção 6).

This migrates the full shared schema now — including `RemetidoDetalhe`, `Grupo`, `Medicao`, `Anexo` — to avoid a second migration when Etapas 2–4 build their screens on top of it. No screen, form, or validation flow is built around these tables in this task.

- [ ] **Step 1: Write the schema**

Append to `prisma/schema.prisma` (keep the existing `datasource`/`generator` blocks from Task 3):

```prisma
enum TipoMovimentacao   { RECEBIMENTO REMETIDO }
enum StatusMovimentacao { PENDENTE_CONFERENCIA CONFERIDO }
enum TipoTransporte     { CAMINHAO VAGAO OUTRO }
enum TipoRemetido       { VENDA TRANS INDUS }
enum PerfilTrilho       { TR22 TR32 TR37 TR40 TR45 TR50 TR54 TR55 TR57 TR60 TR68 }
enum TipoMaterial       { NOVO REEMPREGO SUCATA }
enum ClassificacaoReemprego { G1 G2 G3 }
enum ClassificacaoSC    { SC1 SC2 SC3 }
enum StatusPeso         { CALCULADO PENDENTE CONFIRMADO }
enum ModoMedicao        { INDIVIDUAL QTD_COMPRIMENTO }
enum Role               { ADMIN }

model User {
  id            String    @id @default(cuid())
  nome          String
  email         String    @unique
  senhaHash     String
  role          Role      @default(ADMIN)
  ativo         Boolean   @default(true)
  createdAt     DateTime  @default(now())
  ultimoLoginEm DateTime?
  sessions      Session[]
}

model Session {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?
}

model LoginAttempt {
  id            String    @id @default(cuid())
  identificador String    @unique
  tentativas    Int       @default(0)
  bloqueadoAte  DateTime?
  atualizadoEm  DateTime  @updatedAt
}

model PatioAcessoToken {
  id         String    @id @default(cuid())
  tokenHash  String    @unique
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?
}

model Movimentacao {
  id               String              @id @default(cuid())
  clientId         String              @unique
  tipo             TipoMovimentacao
  tipoDocumento    String
  numeroDocumento  String
  tipoTransporte   TipoTransporte
  placaCavalo      String?
  placaCarreta     String?
  origem           String?
  destino          String?
  responsavelPatio String
  status           StatusMovimentacao  @default(PENDENTE_CONFERENCIA)
  createdAt        DateTime            @default(now())
  conferidoPorId   String?
  conferidoEm      DateTime?

  remetidoDetalhe  RemetidoDetalhe?
  grupos           Grupo[]
  anexos           Anexo[]
  historico        HistoricoAlteracao[]
}

model RemetidoDetalhe {
  movimentacaoId String        @id
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  tipoRemetido   TipoRemetido
}

model Grupo {
  id             String        @id @default(cuid())
  clientId       String        @unique
  movimentacaoId String
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  perfil         PerfilTrilho
  tipoMaterial   TipoMaterial
  classificacao  ClassificacaoReemprego?
  fabricante     String?
  metrosTotal    Decimal       @default(0)
  pesoCalculado  Decimal       @default(0)
  statusPeso     StatusPeso    @default(CALCULADO)
  pesoReal       Decimal?

  medicoes       Medicao[]
  anexos         Anexo[]
}

model Medicao {
  id              String        @id @default(cuid())
  clientId        String        @unique
  grupoId         String
  grupo           Grupo         @relation(fields: [grupoId], references: [id])
  modo            ModoMedicao
  quantidade      Int           @default(1)
  comprimento     Decimal
  metros          Decimal
  classificacaoSC ClassificacaoSC?
}

model Anexo {
  id             String        @id @default(cuid())
  movimentacaoId String
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  grupoId        String?
  grupo          Grupo?        @relation(fields: [grupoId], references: [id])
  tipo           String
  url            String
  uploadedById   String
  uploadedAt     DateTime      @default(now())
}

model HistoricoAlteracao {
  id             String        @id @default(cuid())
  movimentacaoId String
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  usuarioId      String?
  usuarioNome    String
  acao           String
  campo          String?
  valorAntigo    String?
  valorNovo      String?
  timestamp      DateTime      @default(now())
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name core-entities`
Expected: migration applied against Neon with no error; `npx prisma generate` runs automatically.

- [ ] **Step 3: Write the smoke test**

Create `tests/integration/schema.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('schema smoke test', () => {
  it('cria e lê um usuário', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Teste', email: 'teste@example.com', senhaHash: 'x' },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe('teste@example.com');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'teste@example.com' } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma tests/integration/schema.test.ts
git commit -m "feat: add core Prisma schema shared by Recebimentos and Remetidos"
```

---

### Task 5: Serviço de auditoria

**Files:**
- Create: `lib/services/historico.ts`
- Test: `tests/integration/historico.test.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/db.ts`.
- Produces: `registrarHistorico(params: { movimentacaoId: string; usuarioId?: string; usuarioNome: string; acao: string; campo?: string; valorAntigo?: string; valorNovo?: string }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/historico.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { registrarHistorico } from '@/lib/services/historico';

describe('registrarHistorico', () => {
  it('grava uma entrada de histórico para uma movimentação', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: crypto.randomUUID(),
        tipo: 'RECEBIMENTO',
        tipoDocumento: 'NF',
        numeroDocumento: '000001',
        tipoTransporte: 'CAMINHAO',
        responsavelPatio: 'Teste',
      },
    });

    await registrarHistorico({ movimentacaoId: mov.id, usuarioNome: 'Teste', acao: 'CRIACAO' });

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0].acao).toBe('CRIACAO');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- historico`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/services/historico.ts`:

```ts
import { prisma } from '@/lib/db';

interface RegistrarHistoricoParams {
  movimentacaoId: string;
  usuarioId?: string;
  usuarioNome: string;
  acao: string;
  campo?: string;
  valorAntigo?: string;
  valorNovo?: string;
}

export async function registrarHistorico(params: RegistrarHistoricoParams): Promise<void> {
  await prisma.historicoAlteracao.create({ data: params });
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- historico`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/historico.ts tests/integration/historico.test.ts
git commit -m "feat: add audit trail service"
```

---

### Task 6: Primitivas de hash e sessão

**Files:**
- Create: `lib/services/auth.ts`
- Test: `tests/unit/auth.test.ts`, `tests/integration/auth-session.test.ts`

**Interfaces:**
- Produces: `hashSegredo(valor: string): Promise<string>`, `verificarSegredo(valor: string, hash: string): Promise<boolean>`, `criarSessao(userId: string): Promise<{ token: string; expiresAt: Date }>`, `validarSessao(token: string): Promise<{ userId: string } | null>`, `revogarSessao(token: string): Promise<void>`.

These primitives are reused by both the admin login (Task 7) and the Pátio PIN (Task 10) — `hashSegredo`/`verificarSegredo` for the secret itself, the session pattern mirrored by `PatioAcessoToken` in Task 10.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashSegredo, verificarSegredo } from '@/lib/services/auth';

describe('hashSegredo/verificarSegredo', () => {
  it('gera um hash verificável e rejeita valores errados', async () => {
    const hash = await hashSegredo('senha-correta');
    expect(await verificarSegredo('senha-correta', hash)).toBe(true);
    expect(await verificarSegredo('senha-errada', hash)).toBe(false);
  });
});
```

Create `tests/integration/auth-session.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarSessao, validarSessao, revogarSessao } from '@/lib/services/auth';

describe('sessão administrativa', () => {
  it('cria, valida e revoga uma sessão', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Admin Teste', email: 'admin-teste@example.com', senhaHash: 'x' },
    });

    const { token } = await criarSessao(user.id);
    const valida = await validarSessao(token);
    expect(valida?.userId).toBe(user.id);

    await revogarSessao(token);
    expect(await validarSessao(token)).toBeNull();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'admin-teste@example.com' } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- auth`
Expected: FAIL — module not found.

- [ ] **Step 3: Install Argon2 and implement**

Run: `npm install argon2`

Create `lib/services/auth.ts`:

```ts
import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export async function hashSegredo(valor: string): Promise<string> {
  return argon2.hash(valor);
}

export async function verificarSegredo(valor: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, valor);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function criarSessao(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function validarSessao(token: string): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}

export async function revogarSessao(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/auth.ts tests/unit/auth.test.ts tests/integration/auth-session.test.ts package.json package-lock.json
git commit -m "feat: add Argon2 hashing and session primitives"
```

---

### Task 7: Regra de negócio do login + Server Action + página mínima

**Files:**
- Create: `lib/services/loginService.ts`, `app/admin/login/actions.ts`, `app/admin/login/page.tsx`
- Test: `tests/integration/login.test.ts`

**Interfaces:**
- Consumes: `verificarSegredo`, `criarSessao` from `lib/services/auth.ts`.
- Produces: `autenticar(email: string, senha: string): Promise<{ ok: boolean; token?: string; expiresAt?: Date; erro?: string }>` (pure business logic, no cookies — testable directly); Server Action `login(formData: FormData)` that calls it and sets the cookie.

The login page is intentionally bare (no styling, no error UI polish) — the real Administrativo UI is Etapa 3.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/login.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { autenticar } from '@/lib/services/loginService';

describe('autenticar', () => {
  it('bloqueia após 5 tentativas falhas', async () => {
    await prisma.user.create({
      data: { nome: 'Admin', email: 'login-teste@example.com', senhaHash: await hashSegredo('senha-correta') },
    });

    for (let i = 0; i < 5; i++) {
      await autenticar('login-teste@example.com', 'errada');
    }

    const resultado = await autenticar('login-teste@example.com', 'senha-correta');
    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/bloqueada/);
  });

  it('autentica com credenciais corretas antes do bloqueio', async () => {
    await prisma.user.create({
      data: { nome: 'Admin2', email: 'login-teste-2@example.com', senhaHash: await hashSegredo('senha-correta') },
    });

    const resultado = await autenticar('login-teste-2@example.com', 'senha-correta');
    expect(resultado.ok).toBe(true);
    expect(resultado.token).toBeDefined();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.loginAttempt.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: ['login-teste@example.com', 'login-teste-2@example.com'] } } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- login`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the login service**

Create `lib/services/loginService.ts`:

```ts
import { prisma } from '@/lib/db';
import { verificarSegredo, criarSessao } from '@/lib/services/auth';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export interface ResultadoLogin {
  ok: boolean;
  token?: string;
  expiresAt?: Date;
  erro?: string;
}

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: email } });
  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Conta temporariamente bloqueada. Tente novamente mais tarde.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const senhaValida = user ? await verificarSegredo(senha, user.senhaHash) : false;

  if (!user || !senhaValida) {
    const novasTentativas = (tentativa?.tentativas ?? 0) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: email },
      create: { identificador: email, tentativas: 1 },
      update: {
        tentativas: novasTentativas,
        bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
      },
    });
    return { ok: false, erro: 'E-mail ou senha inválidos.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: email } });
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}
```

Create `app/admin/login/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar } from '@/lib/services/loginService';

export async function login(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const email = String(formData.get('email') ?? '');
  const senha = String(formData.get('senha') ?? '');

  const resultado = await autenticar(email, senha);
  if (!resultado.ok || !resultado.token || !resultado.expiresAt) {
    return { ok: false, erro: resultado.erro };
  }

  (await cookies()).set('sessao_admin', resultado.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: resultado.expiresAt,
    path: '/',
  });

  redirect('/admin');
}
```

Create `app/admin/login/page.tsx`:

```tsx
import { login } from './actions';

export default function LoginPage() {
  return (
    <form action={login}>
      <input name="email" type="email" required />
      <input name="senha" type="password" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- login`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/loginService.ts app/admin/login tests/integration/login.test.ts
git commit -m "feat: add admin login with brute-force lockout"
```

---

### Task 8: Proteção de /admin

**Files:**
- Create: `middleware.ts`, `lib/services/requireAdmin.ts`, `app/admin/(protegido)/layout.tsx`, `app/admin/(protegido)/page.tsx`

**Interfaces:**
- Consumes: `validarSessao` from `lib/services/auth.ts`.
- Produces: `requireAdmin(): Promise<{ userId: string }>` (redirects to `/admin/login` if invalid).

`middleware.ts` only checks cookie *presence* (Edge-safe, no Prisma) for a fast redirect; `requireAdmin` is the authoritative, DB-backed check and runs in the Node runtime inside the protected layout.

- [ ] **Step 1: Create the middleware**

Create `middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!request.cookies.get('sessao_admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
```

- [ ] **Step 2: Create the authoritative check**

Create `lib/services/requireAdmin.ts`:

```ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSessao } from '@/lib/services/auth';

export async function requireAdmin(): Promise<{ userId: string }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/admin/login');
  return sessao;
}
```

- [ ] **Step 3: Wire the protected layout**

Create `app/admin/(protegido)/layout.tsx`:

```tsx
import { requireAdmin } from '@/lib/services/requireAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
```

Create `app/admin/(protegido)/page.tsx`:

```tsx
export default function AdminHomePage() {
  return <p>Área administrativa — telas completas chegam na Etapa 3.</p>;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/admin` in a browser with no cookies.
Expected: redirected to `/admin/login`. After logging in (Task 7 form), `/admin` loads the placeholder page.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/services/requireAdmin.ts app/admin
git commit -m "feat: protect /admin behind session middleware and server-side check"
```

---

### Task 9: Script de seed do primeiro ADMIN

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `hashSegredo` from `lib/services/auth.ts`.

- [ ] **Step 1: Write the seed script**

Create `prisma/seed.ts`:

```ts
import { prisma } from '../lib/db';
import { hashSegredo } from '../lib/services/auth';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA_INICIAL;
  if (!email || !senha) throw new Error('ADMIN_EMAIL e ADMIN_SENHA_INICIAL são obrigatórios');

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log('Usuário admin já existe, nada a fazer.');
    return;
  }

  await prisma.user.create({ data: { nome: 'Administrador', email, senhaHash: await hashSegredo(senha) } });
  console.log(`Usuário admin criado: ${email}`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Wire the Prisma seed config**

Add to `package.json`:

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

- [ ] **Step 3: Run and verify**

Set `ADMIN_EMAIL` and `ADMIN_SENHA_INICIAL` in `.env.local`, then run: `npx prisma db seed`
Expected: "Usuário admin criado: ...". Running it again prints "Usuário admin já existe, nada a fazer." without error or duplication.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "chore: add seed script for the first admin user"
```

---

### Task 10: PIN do Pátio — verificação e emissão de acesso

**Files:**
- Create: `lib/services/patioAcesso.ts`, `app/patio/acesso/actions.ts`, `app/patio/acesso/page.tsx`
- Test: `tests/unit/patio-acesso.test.ts`

**Interfaces:**
- Consumes: `verificarSegredo` from `lib/services/auth.ts`.
- Produces: `verificarPin(pinInformado: string): Promise<boolean>`, `criarAcessoPatio(): Promise<{ token: string; expiresAt: Date }>`, `validarAcessoPatio(token: string): Promise<boolean>`.

The PIN never identifies an individual — it only unlocks the `/patio` area. The responsible person's name is captured per-lançamento in Etapa 2, not here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/patio-acesso.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { verificarPin, criarAcessoPatio, validarAcessoPatio } from '@/lib/services/patioAcesso';

describe('acesso do Pátio por PIN', () => {
  beforeAll(async () => {
    process.env.PATIO_PIN_HASH = await hashSegredo('1234');
  });

  it('aceita o PIN correto e rejeita o errado', async () => {
    expect(await verificarPin('1234')).toBe(true);
    expect(await verificarPin('0000')).toBe(false);
  });

  it('emite e valida um token de acesso, e rejeita após revogação', async () => {
    const { token } = await criarAcessoPatio();
    expect(await validarAcessoPatio(token)).toBe(true);

    await prisma.patioAcessoToken.updateMany({ data: { revokedAt: new Date() } });
    expect(await validarAcessoPatio(token)).toBe(false);
  });

  afterAll(async () => {
    await prisma.patioAcessoToken.deleteMany({});
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- patio-acesso`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/services/patioAcesso.ts`:

```ts
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { verificarSegredo } from '@/lib/services/auth';

export async function verificarPin(pinInformado: string): Promise<boolean> {
  const hashConfigurado = process.env.PATIO_PIN_HASH;
  if (!hashConfigurado) throw new Error('PATIO_PIN_HASH não configurado');
  return verificarSegredo(pinInformado, hashConfigurado);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function criarAcessoPatio(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  await prisma.patioAcessoToken.create({ data: { tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function validarAcessoPatio(token: string): Promise<boolean> {
  const registro = await prisma.patioAcessoToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!registro || registro.revokedAt || registro.expiresAt < new Date()) return false;
  return true;
}
```

Create `app/patio/acesso/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verificarPin, criarAcessoPatio } from '@/lib/services/patioAcesso';

export async function acessarPatio(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const pin = String(formData.get('pin') ?? '');
  const valido = await verificarPin(pin);
  if (!valido) return { ok: false, erro: 'Código inválido.' };

  const { token, expiresAt } = await criarAcessoPatio();
  (await cookies()).set('acesso_patio', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  redirect('/patio');
}
```

Create `app/patio/acesso/page.tsx`:

```tsx
import { acessarPatio } from './actions';

export default function AcessoPatioPage() {
  return (
    <form action={acessarPatio}>
      <input name="pin" type="password" inputMode="numeric" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- patio-acesso`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/patioAcesso.ts app/patio/acesso tests/unit/patio-acesso.test.ts
git commit -m "feat: add Patio PIN verification and access token issuance"
```

---

### Task 11: Proteção de /patio

**Files:**
- Modify: `middleware.ts`
- Create: `lib/services/requirePatioAcesso.ts`, `app/patio/(protegido)/layout.tsx`, `app/patio/(protegido)/page.tsx`

**Interfaces:**
- Consumes: `validarAcessoPatio` from `lib/services/patioAcesso.ts`.
- Produces: `requirePatioAcesso(): Promise<void>` (redirects to `/patio/acesso` if invalid).

- [ ] **Step 1: Extend the middleware**

Modify `middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!request.cookies.get('sessao_admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname.startsWith('/patio') && pathname !== '/patio/acesso') {
    if (!request.cookies.get('acesso_patio')) {
      return NextResponse.redirect(new URL('/patio/acesso', request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/patio/:path*'] };
```

- [ ] **Step 2: Create the authoritative check**

Create `lib/services/requirePatioAcesso.ts`:

```ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';

export async function requirePatioAcesso(): Promise<void> {
  const token = (await cookies()).get('acesso_patio')?.value;
  const valido = token ? await validarAcessoPatio(token) : false;
  if (!valido) redirect('/patio/acesso');
}
```

- [ ] **Step 3: Wire the protected layout**

Create `app/patio/(protegido)/layout.tsx`:

```tsx
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return <>{children}</>;
}
```

Create `app/patio/(protegido)/page.tsx`:

```tsx
export default function PatioHomePage() {
  return <p>Área do Pátio — telas completas de lançamento chegam na Etapa 2.</p>;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/patio` with no cookies.
Expected: redirected to `/patio/acesso`. After entering the correct PIN, `/patio` loads the placeholder page.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/services/requirePatioAcesso.ts app/patio
git commit -m "feat: protect /patio behind PIN access middleware and server-side check"
```

---

### Task 12: PWA — manifest + Service Worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`, `components/RegistrarServiceWorker.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/e2e/pwa.spec.ts`

- [ ] **Step 1: Create the manifest**

Create `public/manifest.json`:

```json
{
  "name": "Controle de Trilhos",
  "short_name": "Trilhos",
  "start_url": "/patio/acesso",
  "display": "standalone",
  "background_color": "#12151a",
  "theme_color": "#12151a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Create placeholder icon files (no Rumo branding — real artwork replaces these later without changing this task; a 1×1 pixel is an accepted placeholder at this stage, not a defect to flag in review):

Run:
```bash
node -e "require('fs').mkdirSync('public/icons', { recursive: true }); const b = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'); require('fs').writeFileSync('public/icons/icon-192.png', b); require('fs').writeFileSync('public/icons/icon-512.png', b);"
```

- [ ] **Step 2: Create the Service Worker**

Create `public/sw.js`:

```js
const CACHE_NAME = 'trilhos-shell-v1';
const APP_SHELL = ['/', '/patio/acesso', '/admin/login', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});
```

- [ ] **Step 3: Register the Service Worker and link the manifest**

Create `components/RegistrarServiceWorker.tsx`:

```tsx
'use client';
import { useEffect } from 'react';

export function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
```

Modify `app/layout.tsx` to add `<link rel="manifest" href="/manifest.json" />` in the metadata/head and render `<RegistrarServiceWorker />` once in the body.

- [ ] **Step 4: Write the E2E check**

Create `tests/e2e/pwa.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('service worker registra e manifest está acessível', async ({ page }) => {
  await page.goto('/patio/acesso');
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r));
  const manifestResponse = await page.request.get('/manifest.json');
  expect(manifestResponse.ok()).toBe(true);
});
```

Run: `npm run build && npm run test:e2e -- pwa`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/sw.js public/icons components/RegistrarServiceWorker.tsx app/layout.tsx tests/e2e/pwa.spec.ts
git commit -m "feat: add PWA manifest and app-shell service worker"
```

---

### Task 13: Camada offline — Dexie schema + clientId

**Files:**
- Create: `lib/offline/db.ts`
- Test: `tests/unit/offline-db.test.ts`

**Interfaces:**
- Produces: `db.movimentacoes` (Dexie table), `type SyncStatus`, `type MovimentacaoLocal`, `gerarClientId(): string`.

`payload` is deliberately typed as `unknown` here — the real Recebimento/Remetido payload shape (with Grupos/Medições and their validation) is defined in Etapa 2/4, not here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/offline-db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, gerarClientId } from '@/lib/offline/db';

describe('camada offline', () => {
  beforeEach(async () => {
    await db.movimentacoes.clear();
  });

  it('grava e lê uma movimentação pendente localmente', async () => {
    const clientId = gerarClientId();
    await db.movimentacoes.add({ clientId, payload: { tipo: 'RECEBIMENTO' }, syncStatus: 'PENDENTE', criadoEm: Date.now() });

    const registro = await db.movimentacoes.get(clientId);
    expect(registro?.syncStatus).toBe('PENDENTE');
  });

  it('gera clientId únicos', () => {
    expect(gerarClientId()).not.toBe(gerarClientId());
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- offline-db`
Expected: FAIL — module not found.

- [ ] **Step 3: Install Dexie and implement**

Run: `npm install dexie`

Create `lib/offline/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

export interface MovimentacaoLocal {
  clientId: string;
  payload: unknown;
  syncStatus: SyncStatus;
  criadoEm: number;
}

class TrilhosDB extends Dexie {
  movimentacoes!: Table<MovimentacaoLocal, string>;

  constructor() {
    super('trilhos-offline');
    this.version(1).stores({ movimentacoes: 'clientId, syncStatus, criadoEm' });
  }
}

export const db = new TrilhosDB();

export function gerarClientId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- offline-db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/db.ts tests/unit/offline-db.test.ts package.json package-lock.json
git commit -m "feat: add Dexie offline queue schema and clientId generation"
```

---

### Task 14: Endpoint de sincronização /api/sync

**Files:**
- Create: `lib/services/sync.ts`, `app/api/sync/route.ts`
- Test: `tests/integration/sync.test.ts`

**Interfaces:**
- Consumes: `validarAcessoPatio` from `lib/services/patioAcesso.ts`; `registrarHistorico` from `lib/services/historico.ts` (Task 5).
- Produces: `movimentacaoSyncSchema` (Zod), `type MovimentacaoSyncInput`, `sincronizarMovimentacao(input): Promise<Movimentacao>`, `POST /api/sync`.

This endpoint syncs only the generic `Movimentacao`-level fields defined in this etapa. Creating `Grupo`/`Medicao` with their business rules (reemprego ≥7m, SC classification) is Etapa 2/4 work that will extend this same schema and endpoint.

`sincronizarMovimentacao` must record a `HistoricoAlteracao` entry the first time a `clientId` is created (not on a repeated/idempotent sync) — this is the only place in Etapa 1 where a `Movimentacao` is actually created, and the spec's Definition of Done requires `HistoricoAlteracao` to capture creation.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/sync.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { sincronizarMovimentacao } from '@/lib/services/sync';

describe('sincronizarMovimentacao', () => {
  it('cria uma movimentação e não duplica ao reenviar o mesmo clientId', async () => {
    const input = {
      clientId: crypto.randomUUID(),
      tipo: 'RECEBIMENTO' as const,
      tipoDocumento: 'NF',
      numeroDocumento: '000002',
      tipoTransporte: 'CAMINHAO' as const,
      responsavelPatio: 'Teste Sync',
    };

    const primeira = await sincronizarMovimentacao(input);
    const segunda = await sincronizarMovimentacao(input);

    expect(segunda.id).toBe(primeira.id);
    const total = await prisma.movimentacao.count({ where: { clientId: input.clientId } });
    expect(total).toBe(1);
  });

  it('grava um histórico de criação apenas na primeira sincronização', async () => {
    const input = {
      clientId: crypto.randomUUID(),
      tipo: 'RECEBIMENTO' as const,
      tipoDocumento: 'NF',
      numeroDocumento: '000003',
      tipoTransporte: 'CAMINHAO' as const,
      responsavelPatio: 'Teste Sync Historico',
    };

    const criada = await sincronizarMovimentacao(input);
    await sincronizarMovimentacao(input);

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: criada.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0].acao).toBe('CRIACAO');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- sync`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/services/sync.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { registrarHistorico } from '@/lib/services/historico';

export const movimentacaoSyncSchema = z.object({
  clientId: z.string().uuid(),
  tipo: z.enum(['RECEBIMENTO', 'REMETIDO']),
  tipoDocumento: z.string().min(1),
  numeroDocumento: z.string().min(1),
  tipoTransporte: z.enum(['CAMINHAO', 'VAGAO', 'OUTRO']),
  responsavelPatio: z.string().min(1),
});

export type MovimentacaoSyncInput = z.infer<typeof movimentacaoSyncSchema>;

export async function sincronizarMovimentacao(input: MovimentacaoSyncInput) {
  const existente = await prisma.movimentacao.findUnique({ where: { clientId: input.clientId } });
  if (existente) return existente;

  const criada = await prisma.movimentacao.create({ data: input });
  await registrarHistorico({ movimentacaoId: criada.id, usuarioNome: input.responsavelPatio, acao: 'CRIACAO' });
  return criada;
}
```

Create `app/api/sync/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { movimentacaoSyncSchema, sincronizarMovimentacao } from '@/lib/services/sync';

export async function POST(request: NextRequest) {
  const token = (await cookies()).get('acesso_patio')?.value;
  const autorizado = token ? await validarAcessoPatio(token) : false;
  if (!autorizado) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const parsed = movimentacaoSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const movimentacao = await sincronizarMovimentacao(parsed.data);
  return NextResponse.json({ ok: true, id: movimentacao.id });
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/sync.ts app/api/sync tests/integration/sync.test.ts
git commit -m "feat: add idempotent movimentacao sync endpoint"
```

---

### Task 15: Motor de sincronização no cliente

**Files:**
- Create: `lib/offline/sync.ts`
- Test: `tests/unit/offline-sync.test.ts`

**Interfaces:**
- Consumes: `db` from `lib/offline/db.ts`.
- Produces: `sincronizarPendentes(fetchImpl?: typeof fetch): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/offline-sync.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';

describe('sincronizarPendentes', () => {
  beforeEach(async () => {
    await db.movimentacoes.clear();
  });

  it('marca como SINCRONIZADO quando o servidor aceita', async () => {
    await db.movimentacoes.add({ clientId: 'abc', payload: { tipo: 'RECEBIMENTO' }, syncStatus: 'PENDENTE', criadoEm: Date.now() });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    expect((await db.movimentacoes.get('abc'))?.syncStatus).toBe('SINCRONIZADO');
  });

  it('mantém PENDENTE quando a rede falha', async () => {
    await db.movimentacoes.add({ clientId: 'def', payload: { tipo: 'RECEBIMENTO' }, syncStatus: 'PENDENTE', criadoEm: Date.now() });

    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    expect((await db.movimentacoes.get('def'))?.syncStatus).toBe('PENDENTE');
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- offline-sync`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/offline/sync.ts`:

```ts
import { db } from '@/lib/offline/db';

export async function sincronizarPendentes(fetchImpl: typeof fetch = fetch): Promise<void> {
  const pendentes = await db.movimentacoes.where('syncStatus').equals('PENDENTE').toArray();

  for (const registro of pendentes) {
    await db.movimentacoes.update(registro.clientId, { syncStatus: 'SINCRONIZANDO' });

    try {
      const resposta = await fetchImpl('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro.payload),
      });

      await db.movimentacoes.update(registro.clientId, { syncStatus: resposta.ok ? 'SINCRONIZADO' : 'PENDENTE' });
    } catch {
      await db.movimentacoes.update(registro.clientId, { syncStatus: 'PENDENTE' });
    }
  }
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- offline-sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/sync.ts tests/unit/offline-sync.test.ts
git commit -m "feat: add client-side sync engine for the offline queue"
```

---

### Task 16: Indicadores de UI (online/offline/pendências)

**Files:**
- Create: `lib/hooks/useOnlineStatus.ts`, `components/IndicadorSincronizacao.tsx`
- Modify: `app/patio/(protegido)/layout.tsx` (created in Task 11 — add the indicator)
- Test: `tests/unit/indicador-sincronizacao.test.tsx`

This is a generic status indicator (online/offline + pending count) — not a Recebimento/Remetido screen. It will be reused unchanged by the real forms in Etapa 2.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/indicador-sincronizacao.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

describe('IndicadorSincronizacao', () => {
  it('renderiza sem erros', () => {
    render(<IndicadorSincronizacao />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- indicador-sincronizacao`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/hooks/useOnlineStatus.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
```

Create `components/IndicadorSincronizacao.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/offline/db';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

export function IndicadorSincronizacao() {
  const online = useOnlineStatus();
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    const atualizar = () => db.movimentacoes.where('syncStatus').equals('PENDENTE').count().then(setPendentes);
    atualizar();
    const intervalo = setInterval(atualizar, 5000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div role="status">
      {!online && <span>Offline</span>}
      {pendentes > 0 && <span>{pendentes} aguardando sincronização</span>}
    </div>
  );
}
```

Add `<IndicadorSincronizacao />` to `app/patio/(protegido)/layout.tsx` (from Task 11).

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- indicador-sincronizacao`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useOnlineStatus.ts components/IndicadorSincronizacao.tsx app/patio/(protegido)/layout.tsx tests/unit/indicador-sincronizacao.test.tsx
git commit -m "feat: add generic online/offline and pending-sync indicator"
```

---

### Task 17: Headers de segurança + CORS

**Files:**
- Modify: `next.config.ts`
- Test: `tests/e2e/security-headers.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/security-headers.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('resposta inclui headers de segurança', async ({ request }) => {
  const resposta = await request.get('/patio/acesso');
  expect(resposta.headers()['x-content-type-options']).toBe('nosniff');
  expect(resposta.headers()['x-frame-options']).toBe('DENY');
});
```

Run: `npm run test:e2e -- security-headers`
Expected: FAIL — headers absent.

- [ ] **Step 2: Implement**

Modify `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Run and verify pass**

Run: `npm run build && npm run test:e2e -- security-headers`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts tests/e2e/security-headers.spec.ts
git commit -m "feat: add baseline security headers"
```

---

### Task 18: Testes E2E de fumaça (login, PIN)

**Files:**
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write the tests**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('acesso ao admin exige login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('acesso ao pátio exige PIN', async ({ page }) => {
  await page.goto('/patio');
  await expect(page).toHaveURL(/\/patio\/acesso/);
});

test('PIN correto libera acesso ao pátio', async ({ page }) => {
  await page.goto('/patio/acesso');
  await page.fill('input[name="pin"]', process.env.PATIO_PIN_TESTE ?? '');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/patio');
});

test('login correto libera acesso ao admin', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? '');
  await page.fill('input[name="senha"]', process.env.ADMIN_SENHA_INICIAL ?? '');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/admin');
});
```

- [ ] **Step 2: Run and verify pass**

Run: `npm run test:e2e -- smoke`
Expected: PASS (requires `PATIO_PIN_TESTE`, `ADMIN_EMAIL`, `ADMIN_SENHA_INICIAL` set in the test environment, matching the PIN/seed used for that run).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test: add end-to-end smoke tests for admin login and Patio PIN gate"
```

---

### Task 19: Checkpoint security-review

**Files:** none (review task)

- [ ] **Step 1: Run the security-review skill** over the full diff introduced by Tasks 1–18.
- [ ] **Step 2: Address any critical/high findings** inline, re-running the affected task's tests after each fix.
- [ ] **Step 3: Record the outcome** — confirm no critical/high findings remain open before marking Etapa 1 complete.

---

## Self-Review

**Spec coverage:** Identidade visual (§3, no code needed yet — deferred to Etapa 2 screens) → not a code task, correctly excluded. Arquitetura (§4) → Task 4 file structure. Modelo de dados (§6) → Task 4. Autenticação (§7 admin) → Tasks 6–9. Acesso do Pátio (§7 PIN) → Tasks 10–11. PWA/offline (§8) → Tasks 12–13. Sincronização (§8) → Tasks 14–15. Auditoria (§9) → Task 5. Segurança (§10) → Tasks 6, 8, 10, 11, 17, 19. Testes (§12) → Tasks 2–18 each carry their own. Critérios de conclusão (§13) → covered by the union of all tasks' passing tests plus Task 19.

**Placeholder scan:** no TBD/TODO left; every step has runnable code or an explicit manual-verification instruction.

**Type consistency:** `Perfil`, `ClassificacaoSC`, `SyncStatus`, `MovimentacaoLocal`, `MovimentacaoSyncInput` are each defined once and referenced with the same name and shape everywhere they're used across tasks (verified: `lib/offline/sync.ts` imports `db` only, not the sync schema; `app/api/sync/route.ts` and `tests/integration/sync.test.ts` both use `sincronizarMovimentacao`/`movimentacaoSyncSchema` from `lib/services/sync.ts`).
