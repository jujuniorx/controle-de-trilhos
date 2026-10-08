# Bloco 1 — Bugs que impedem salvar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir três bugs que hoje impedem ou arriscam o salvamento no Pátio: perda de medidas ao navegar para fora do wizard de Recebimento (sem persistência incremental no Dexie), ausência de qualquer estimativa de peso para grupos de Sucata (Recebimento), e exigência de um "Peso da NF" que o Pátio normalmente não tem (Remetido).

**Architecture:** (1) Nova tabela Dexie `rascunhosRecebimento` com uma única linha (`id: 'atual'`) que o `RecebimentoWizard` escreve a cada mudança de estado e lê ao montar — exatamente o mesmo Dexie já usado para o payload final, só que para o rascunho em andamento. (2) Peso de Sucata (Recebimento) e Peso da NF ausente (Remetido) passam a usar a MESMA fórmula já usada em Reemprego (`calcularPeso` = metros × fator do perfil, em `lib/services/calculo.ts`), gravada no campo `Grupo.pesoCalculado` já existente — sinalizada como estimativa "a confirmar" sempre que o valor informado pelo humano (`pesoSucataReal` no nível da Movimentacao para Sucata do Recebimento; `Grupo.pesoInformado` para o Remetido) ainda for nulo. Nenhum dado novo, nenhuma tabela nova no Postgres — só preencher campos que hoje ficam hardcoded em `null`.

**Tech Stack:** Next.js 16 (App Router), Prisma + Postgres (Neon), Dexie (IndexedDB), Zod, Vitest + Testing Library, Playwright, `fake-indexeddb`.

**Spec:** Bloco 1 do pedido do usuário nesta conversa (sem documento de spec separado — os itens 1.1/1.2/1.3 abaixo são a spec).

## Global Constraints

- O botão "Finalizar e salvar" do Pátio (Recebimento e Remetido) nunca pode ficar bloqueado por causa de peso de Sucata ou de Peso da NF ausente.
- Nenhuma migração de schema Prisma neste bloco — os campos usados (`Grupo.pesoCalculado`, `Grupo.pesoInformado`, `Movimentacao.pesoSucataReal`) já existem.
- `npx vitest run` e `npx playwright test` têm que passar depois de cada task antes de prosseguir para a próxima.
- Textos novos de UI em pt-BR, consistentes com o restante do app (ver exemplos em cada task).

---

## Task 1: Dexie — primitivas de rascunho do Recebimento

**Files:**
- Modify: `lib/offline/db.ts`
- Test: `tests/unit/offline-db-rascunho.test.ts`

**Interfaces:**
- Produces: `RascunhoRecebimento { id: 'atual'; clientId: string; rascunho: unknown; atualizadoEm: number }`, `salvarRascunhoRecebimento(clientId: string, rascunho: unknown): Promise<void>`, `lerRascunhoRecebimento(): Promise<RascunhoRecebimento | undefined>`, `limparRascunhoRecebimento(): Promise<void>`.

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
// tests/unit/offline-db-rascunho.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { db, salvarRascunhoRecebimento, lerRascunhoRecebimento, limparRascunhoRecebimento } from '@/lib/offline/db';

describe('rascunho de Recebimento em andamento (Dexie)', () => {
  afterEach(async () => {
    await db.rascunhosRecebimento.clear();
  });

  it('salva e lê de volta o rascunho mais recente', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 2, grupos: ['a'] });

    const registro = await lerRascunhoRecebimento();
    expect(registro?.clientId).toBe('client-1');
    expect(registro?.rascunho).toEqual({ passo: 2, grupos: ['a'] });
    expect(typeof registro?.atualizadoEm).toBe('number');
  });

  it('salvar de novo substitui o rascunho anterior (só existe um por vez)', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 1 });
    await salvarRascunhoRecebimento('client-1', { passo: 3 });

    const registro = await lerRascunhoRecebimento();
    expect(registro?.rascunho).toEqual({ passo: 3 });
    expect(await db.rascunhosRecebimento.count()).toBe(1);
  });

  it('sem rascunho salvo, a leitura devolve undefined', async () => {
    expect(await lerRascunhoRecebimento()).toBeUndefined();
  });

  it('limpar remove o rascunho', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 2 });
    await limparRascunhoRecebimento();
    expect(await lerRascunhoRecebimento()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/offline-db-rascunho.test.ts`
Expected: FAIL — `salvarRascunhoRecebimento`/`lerRascunhoRecebimento`/`limparRascunhoRecebimento` não existem, ou `db.rascunhosRecebimento` é `undefined` (tabela não declarada).

- [ ] **Step 3: Implementar**

Em `lib/offline/db.ts`, trocar o arquivo inteiro:

De:
```ts
import Dexie, { type EntityTable } from 'dexie';
import type { RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

export interface RecebimentoLocal {
  clientId: string;
  payload: RecebimentoCaminhaoInput;
  syncStatus: SyncStatus;
  erro?: string;
  criadoEm: number;
  serverId?: string;
  syncIniciadoEm?: number;
}

class TrilhosDB extends Dexie {
  recebimentos!: EntityTable<RecebimentoLocal, 'clientId'>;

  constructor() {
    super('TrilhosDB');
    this.version(1).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
    });
  }
}

export const db = new TrilhosDB();

export async function salvarRecebimentoLocal(payload: RecebimentoCaminhaoInput): Promise<void> {
  await db.recebimentos.put({
    clientId: payload.clientId,
    payload,
    syncStatus: 'PENDENTE',
    criadoEm: Date.now(),
  });
}
```

Para:
```ts
import Dexie, { type EntityTable } from 'dexie';
import type { RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

export interface RecebimentoLocal {
  clientId: string;
  payload: RecebimentoCaminhaoInput;
  syncStatus: SyncStatus;
  erro?: string;
  criadoEm: number;
  serverId?: string;
  syncIniciadoEm?: number;
}

// Rascunho do wizard de Recebimento AINDA EM EDIÇÃO (não finalizado). Uma única
// linha de id fixo 'atual': só existe um caminhão sendo lançado por vez neste
// tablet. `rascunho` é o estado interno do wizard (passo, dados, grupos) —
// shape de responsabilidade do componente, não desta camada (por isso `unknown`).
export interface RascunhoRecebimento {
  id: 'atual';
  clientId: string;
  rascunho: unknown;
  atualizadoEm: number;
}

class TrilhosDB extends Dexie {
  recebimentos!: EntityTable<RecebimentoLocal, 'clientId'>;
  rascunhosRecebimento!: EntityTable<RascunhoRecebimento, 'id'>;

  constructor() {
    super('TrilhosDB');
    this.version(1).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
    });
    this.version(2).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
      rascunhosRecebimento: 'id',
    });
  }
}

export const db = new TrilhosDB();

export async function salvarRecebimentoLocal(payload: RecebimentoCaminhaoInput): Promise<void> {
  await db.recebimentos.put({
    clientId: payload.clientId,
    payload,
    syncStatus: 'PENDENTE',
    criadoEm: Date.now(),
  });
}

export async function salvarRascunhoRecebimento(clientId: string, rascunho: unknown): Promise<void> {
  await db.rascunhosRecebimento.put({ id: 'atual', clientId, rascunho, atualizadoEm: Date.now() });
}

export async function lerRascunhoRecebimento(): Promise<RascunhoRecebimento | undefined> {
  return db.rascunhosRecebimento.get('atual');
}

export async function limparRascunhoRecebimento(): Promise<void> {
  await db.rascunhosRecebimento.delete('atual');
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/offline-db-rascunho.test.ts tests/unit/offline-db.test.ts`
Expected: PASS (todos) — o teste pré-existente `offline-db.test.ts` continua passando porque a tabela `recebimentos` não mudou de índice, só ganhou uma vizinha nova.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/db.ts tests/unit/offline-db-rascunho.test.ts
git commit -m "feat(patio): tabela Dexie de rascunho do Recebimento em andamento"
```

---

## Task 2: RecebimentoWizard — restaurar, persistir e limpar o rascunho

**Files:**
- Modify: `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`
- Modify: `tests/unit/recebimento-wizard.test.tsx` (mock de `@/lib/offline/db` precisa ganhar as 3 funções novas)
- Test: `tests/unit/recebimento-wizard-rascunho.test.tsx`

**Interfaces:**
- Consumes: `salvarRascunhoRecebimento`, `lerRascunhoRecebimento`, `limparRascunhoRecebimento` (Task 1).

- [ ] **Step 1: Atualizar o mock do teste existente (senão quebra nesta task)**

Em `tests/unit/recebimento-wizard.test.tsx`, trocar:

De:
```ts
const { pushMock, salvarRecebimentoLocalMock, sincronizarPendentesMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  salvarRecebimentoLocalMock: vi.fn().mockResolvedValue(undefined),
  sincronizarPendentesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/offline/db', () => ({
  salvarRecebimentoLocal: salvarRecebimentoLocalMock,
}));
```

Para:
```ts
const {
  pushMock,
  salvarRecebimentoLocalMock,
  sincronizarPendentesMock,
  salvarRascunhoRecebimentoMock,
  lerRascunhoRecebimentoMock,
  limparRascunhoRecebimentoMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  salvarRecebimentoLocalMock: vi.fn().mockResolvedValue(undefined),
  sincronizarPendentesMock: vi.fn().mockResolvedValue(undefined),
  salvarRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
  lerRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
  limparRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/offline/db', () => ({
  salvarRecebimentoLocal: salvarRecebimentoLocalMock,
  salvarRascunhoRecebimento: salvarRascunhoRecebimentoMock,
  lerRascunhoRecebimento: lerRascunhoRecebimentoMock,
  limparRascunhoRecebimento: limparRascunhoRecebimentoMock,
}));
```

E no `beforeEach`, acrescentar as novas ao `.mockClear()` e devolver o mock de leitura ao estado "sem rascunho":

De:
```ts
  beforeEach(() => {
    pushMock.mockClear();
    salvarRecebimentoLocalMock.mockClear();
    sincronizarPendentesMock.mockClear();
  });
```

Para:
```ts
  beforeEach(() => {
    pushMock.mockClear();
    salvarRecebimentoLocalMock.mockClear();
    sincronizarPendentesMock.mockClear();
    salvarRascunhoRecebimentoMock.mockClear();
    limparRascunhoRecebimentoMock.mockClear();
    lerRascunhoRecebimentoMock.mockReset().mockResolvedValue(undefined);
  });
```

- [ ] **Step 2: Escrever o teste de restauração (falhando)**

```tsx
// tests/unit/recebimento-wizard-rascunho.test.tsx
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RecebimentoWizard } from '@/app/patio/(protegido)/recebimentos/novo/RecebimentoWizard';
import { db } from '@/lib/offline/db';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/offline/sync', () => ({ sincronizarPendentes: vi.fn().mockResolvedValue(undefined) }));

describe('RecebimentoWizard — rascunho sobrevive a sair e voltar (ex.: botão "voltar" do navegador)', () => {
  afterEach(async () => {
    cleanup();
    await db.rascunhosRecebimento.clear();
  });

  it('restaura o grupo e a medição depois que o componente desmonta e remonta', async () => {
    const { unmount } = render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    fireEvent.change(document.getElementById('f-nf')!, { target: { value: '123456' } });
    fireEvent.change(document.getElementById('f-origem')!, { target: { value: 'Rondonópolis' } });
    fireEvent.change(document.getElementById('f-cavalo')!, { target: { value: 'ABC1D23' } });
    fireEvent.change(document.getElementById('f-resp')!, { target: { value: 'Teste Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Perfil do novo grupo'), { target: { value: 'TR57' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lançar medidas' }));
    fireEvent.change(screen.getByLabelText('Comprimento'), { target: { value: '8,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('1. 8.10 m')).toBeTruthy();

    // Aguarda o efeito de persistência rodar antes de "sair da tela" (desmontar).
    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeDefined();
    });

    unmount();

    render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    expect(await screen.findByText('1. 8.10 m')).toBeTruthy();
    expect((document.getElementById('f-nf') as HTMLInputElement).value).toBe('123456');
  });

  it('finalizar com sucesso limpa o rascunho, para o próximo recebimento começar em branco', async () => {
    const { salvarRecebimentoLocal } = await import('@/lib/offline/db');
    vi.spyOn(await import('@/lib/offline/db'), 'salvarRecebimentoLocal').mockResolvedValue(undefined);

    render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    fireEvent.change(document.getElementById('f-nf')!, { target: { value: '654321' } });
    fireEvent.change(document.getElementById('f-origem')!, { target: { value: 'Rondonópolis' } });
    fireEvent.change(document.getElementById('f-cavalo')!, { target: { value: 'ABC1D23' } });
    fireEvent.change(document.getElementById('f-resp')!, { target: { value: 'Teste Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Perfil do novo grupo'), { target: { value: 'TR57' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lançar medidas' }));
    fireEvent.change(screen.getByLabelText('Comprimento'), { target: { value: '8,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos grupos', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }));

    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar e salvar' }));

    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeUndefined();
    });

    expect(salvarRecebimentoLocal).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/recebimento-wizard-rascunho.test.tsx`
Expected: FAIL — depois de remontar, os campos voltam vazios (nenhuma restauração implementada ainda).

- [ ] **Step 4: Implementar a restauração/persistência/limpeza no wizard**

Em `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`:

Trocar o import no topo:

De:
```tsx
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERFIS,
  CLASSIFICACOES_REEMPREGO,
  CLASSIFICACOES_SC,
  PLACA_REGEX,
  MARCAS,
  MARCA_LABEL,
  recebimentoCaminhaoSchema,
} from '@/lib/validation/recebimento';
import { validarReemprego } from '@/lib/domain/regras';
import { salvarRecebimentoLocal } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';
```

Para:
```tsx
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERFIS,
  CLASSIFICACOES_REEMPREGO,
  CLASSIFICACOES_SC,
  PLACA_REGEX,
  MARCAS,
  MARCA_LABEL,
  recebimentoCaminhaoSchema,
} from '@/lib/validation/recebimento';
import { validarReemprego } from '@/lib/domain/regras';
import {
  salvarRecebimentoLocal,
  salvarRascunhoRecebimento,
  lerRascunhoRecebimento,
  limparRascunhoRecebimento,
} from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';
```

Logo depois das interfaces `Dados`/`GrupoLocal`/`MedicaoLocal` (antes de `novoUuid`), acrescentar o shape do rascunho e o type guard:

```tsx
interface RascunhoWizard {
  clientId: string;
  step: number;
  dadosBrutos: Dados;
  dataTocada: boolean;
  grupos: GrupoLocal[];
  activeGrupoId: string | null;
}

function ehRascunhoValido(v: unknown): v is RascunhoWizard {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { grupos?: unknown }).grupos) &&
    typeof (v as { dadosBrutos?: unknown }).dadosBrutos === 'object'
  );
}
```

Dentro do componente, trocar a declaração de `clientId` e acrescentar o controle de restauração logo depois dos outros `useState`:

De:
```tsx
  const [clientId] = useState(novoUuid);
```

Para:
```tsx
  const [clientId, setClientId] = useState(novoUuid);
  // true até a leitura do rascunho no Dexie terminar — enquanto isso, o efeito
  // que GRAVA o rascunho fica pausado, para não sobrescrever um rascunho salvo
  // com o estado em branco do primeiro render.
  const [restaurando, setRestaurando] = useState(true);
```

Depois da declaração de `const [erroFinal, setErroFinal] = useState('');`, acrescentar os dois `useEffect`:

```tsx
  useEffect(() => {
    let ativo = true;
    lerRascunhoRecebimento().then((registro) => {
      if (!ativo) return;
      if (registro && ehRascunhoValido(registro.rascunho)) {
        const r = registro.rascunho;
        setClientId(registro.clientId);
        setStep(r.step);
        setDados(r.dadosBrutos);
        setDataTocada(r.dataTocada);
        setGrupos(r.grupos);
        setActiveGrupoId(r.activeGrupoId);
      }
      setRestaurando(false);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restaurando) return;
    void salvarRascunhoRecebimento(clientId, {
      clientId,
      step,
      dadosBrutos,
      dataTocada,
      grupos,
      activeGrupoId,
    });
  }, [restaurando, clientId, step, dadosBrutos, dataTocada, grupos, activeGrupoId]);
```

Por fim, em `finalizar()`, limpar o rascunho depois da gravação do Dexie ter sucedido (antes de navegar):

De:
```tsx
    // Tentativa de sincronização best-effort: não bloqueia a navegação esperando a
    // rede. Se falhar (ou estiver offline), o registro já está salvo localmente e a
    // página de confirmação mostra o status; uma nova tentativa acontece depois
    // (retry manual na página, ou o indicador de sincronização de vida longa da Task 7).
    void sincronizarPendentes().catch(() => {});

    setEnviando(false);
    router.push(`/patio/recebimentos/${parsed.data.clientId}/confirmado`);
```

Para:
```tsx
    // Rascunho cumpriu seu papel — o recebimento já está na tabela definitiva
    // (`recebimentos`). Limpar agora evita que o PRÓXIMO caminhão abra o wizard
    // e encontre, por engano, os dados do caminhão que acabou de ser salvo.
    await limparRascunhoRecebimento();

    // Tentativa de sincronização best-effort: não bloqueia a navegação esperando a
    // rede. Se falhar (ou estiver offline), o registro já está salvo localmente e a
    // página de confirmação mostra o status; uma nova tentativa acontece depois
    // (retry manual na página, ou o indicador de sincronização de vida longa da Task 7).
    void sincronizarPendentes().catch(() => {});

    setEnviando(false);
    router.push(`/patio/recebimentos/${parsed.data.clientId}/confirmado`);
```

(O import de `useRef` adicionado acima não é usado — remover `useRef` do import do Step 4 antes de rodar o lint/build: a linha final deve ser `import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';`.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/recebimento-wizard-rascunho.test.tsx tests/unit/recebimento-wizard.test.tsx`
Expected: PASS (ambos os arquivos).

- [ ] **Step 6: Lint/типecheck**

Run: `npx tsc --noEmit`
Expected: sem erros (confirma que não sobrou `useRef` importado sem uso, e que os tipos do rascunho batem com `Dados`/`GrupoLocal`).

- [ ] **Step 7: Commit**

```bash
git add app/patio/\(protegido\)/recebimentos/novo/RecebimentoWizard.tsx tests/unit/recebimento-wizard.test.tsx tests/unit/recebimento-wizard-rascunho.test.tsx
git commit -m "fix(patio): restaura rascunho do Recebimento ao voltar/reabrir o wizard"
```

---

## Task 3: Peso estimado de Sucata no Recebimento — serviço

**Files:**
- Modify: `lib/services/movimentacao.ts`
- Modify: `tests/integration/movimentacao.test.ts`

**Interfaces:**
- Produces: `ResumoPeso` ganha o campo `pesoSucataEstimado: number`. `Grupo.pesoCalculado` de grupos SUCATA passa a ser preenchido (deixa de ser sempre `null`).
- **Nenhuma mudança de assinatura** em `criarRecebimentoCaminhao`/`resumoPeso` — só o conteúdo que produzem.

- [ ] **Step 1: Atualizar o teste de integração existente (vai falhar com a mudança)**

Em `tests/integration/movimentacao.test.ts`, trocar o teste:

De:
```ts
  it('cria um recebimento com grupo SUCATA sem calcular peso, mantendo pesoSucataReal nulo', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
          ],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.pesoSucataReal).toBeNull();
    const grupo = mov.grupos[0];
    expect(grupo.pesoCalculado).toBeNull();
    expect(grupo.medicoes.map((m) => m.classificacaoSC).sort()).toEqual(['SC1', 'SC3']);
  });
```

Para:
```ts
  it('cria um recebimento com grupo SUCATA calculando um peso ESTIMADO (mesma fórmula do Reemprego), mantendo pesoSucataReal nulo até o Admin confirmar', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
          ],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    // O peso REAL (confirmado pelo Admin a partir da pesagem) continua pendente —
    // só o que muda é que agora existe uma ESTIMATIva, não mais null.
    expect(mov.pesoSucataReal).toBeNull();
    const grupo = mov.grupos[0];
    expect(Number(grupo.pesoCalculado)).toBe(0.605); // (8.1 + 2.5) * 0.057 = 0.6042 -> arredondado
    expect(grupo.medicoes.map((m) => m.classificacaoSC).sort()).toEqual(['SC1', 'SC3']);
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/integration/movimentacao.test.ts -t "SUCATA"`
Expected: FAIL — `grupo.pesoCalculado` ainda é `null`.

- [ ] **Step 3: Implementar — `prepararGrupos` calcula peso também para SUCATA**

Em `lib/services/movimentacao.ts`, trocar:

De:
```ts
    if (grupo.tipoMaterial === 'SUCATA') {
      gruposParaCriar.push({
        clientId: grupo.clientId,
        perfil: grupo.perfil,
        tipoMaterial: 'SUCATA',
        classificacao: null,
        fabricante: null,
        metrosTotal,
        pesoCalculado: null, // nunca calculado para sucata — fica pendente no nível da Movimentacao
        medicoes: grupo.medicoes.map((m, i) => ({
          clientId: m.clientId,
          modo: m.modo,
          quantidade: m.quantidade,
          comprimento: m.comprimento,
          metros: metrosPorMedicao[i],
          classificacaoSC: m.classificacaoSC,
        })),
      });
      continue;
    }

    // NOVO e REEMPREGO: peso sempre calculado pelo fator cadastrado do perfil.
    const pesoCalculado = await calcularPeso(metrosTotal, grupo.perfil);
    gruposParaCriar.push({
      clientId: grupo.clientId,
      perfil: grupo.perfil,
      tipoMaterial: grupo.tipoMaterial,
      classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
      fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
      metrosTotal,
      pesoCalculado,
      medicoes: grupo.medicoes.map((m, i) => ({
        clientId: m.clientId,
        modo: m.modo,
        quantidade: m.quantidade,
        comprimento: m.comprimento,
        metros: metrosPorMedicao[i],
        classificacaoSC: null,
      })),
    });
  }
```

Para:
```ts
    // O peso de TODOS os materiais (NOVO, REEMPREGO e agora também SUCATA) é
    // calculado pelo mesmo fator cadastrado do perfil: metros x fator. Para
    // SUCATA, esse valor é só uma ESTIMATIVA — o peso REAL, tirado da balança,
    // continua vivendo em Movimentacao.pesoSucataReal (um único valor para o
    // caminhão inteiro, preenchido pelo Admin na Conferência). O Pátio nunca
    // pode ficar bloqueado por isso: ver resumoPeso()/conferirRecebimento().
    const pesoCalculado = await calcularPeso(metrosTotal, grupo.perfil);

    if (grupo.tipoMaterial === 'SUCATA') {
      gruposParaCriar.push({
        clientId: grupo.clientId,
        perfil: grupo.perfil,
        tipoMaterial: 'SUCATA',
        classificacao: null,
        fabricante: null,
        metrosTotal,
        pesoCalculado,
        medicoes: grupo.medicoes.map((m, i) => ({
          clientId: m.clientId,
          modo: m.modo,
          quantidade: m.quantidade,
          comprimento: m.comprimento,
          metros: metrosPorMedicao[i],
          classificacaoSC: m.classificacaoSC,
        })),
      });
      continue;
    }

    gruposParaCriar.push({
      clientId: grupo.clientId,
      perfil: grupo.perfil,
      tipoMaterial: grupo.tipoMaterial,
      classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
      fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
      metrosTotal,
      pesoCalculado,
      medicoes: grupo.medicoes.map((m, i) => ({
        clientId: m.clientId,
        modo: m.modo,
        quantidade: m.quantidade,
        comprimento: m.comprimento,
        metros: metrosPorMedicao[i],
        classificacaoSC: null,
      })),
    });
  }
```

- [ ] **Step 4: Expor `pesoSucataEstimado` em `resumoPeso`**

Trocar:
```ts
export interface ResumoPeso {
  temSucata: boolean;
  pesoNovo: number;
  pesoReemprego: number;
  /** Soma de NOVO + REEMPREGO — mantido para compatibilidade com o resumo já usado na conferência. */
  pesoNovoReemprego: number;
  pesoSucataReal: number | null;
  pendente: boolean;
  pesoTotal: number | null;
}

function somaPeso(movimentacao: MovimentacaoComGrupos, tipo: 'NOVO' | 'REEMPREGO'): number {
  return arredondar3(
    movimentacao.grupos
      .filter((g) => g.tipoMaterial === tipo)
      .reduce((acc, g) => acc + Number(g.pesoCalculado ?? 0), 0),
  );
}

export function resumoPeso(movimentacao: MovimentacaoComGrupos): ResumoPeso {
  const temSucata = movimentacao.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovo = somaPeso(movimentacao, 'NOVO');
  const pesoReemprego = somaPeso(movimentacao, 'REEMPREGO');
  const pesoNovoReemprego = arredondar3(pesoNovo + pesoReemprego);
  const pesoSucataReal = movimentacao.pesoSucataReal != null ? Number(movimentacao.pesoSucataReal) : null;
  const pendente = temSucata && pesoSucataReal == null;
  const pesoTotal = pendente ? null : arredondar3(pesoNovoReemprego + (pesoSucataReal ?? 0));
  return { temSucata, pesoNovo, pesoReemprego, pesoNovoReemprego, pesoSucataReal, pendente, pesoTotal };
}
```

Por:
```ts
export interface ResumoPeso {
  temSucata: boolean;
  pesoNovo: number;
  pesoReemprego: number;
  /** Soma de NOVO + REEMPREGO — mantido para compatibilidade com o resumo já usado na conferência. */
  pesoNovoReemprego: number;
  /** Estimativa (metros x fator) para os grupos SUCATA — "a confirmar" até o Admin informar pesoSucataReal. */
  pesoSucataEstimado: number;
  pesoSucataReal: number | null;
  pendente: boolean;
  pesoTotal: number | null;
}

function somaPeso(movimentacao: MovimentacaoComGrupos, tipo: 'NOVO' | 'REEMPREGO' | 'SUCATA'): number {
  return arredondar3(
    movimentacao.grupos
      .filter((g) => g.tipoMaterial === tipo)
      .reduce((acc, g) => acc + Number(g.pesoCalculado ?? 0), 0),
  );
}

export function resumoPeso(movimentacao: MovimentacaoComGrupos): ResumoPeso {
  const temSucata = movimentacao.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovo = somaPeso(movimentacao, 'NOVO');
  const pesoReemprego = somaPeso(movimentacao, 'REEMPREGO');
  const pesoNovoReemprego = arredondar3(pesoNovo + pesoReemprego);
  const pesoSucataEstimado = somaPeso(movimentacao, 'SUCATA');
  const pesoSucataReal = movimentacao.pesoSucataReal != null ? Number(movimentacao.pesoSucataReal) : null;
  const pendente = temSucata && pesoSucataReal == null;
  const pesoTotal = pendente ? null : arredondar3(pesoNovoReemprego + (pesoSucataReal ?? 0));
  return { temSucata, pesoNovo, pesoReemprego, pesoNovoReemprego, pesoSucataEstimado, pesoSucataReal, pendente, pesoTotal };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/integration/movimentacao.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo o atualizado).

Run também: `npx vitest run tests/integration/conferencia.test.ts tests/integration/exportarExcel.test.ts`
Expected: ainda PASSAM — `conferirRecebimento` continua checando `pesoSucataReal` (inalterado); o Excel ainda lê `mov.pesoSucataReal` para a linha combinada de sucata (inalterado nesta task — ver Bloco 5 para a reestruturação da planilha).

- [ ] **Step 6: Commit**

```bash
git add lib/services/movimentacao.ts tests/integration/movimentacao.test.ts
git commit -m "feat(recebimento): calcula peso estimado de Sucata (mesma fórmula do Reemprego)"
```

---

## Task 4: Peso estimado de Sucata — UI do Pátio e do Admin

**Files:**
- Modify: `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`
- Modify: `app/admin/(protegido)/recebimentos/[id]/page.tsx`
- Modify: `app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel.tsx`
- Modify: `tests/e2e/patio-recebimento.spec.ts`
- Modify: `tests/e2e/admin-recebimentos.spec.ts`

**Interfaces:**
- Consumes: `ResumoPeso.pesoSucataEstimado` (Task 3).

- [ ] **Step 1: Pátio — Resumo do wizard mostra a estimativa em vez de "PENDENTE"**

Em `RecebimentoWizard.tsx`, trocar o cálculo de peso por grupo na tabela do Resumo:

De:
```tsx
              {grupos.map((g, i) => {
                const fator = fatoresCadastrados[g.perfil];
                const metros = metrosDoGrupo(g);
                const peso = g.tipoMaterial === 'SUCATA' ? null : fator != null ? Math.round(metros * fator * 1000) / 1000 : null;
                return (
                  <tr key={g.clientId} className="border-t">
                    <td>
                      Grupo {i + 1} ({g.perfil})
                    </td>
                    <td>{g.tipoMaterial}</td>
                    <td className="text-right">{metros.toFixed(2)} m</td>
                    <td className="text-right">
                      {g.tipoMaterial === 'SUCATA'
                        ? 'PENDENTE'
                        : peso != null
                          ? `${peso.toFixed(3)} t`
                          : 'Fator não cadastrado'}
                    </td>
                  </tr>
                );
              })}
```

Para:
```tsx
              {grupos.map((g, i) => {
                const fator = fatoresCadastrados[g.perfil];
                const metros = metrosDoGrupo(g);
                const peso = fator != null ? Math.round(metros * fator * 1000) / 1000 : null;
                return (
                  <tr key={g.clientId} className="border-t">
                    <td>
                      Grupo {i + 1} ({g.perfil})
                    </td>
                    <td>{g.tipoMaterial}</td>
                    <td className="text-right">{metros.toFixed(2)} m</td>
                    <td className="text-right">
                      {peso == null ? (
                        'Fator não cadastrado'
                      ) : g.tipoMaterial === 'SUCATA' ? (
                        <>
                          {peso.toFixed(3)} t <span className="text-xs text-amber-700">(estimado)</span>
                        </>
                      ) : (
                        `${peso.toFixed(3)} t`
                      )}
                    </td>
                  </tr>
                );
              })}
```

E trocar o resumo final (soma + aviso de sucata) — precisa somar a estimativa de sucata separadamente:

De:
```tsx
  const temSucataPendente = grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovoReemprego = useMemo(() => {
    return grupos
      .filter((g) => g.tipoMaterial !== 'SUCATA')
      .reduce((acc, g) => {
        const fator = fatoresCadastrados[g.perfil];
        if (fator == null) return acc;
        return acc + Math.round(metrosDoGrupo(g) * fator * 1000) / 1000;
      }, 0);
  }, [grupos, fatoresCadastrados]);
```

Para:
```tsx
  const temSucataPendente = grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovoReemprego = useMemo(() => {
    return grupos
      .filter((g) => g.tipoMaterial !== 'SUCATA')
      .reduce((acc, g) => {
        const fator = fatoresCadastrados[g.perfil];
        if (fator == null) return acc;
        return acc + Math.round(metrosDoGrupo(g) * fator * 1000) / 1000;
      }, 0);
  }, [grupos, fatoresCadastrados]);
  const pesoSucataEstimado = useMemo(() => {
    return grupos
      .filter((g) => g.tipoMaterial === 'SUCATA')
      .reduce((acc, g) => {
        const fator = fatoresCadastrados[g.perfil];
        if (fator == null) return acc;
        return acc + Math.round(metrosDoGrupo(g) * fator * 1000) / 1000;
      }, 0);
  }, [grupos, fatoresCadastrados]);
```

E o bloco de totais:

De:
```tsx
          <div className="rounded bg-neutral-100 p-3 text-right">
            <p className="text-sm text-neutral-600">{temSucataPendente ? 'Peso até agora' : 'Peso total'}</p>
            <p className="text-xl font-semibold">{pesoNovoReemprego.toFixed(3)} t</p>
            {temSucataPendente && <p className="text-sm text-amber-700">SUCATA: PENDENTE</p>}
          </div>
```

Para:
```tsx
          <div className="rounded bg-neutral-100 p-3 text-right">
            <p className="text-sm text-neutral-600">{temSucataPendente ? 'Peso até agora' : 'Peso total'}</p>
            <p className="text-xl font-semibold">{pesoNovoReemprego.toFixed(3)} t</p>
            {temSucataPendente && (
              <p className="text-sm text-amber-700">
                SUCATA: {pesoSucataEstimado.toFixed(3)} t (estimado, a confirmar)
              </p>
            )}
          </div>
```

- [ ] **Step 2: Admin — detalhe do Recebimento mostra a estimativa em vez de "Peso pendente"**

Em `app/admin/(protegido)/recebimentos/[id]/page.tsx`, trocar:

De:
```tsx
              {g.tipoMaterial === 'SUCATA' ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Peso pendente</span>
              ) : (
                <span className="font-medium">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>
              )}
```

Para:
```tsx
              {g.tipoMaterial === 'SUCATA' ? (
                <span className="text-right">
                  <span className="font-medium">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>{' '}
                  <span className="text-xs text-amber-700">(estimado, a confirmar)</span>
                </span>
              ) : (
                <span className="font-medium">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>
              )}
```

E o bloco "Resumo de peso" quando pendente:

De:
```tsx
        {resumo.pendente ? (
          <div className="mt-2">
            <p className="text-sm text-neutral-500">PESO ATÉ AGORA</p>
            <p className="text-2xl font-semibold">{fmtPeso(resumo.pesoNovoReemprego)} t</p>
            <p className="text-xs text-neutral-500">NOVO + REEMPREGO</p>
            <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
              SUCATA — <b>Peso pendente</b>
            </div>
          </div>
        ) : (
```

Para:
```tsx
        {resumo.pendente ? (
          <div className="mt-2">
            <p className="text-sm text-neutral-500">PESO ATÉ AGORA</p>
            <p className="text-2xl font-semibold">{fmtPeso(resumo.pesoNovoReemprego)} t</p>
            <p className="text-xs text-neutral-500">NOVO + REEMPREGO</p>
            <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
              SUCATA — peso estimado <b>{fmtPeso(resumo.pesoSucataEstimado)} t</b> (a confirmar)
            </div>
          </div>
        ) : (
```

- [ ] **Step 3: ConferenciaPainel — pré-preenche o campo com a estimativa**

Em `app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel.tsx`, trocar:

De:
```tsx
interface Props {
  movimentacaoId: string;
  status: 'PENDENTE_CONFERENCIA' | 'CONFERIDO';
  temSucata: boolean;
  pesoSucataReal: number | null;
}

export function ConferenciaPainel({ movimentacaoId, status, temSucata, pesoSucataReal }: Props) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(pesoSucataReal != null ? String(pesoSucataReal).replace('.', ',') : '');
```

Para:
```tsx
interface Props {
  movimentacaoId: string;
  status: 'PENDENTE_CONFERENCIA' | 'CONFERIDO';
  temSucata: boolean;
  pesoSucataReal: number | null;
  /** Estimativa calculada (metros x fator) — usada só para pré-preencher o campo quando ainda não há peso real. */
  pesoSucataEstimado?: number;
}

export function ConferenciaPainel({ movimentacaoId, status, temSucata, pesoSucataReal, pesoSucataEstimado = 0 }: Props) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(
    pesoSucataReal != null
      ? String(pesoSucataReal).replace('.', ',')
      : pesoSucataEstimado > 0
        ? String(pesoSucataEstimado).replace('.', ',')
        : '',
  );
```

E acrescentar uma dica abaixo do label quando o campo foi pré-preenchido pela estimativa (ajuda o Admin a entender de onde veio o número):

De:
```tsx
          <label className="block text-sm font-medium text-neutral-700" htmlFor="peso-sucata">
            Peso real da sucata (t) — com base no documento de pesagem
          </label>
```

Para:
```tsx
          <label className="block text-sm font-medium text-neutral-700" htmlFor="peso-sucata">
            Peso real da sucata (t) — com base no documento de pesagem
          </label>
          {pesoSucataReal == null && pesoSucataEstimado > 0 && (
            <p className="mb-1 text-xs text-neutral-500">
              Valor sugerido pelo cálculo automático (metros × fator do perfil). Confirme ou corrija com o peso real da pesagem.
            </p>
          )}
```

Por fim, no único outro ponto onde `ConferenciaPainel` é usado (`app/admin/(protegido)/recebimentos/[id]/page.tsx`), passar a nova prop — trocar:

De:
```tsx
      <ConferenciaPainel
        movimentacaoId={mov.id}
        status={mov.status as 'PENDENTE_CONFERENCIA' | 'CONFERIDO'}
        temSucata={resumo.temSucata}
        pesoSucataReal={resumo.pesoSucataReal}
      />
```

Para:
```tsx
      <ConferenciaPainel
        movimentacaoId={mov.id}
        status={mov.status as 'PENDENTE_CONFERENCIA' | 'CONFERIDO'}
        temSucata={resumo.temSucata}
        pesoSucataReal={resumo.pesoSucataReal}
        pesoSucataEstimado={resumo.pesoSucataEstimado}
      />
```

(O outro call site, em `app/admin/(protegido)/remetidos/[id]/page.tsx`, passa `temSucata={false}` e não precisa de `pesoSucataEstimado` — o default `0` no componente cobre isso sem exigir alteração nesse arquivo.)

- [ ] **Step 4: Atualizar os e2e que checavam o texto antigo**

Em `tests/e2e/patio-recebimento.spec.ts`, trocar no teste `'SUCATA: classificação SC manual, peso nunca calculado, fica pendente'`:

De:
```ts
    await expect(page.getByText('PENDENTE').first()).toBeVisible();
    await expect(page.getByText('Peso até agora')).toBeVisible();
```

Para:
```ts
    // TR57 fator 0.057 x 8.10m = 0.4617 -> arredondado para 0.462t (estimativa, mesma fórmula do Reemprego).
    await expect(page.getByText('0.462 t').first()).toBeVisible();
    await expect(page.getByText('(estimado)')).toBeVisible();
    await expect(page.getByText('Peso até agora')).toBeVisible();
```

Em `tests/e2e/admin-recebimentos.spec.ts`, no teste `'abre o detalhe e mostra grupos, medições e "Peso até agora" (sucata pendente)'`, trocar:

De:
```ts
    // Grupo SUCATA
    await expect(page.getByText('TR57 — SUCATA')).toBeVisible();
    await expect(page.getByText('Peso pendente').first()).toBeVisible();
    await expect(page.getByText('SC1')).toBeVisible();

    // Resumo: NUNCA "Peso total" enquanto a sucata está pendente
    await expect(page.getByText('Peso até agora')).toBeVisible();
    await expect(page.getByText('Peso total')).toHaveCount(0);
    await expect(page.getByText('0.918 t')).toBeVisible(); // 0.102 + 0.816, sem a sucata
    await expect(page.getByText('SUCATA — Peso pendente')).toBeVisible();
```

Para:
```ts
    // Grupo SUCATA — TR57 fator 0.057 x 8.10m = 0.462t (estimativa, mesma fórmula do Reemprego).
    await expect(page.getByText('TR57 — SUCATA')).toBeVisible();
    await expect(page.getByText('0.462 t').first()).toBeVisible();
    await expect(page.getByText('(estimado, a confirmar)').first()).toBeVisible();
    await expect(page.getByText('SC1')).toBeVisible();

    // Resumo: NUNCA "Peso total" enquanto o peso REAL da sucata está pendente.
    await expect(page.getByText('Peso até agora')).toBeVisible();
    await expect(page.getByText('Peso total')).toHaveCount(0);
    await expect(page.getByText('0.918 t')).toBeVisible(); // 0.102 + 0.816, sem a sucata
    await expect(page.getByText(/SUCATA — peso estimado/)).toBeVisible();
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx playwright test tests/e2e/patio-recebimento.spec.ts tests/e2e/admin-recebimentos.spec.ts`
Expected: PASS (todos os testes dos dois arquivos).

- [ ] **Step 6: Commit**

```bash
git add app/patio/\(protegido\)/recebimentos/novo/RecebimentoWizard.tsx app/admin/\(protegido\)/recebimentos/\[id\]/page.tsx app/admin/\(protegido\)/recebimentos/\[id\]/ConferenciaPainel.tsx tests/e2e/patio-recebimento.spec.ts tests/e2e/admin-recebimentos.spec.ts
git commit -m "feat(recebimento): mostra peso estimado de Sucata no Pátio e no Admin, pré-preenche a Conferência"
```

---

## Task 5: Peso da NF opcional no Remetido — validação e serviço

**Files:**
- Modify: `lib/validation/remetido.ts`
- Modify: `lib/services/remetido.ts`
- Modify: `tests/unit/validation-remetido.test.ts`

**Interfaces:**
- Produces: `grupoRemetidoBaseSchema.pesoInformado` passa a ser `number | undefined`. `criarGruposEMedicoes` grava `pesoCalculado` (estimativa) quando `pesoInformado` não vier. `resumoPesoRemetido` cai para a estimativa quando não há peso informado.

- [ ] **Step 1: Atualizar os dois testes que hoje exigem `pesoInformado` (vão virar aceitação, não rejeição)**

Em `tests/unit/validation-remetido.test.ts`, localizar o teste genérico "rejeita grupo sem pesoInformado" (perto da linha 100-118) e trocar por:

```ts
    it('aceita grupo sem pesoInformado — campo passa a ser opcional (o Pátio normalmente não sabe o peso da NF)', () => {
      const { pesoInformado, ...resto } = grupoNovoValido();
      const resultado = grupoRemetidoSchema.safeParse(resto);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.pesoInformado).toBeUndefined();
      }
    });
```

(Ajustar o nome da função/variável de fixture conforme o helper já usado nos outros testes deste `describe` — ex.: se o helper local se chama `grupoValido()` em vez de `grupoNovoValido()`, use o nome que já existe no arquivo.)

Localizar o teste "rejeita grupo SUCATA sem pesoInformado" (perto da linha 211-223) e trocar por:

```ts
    it('aceita grupo SUCATA sem pesoInformado — mesma regra: o campo é opcional para todo tipo de material', () => {
      const { pesoInformado, ...resto } = grupoSucataValido();
      const resultado = grupoRemetidoSchema.safeParse(resto);
      expect(resultado.success).toBe(true);
    });
```

Manter inalterado o teste "rejeita pesoInformado zero ou negativo" (continua válido: opcional não é a mesma coisa que aceitar qualquer valor quando presente).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/validation-remetido.test.ts`
Expected: FAIL nos dois testes trocados (o schema ainda exige `pesoInformado`).

- [ ] **Step 3: Implementar — schema**

Em `lib/validation/remetido.ts`, trocar:

De:
```ts
const pesoInformadoSchema = z.number().positive('Informe o peso da nota fiscal, maior que zero.');

const grupoRemetidoBaseSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  pesoInformado: pesoInformadoSchema,
  medicoes: z.array(medicaoRemetidoSchema).min(1, 'Adicione ao menos uma medição.'),
});
```

Para:
```ts
// Opcional: o Pátio normalmente não sabe o peso da NF (ler/digitar peso de nota
// fiscal é função do Administrativo/faturamento, não do Pátio). Quando ausente,
// um peso provisório é calculado por metros x fator do perfil (mesma fórmula do
// Reemprego) e sinalizado "a confirmar" até o Administrativo completar com o
// peso real da nota, na conferência — ver lib/services/remetido.ts.
const pesoInformadoSchema = z.number().positive('Informe o peso da nota fiscal, maior que zero.').optional();

const grupoRemetidoBaseSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  pesoInformado: pesoInformadoSchema,
  medicoes: z.array(medicaoRemetidoSchema).min(1, 'Adicione ao menos uma medição.'),
});
```

- [ ] **Step 4: Implementar — serviço calcula a estimativa quando ausente**

Em `lib/services/remetido.ts`, trocar o import e a função `criarGruposEMedicoes`:

De:
```ts
import { calcularMetros } from '@/lib/services/calculo';
```

Para:
```ts
import { calcularMetros, calcularPeso } from '@/lib/services/calculo';
```

De:
```ts
async function criarGruposEMedicoes(
  tx: Prisma.TransactionClient,
  movimentacaoId: string,
  grupos: GrupoRemetidoInput[],
): Promise<void> {
  for (const grupo of grupos) {
    const metrosPorMedicao = grupo.medicoes.map((m) => calcularMetros(m.quantidade, m.comprimento));
    const metrosTotal = metrosPorMedicao.reduce((a, b) => a + b, 0);

    const grupoCriado = await tx.grupo.create({
      data: {
        clientId: grupo.clientId,
        movimentacaoId,
        perfil: grupo.perfil,
        tipoMaterial: grupo.tipoMaterial,
        classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
        tampao: grupo.tipoMaterial === 'REEMPREGO' ? Boolean(grupo.tampao) : false,
        fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
        metrosTotal,
        pesoCalculado: null,
        pesoInformado: grupo.pesoInformado,
      },
    });
```

Para:
```ts
async function criarGruposEMedicoes(
  tx: Prisma.TransactionClient,
  movimentacaoId: string,
  grupos: GrupoRemetidoInput[],
): Promise<void> {
  for (const grupo of grupos) {
    const metrosPorMedicao = grupo.medicoes.map((m) => calcularMetros(m.quantidade, m.comprimento));
    const metrosTotal = metrosPorMedicao.reduce((a, b) => a + b, 0);
    // Sem peso da NF informado pelo Pátio: estimativa provisória, mesma fórmula
    // do Reemprego (metros x fator do perfil) — sinalizada "a confirmar" na
    // Conferência enquanto pesoInformado continuar nulo.
    const pesoCalculado = grupo.pesoInformado == null ? await calcularPeso(metrosTotal, grupo.perfil) : null;

    const grupoCriado = await tx.grupo.create({
      data: {
        clientId: grupo.clientId,
        movimentacaoId,
        perfil: grupo.perfil,
        tipoMaterial: grupo.tipoMaterial,
        classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
        tampao: grupo.tipoMaterial === 'REEMPREGO' ? Boolean(grupo.tampao) : false,
        fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
        metrosTotal,
        pesoCalculado,
        pesoInformado: grupo.pesoInformado ?? null,
      },
    });
```

E trocar `resumoPesoRemetido` para cair na estimativa quando não há peso informado:

De:
```ts
/** Soma simples do pesoInformado de cada grupo — Remetido nunca calcula por fator nem tem peso pendente. */
export function resumoPesoRemetido(movimentacao: MovimentacaoRemetidoComGrupos): number {
  return arredondar3(movimentacao.grupos.reduce((acc, g) => acc + Number(g.pesoInformado ?? 0), 0));
}
```

Por:
```ts
/** Soma o pesoInformado de cada grupo; sem peso informado, cai na estimativa (pesoCalculado) — "a confirmar". */
export function resumoPesoRemetido(movimentacao: MovimentacaoRemetidoComGrupos): number {
  return arredondar3(
    movimentacao.grupos.reduce((acc, g) => acc + Number(g.pesoInformado ?? g.pesoCalculado ?? 0), 0),
  );
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/validation-remetido.test.ts`
Expected: PASS (todos).

Run: `npx vitest run tests/integration/remetido.test.ts`
Expected: PASS. Se algum teste pré-existente afirmar `pesoInformado` sempre presente/obrigatório de um jeito que agora conflita (por exemplo, um teste que monta um grupo SEM `pesoInformado` esperando falha de schema), ajuste esse teste para a nova regra (opcional) seguindo o mesmo padrão do Step 1 — a regra de negócio nova é: ausência de peso é válida e produz uma estimativa, nunca um erro.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/remetido.ts lib/services/remetido.ts tests/unit/validation-remetido.test.ts
git commit -m "feat(remetido): peso da NF passa a ser opcional, com estimativa automática quando ausente"
```

---

## Task 6: Peso da NF opcional — UI do Pátio (RemetidoWizard)

**Files:**
- Modify: `app/patio/(protegido)/remetidos/RemetidoWizard.tsx`

**Interfaces:**
- Consumes: `lancamentoDiretoRemetidoSchema`/`confirmacaoRemetidoSchema` com `pesoInformado` opcional (Task 5).

- [ ] **Step 1: Grupo sem peso informado deixa de ser "incompleto"**

Trocar:

De:
```tsx
  const grupoIncompleto = (g: GrupoLocal) =>
    g.medicoes.length === 0 ||
    !g.pesoInformado ||
    (g.tipoMaterial === 'REEMPREGO' && !g.classificacao) ||
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());
```

Para:
```tsx
  const grupoIncompleto = (g: GrupoLocal) =>
    g.medicoes.length === 0 ||
    (g.tipoMaterial === 'REEMPREGO' && !g.classificacao) ||
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());
```

- [ ] **Step 2: Enviar `undefined` (não `0`) quando o campo ficou em branco**

Trocar:

De:
```tsx
    const gruposPayload = grupos.map((g) => ({
      clientId: g.clientId,
      perfil: g.perfil,
      tipoMaterial: g.tipoMaterial,
      pesoInformado: Number(g.pesoInformado.replace(',', '.')),
```

Para:
```tsx
    const gruposPayload = grupos.map((g) => ({
      clientId: g.clientId,
      perfil: g.perfil,
      tipoMaterial: g.tipoMaterial,
      pesoInformado: g.pesoInformado.trim() ? Number(g.pesoInformado.replace(',', '.')) : undefined,
```

- [ ] **Step 3: Rótulo do campo deixa claro que é opcional**

Trocar:

De:
```tsx
            <div className="mt-2">
              <label className="block text-sm font-medium">Peso da NF (t) — para este grupo</label>
              <input
                inputMode="decimal"
                placeholder="Ex.: 12,500"
                className="mt-1 h-10 w-full rounded border px-2"
                value={g.pesoInformado}
                onChange={(e) => atualizarGrupo(g.clientId, { pesoInformado: e.target.value })}
              />
            </div>
```

Para:
```tsx
            <div className="mt-2">
              <label className="block text-sm font-medium">Peso da NF (t) — opcional, deixe em branco se não souber</label>
              <input
                inputMode="decimal"
                placeholder="Ex.: 12,500 (ou deixe em branco)"
                className="mt-1 h-10 w-full rounded border px-2"
                value={g.pesoInformado}
                onChange={(e) => atualizarGrupo(g.clientId, { pesoInformado: e.target.value })}
              />
            </div>
```

E o rótulo do total ao final da tela (que hoje presume que todo peso vem da NF):

De:
```tsx
      <section className="rounded-lg border bg-white p-3">
        <p className="text-sm text-neutral-500">PESO TOTAL (soma das NFs dos grupos)</p>
        <p className="text-2xl font-semibold">{pesoTotal.toFixed(3)} t</p>
      </section>
```

Para:
```tsx
      <section className="rounded-lg border bg-white p-3">
        <p className="text-sm text-neutral-500">PESO TOTAL (soma do que foi informado; sem peso da NF, usa uma estimativa a confirmar)</p>
        <p className="text-2xl font-semibold">{pesoTotal.toFixed(3)} t</p>
      </section>
```

(O cálculo de `pesoTotal` client-side — soma de `g.pesoInformado` convertido — continua só informativo nesta tela; não precisa somar a estimativa aqui, porque o Pátio não tem o fator do perfil carregado neste wizard. O número oficial, com a estimativa, aparece para o Admin via `resumoPesoRemetido` — Task 5.)

- [ ] **Step 4: Testar manualmente o fluxo (não há teste unitário dedicado ao RemetidoWizard hoje — ver Task 9 para e2e)**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/patio/\(protegido\)/remetidos/RemetidoWizard.tsx
git commit -m "feat(patio): peso da NF do Remetido fica opcional na tela de lançamento"
```

---

## Task 7: Conferência do Remetido não pode travar pelo gate de Sucata do Recebimento

**Files:**
- Modify: `lib/services/conferencia.ts`
- Modify: `tests/integration/conferencia.test.ts`

**Interfaces:**
- **Por que esta task existe:** `conferirRecebimento` é reaproveitado tanto para Recebimento quanto para Remetido (ver `ConferenciaPainel` usado nas duas telas de detalhe). O gate `sucataSemPeso` lê `Grupo.pesoInformado` — que até a Task 5 era SEMPRE preenchido no Remetido (nunca acionava o gate). Agora que ficou opcional, um Remetido com grupo SUCATA sem peso informado acionaria esse gate por engano e bloquearia a conferência de um Remetido — regressão direta da Task 5 que precisa ser evitada aqui.

- [ ] **Step 1: Escrever o teste (falhando)**

Em `tests/integration/conferencia.test.ts`, acrescentar (dentro do `describe` existente, usando os helpers de fixture já presentes no arquivo — ajustar nomes de import conforme o que já existe):

```ts
  it('conferirRecebimento NÃO bloqueia um REMETIDO com grupo SUCATA sem pesoInformado (regra de sucata pendente é só do Recebimento)', async () => {
    const remetido = await prisma.movimentacao.create({
      data: {
        clientId: uuid(),
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        tipoTransporte: 'CAMINHAO',
        status: 'PENDENTE_CONFERENCIA',
        destino: 'Teste',
        reservaPedido: 'RES-TESTE',
        remetidoDetalhe: { create: { tipoRemetido: 'VENDA' } },
        grupos: {
          create: [
            {
              clientId: uuid(),
              perfil: 'TR57',
              tipoMaterial: 'SUCATA',
              metrosTotal: 8.1,
              pesoCalculado: 0.462,
              pesoInformado: null,
            },
          ],
        },
      },
    });

    await conferirRecebimento(remetido.id, { userId: 'u1', nome: 'Admin Teste' });

    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: remetido.id } });
    expect(atualizado.status).toBe('CONFERIDO');
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/integration/conferencia.test.ts -t "NÃO bloqueia um REMETIDO"`
Expected: FAIL — lança `ConferenciaError('O peso da sucata está pendente...')`.

- [ ] **Step 3: Implementar — escopar o gate ao Recebimento**

Em `lib/services/conferencia.ts`, trocar:

De:
```ts
export async function conferirRecebimento(movimentacaoId: string, usuario: UsuarioAdmin): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { grupos: { select: { tipoMaterial: true, pesoInformado: true } } },
  });
  if (!mov) throw new ConferenciaError('Recebimento não encontrado.');
  if (mov.status !== 'PENDENTE_CONFERENCIA') {
    throw new ConferenciaError('Este recebimento não está pendente de conferência.');
  }

  // No Recebimento, sucata nunca tem pesoInformado — o peso real só existe depois,
  // em Movimentacao.pesoSucataReal. No Remetido, sucata já chega com pesoInformado
  // (vem da própria NF de saída), então não há nada "pendente" a aguardar aqui.
  const sucataSemPeso = mov.grupos.some((g) => g.tipoMaterial === 'SUCATA' && g.pesoInformado == null);
  if (sucataSemPeso && mov.pesoSucataReal == null) {
    throw new ConferenciaError('O peso da sucata está pendente. Informe o peso real antes de conferir.');
  }
```

Para:
```ts
export async function conferirRecebimento(movimentacaoId: string, usuario: UsuarioAdmin): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { grupos: { select: { tipoMaterial: true } } },
  });
  if (!mov) throw new ConferenciaError('Recebimento não encontrado.');
  if (mov.status !== 'PENDENTE_CONFERENCIA') {
    throw new ConferenciaError('Este recebimento não está pendente de conferência.');
  }

  // Este gate é EXCLUSIVO do Recebimento: só lá o peso real da sucata vive à
  // parte, em Movimentacao.pesoSucataReal (pendente até o Admin pesar e informar).
  // No Remetido, o peso de cada grupo (informado ou estimado) já fica resolvido
  // no próprio Grupo desde a criação (Tasks 5-6) — nunca bloqueia a conferência.
  const temSucata = mov.tipo === 'RECEBIMENTO' && mov.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  if (temSucata && mov.pesoSucataReal == null) {
    throw new ConferenciaError('O peso da sucata está pendente. Informe o peso real antes de conferir.');
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/integration/conferencia.test.ts`
Expected: PASS (todos, incluindo os testes pré-existentes do Recebimento — o comportamento para `tipo === 'RECEBIMENTO'` não muda, só passou a ser explícito).

- [ ] **Step 5: Commit**

```bash
git add lib/services/conferencia.ts tests/integration/conferencia.test.ts
git commit -m "fix(conferencia): gate de peso de sucata pendente é exclusivo do Recebimento"
```

---

## Task 8: Admin — confirmar/corrigir peso de grupo do Remetido sem peso informado

**Files:**
- Modify: `lib/services/remetido.ts`
- Modify: `app/admin/(protegido)/remetidos/[id]/actions.ts`
- Create: `app/admin/(protegido)/remetidos/[id]/PesoGrupoPainel.tsx`
- Modify: `app/admin/(protegido)/remetidos/[id]/page.tsx`
- Test: `tests/integration/remetido-peso-grupo.test.ts`

**Interfaces:**
- Produces: `informarPesoGrupoRemetido(grupoId: string, peso: number, usuario: UsuarioAdmin): Promise<void>`, `informarPesoGrupoAction(grupoId: string, peso: number): Promise<AcaoResultado>`, `PesoGrupoPainel({ grupoId, pesoEstimado, label }: { grupoId: string; pesoEstimado: number; label: string })`.

- [ ] **Step 1: Escrever o teste do serviço (falhando)**

```ts
// tests/integration/remetido-peso-grupo.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID as uuid } from 'crypto';
import { prisma } from '@/lib/db';
import { informarPesoGrupoRemetido } from '@/lib/services/remetido';

describe('informarPesoGrupoRemetido', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('preenche pesoInformado de um grupo do Remetido e registra no histórico', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: uuid(),
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        tipoTransporte: 'CAMINHAO',
        status: 'PENDENTE_CONFERENCIA',
        destino: 'Teste',
        reservaPedido: 'RES-TESTE-PESO',
        remetidoDetalhe: { create: { tipoRemetido: 'VENDA' } },
        grupos: {
          create: [{ clientId: uuid(), perfil: 'TR57', tipoMaterial: 'SUCATA', metrosTotal: 8.1, pesoCalculado: 0.462, pesoInformado: null }],
        },
      },
      include: { grupos: true },
    });

    await informarPesoGrupoRemetido(mov.grupos[0].id, 1.5, { userId: 'u1', nome: 'Admin Teste' });

    const grupo = await prisma.grupo.findUniqueOrThrow({ where: { id: mov.grupos[0].id } });
    expect(Number(grupo.pesoInformado)).toBe(1.5);

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'PESO_NF_INFORMADO' } });
    expect(historico).toHaveLength(1);
    expect(historico[0].valorNovo).toBe('1.5');
  });

  it('corrigir o peso de um Remetido já CONFERIDO reabre para PENDENTE_CONFERENCIA', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: uuid(),
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        tipoTransporte: 'CAMINHAO',
        status: 'CONFERIDO',
        destino: 'Teste',
        reservaPedido: 'RES-TESTE-PESO-2',
        remetidoDetalhe: { create: { tipoRemetido: 'VENDA' } },
        grupos: { create: [{ clientId: uuid(), perfil: 'TR57', tipoMaterial: 'SUCATA', metrosTotal: 8.1, pesoCalculado: 0.462, pesoInformado: 0.462 }] },
      },
      include: { grupos: true },
    });

    await informarPesoGrupoRemetido(mov.grupos[0].id, 1.8, { userId: 'u1', nome: 'Admin Teste' });

    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/integration/remetido-peso-grupo.test.ts`
Expected: FAIL — `informarPesoGrupoRemetido` não existe.

- [ ] **Step 3: Implementar o serviço**

Em `lib/services/remetido.ts`, acrescentar ao final do arquivo:

```ts
/**
 * Completa/corrige o peso da NF de um grupo específico do Remetido, quando o
 * Pátio lançou sem saber o peso (campo opcional — ver Tasks 5-6). Mesma regra de
 * reabertura usada para NF e peso de sucata do Recebimento: corrigir um dado
 * depois de CONFERIDO sempre reabre a conferência.
 */
export async function informarPesoGrupoRemetido(
  grupoId: string,
  peso: number,
  usuario: UsuarioAdmin,
): Promise<void> {
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    include: { movimentacao: true },
  });
  if (!grupo || grupo.movimentacao.tipo !== 'REMETIDO') {
    throw new ErroRegraNegocio('Grupo de remetido não encontrado.');
  }

  const valorAnterior = grupo.pesoInformado != null ? Number(grupo.pesoInformado) : null;
  const reabrindo = grupo.movimentacao.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.grupo.update({ where: { id: grupoId }, data: { pesoInformado: peso } });

    if (reabrindo) {
      await tx.movimentacao.update({
        where: { id: grupo.movimentacaoId },
        data: { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null },
      });
    }

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId: grupo.movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'PESO_NF_INFORMADO',
        campo: 'pesoInformado',
        valorAntigo: valorAnterior != null ? String(valorAnterior) : null,
        valorNovo: String(peso),
      },
    });

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId: grupo.movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/integration/remetido-peso-grupo.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Action do servidor**

Em `app/admin/(protegido)/remetidos/[id]/actions.ts`, trocar:

De:
```ts
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { informarNumeroDocumentoRemetido } from '@/lib/services/remetido';
import { ErroRegraNegocio } from '@/lib/services/errors';
```

Para:
```ts
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { informarNumeroDocumentoRemetido, informarPesoGrupoRemetido } from '@/lib/services/remetido';
import { ErroRegraNegocio } from '@/lib/services/errors';
```

E acrescentar, ao final do arquivo:
```ts

export async function informarPesoGrupoAction(grupoId: string, peso: number): Promise<AcaoResultado> {
  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: false, erro: 'Informe um peso válido, maior que zero.' };
  }

  const usuario = await usuarioAtual();
  try {
    await informarPesoGrupoRemetido(grupoId, peso, usuario);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof ErroRegraNegocio ? erro.message : 'Não foi possível salvar o peso.';
    return { ok: false, erro: mensagem };
  }
}
```

- [ ] **Step 6: Componente `PesoGrupoPainel`**

```tsx
// app/admin/(protegido)/remetidos/[id]/PesoGrupoPainel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { informarPesoGrupoAction } from './actions';

export function PesoGrupoPainel({ grupoId, pesoEstimado, label }: { grupoId: string; pesoEstimado: number; label: string }) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(pesoEstimado > 0 ? String(pesoEstimado).replace('.', ',') : '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    const valor = Number(pesoTexto.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um peso válido, maior que zero.');
      return;
    }
    setSalvando(true);
    const resultado = await informarPesoGrupoAction(grupoId, valor);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar o peso.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 rounded border p-2">
      <p className="text-xs font-medium text-amber-800">{label} — peso da NF a confirmar</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          className="h-9 w-28 rounded border px-2 text-sm"
          inputMode="decimal"
          value={pesoTexto}
          onChange={(e) => {
            setPesoTexto(e.target.value);
            setErro('');
          }}
        />
        <button
          className="h-9 rounded bg-steel px-3 text-sm text-white disabled:bg-neutral-300"
          disabled={salvando}
          onClick={salvar}
        >
          {salvando ? 'Salvando...' : 'Confirmar peso da NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Ligar na página de detalhe do Remetido**

Em `app/admin/(protegido)/remetidos/[id]/page.tsx`, trocar o import e a renderização dos grupos:

De:
```tsx
import { ConferenciaPainel } from '@/app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel';
import { NfPainel } from './NfPainel';
```

Para:
```tsx
import { ConferenciaPainel } from '@/app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel';
import { NfPainel } from './NfPainel';
import { PesoGrupoPainel } from './PesoGrupoPainel';
```

De:
```tsx
                  <span className="font-medium">{fmtPeso(Number(g.pesoInformado ?? 0))} t</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-lg font-semibold">TOTAL (da NF): {fmtPeso(pesoTotal)} t</p>
          </section>
```

Para:
```tsx
                  {g.pesoInformado != null ? (
                    <span className="font-medium">{fmtPeso(Number(g.pesoInformado))} t</span>
                  ) : (
                    <span className="font-medium text-amber-700">
                      {fmtPeso(Number(g.pesoCalculado ?? 0))} t <span className="text-xs">(estimado, a confirmar)</span>
                    </span>
                  )}
                </div>
              ))}
              {mov.grupos
                .map((g, i) => ({ g, i }))
                .filter(({ g }) => g.pesoInformado == null)
                .map(({ g, i }) => (
                  <PesoGrupoPainel
                    key={g.id}
                    grupoId={g.id}
                    pesoEstimado={Number(g.pesoCalculado ?? 0)}
                    label={`Grupo ${i + 1} — ${g.perfil} — ${g.tipoMaterial}`}
                  />
                ))}
            </div>
            <p className="mt-3 text-lg font-semibold">TOTAL (da NF): {fmtPeso(pesoTotal)} t</p>
            {mov.grupos.some((g) => g.pesoInformado == null) && (
              <p className="text-xs text-amber-700">Inclui peso estimado para grupos ainda não confirmados.</p>
            )}
          </section>
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npx vitest run tests/integration/remetido-peso-grupo.test.ts tests/integration/remetido.test.ts`
Expected: PASS (todos).

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add lib/services/remetido.ts app/admin/\(protegido\)/remetidos/\[id\]/actions.ts app/admin/\(protegido\)/remetidos/\[id\]/PesoGrupoPainel.tsx app/admin/\(protegido\)/remetidos/\[id\]/page.tsx tests/integration/remetido-peso-grupo.test.ts
git commit -m "feat(admin): confirmar/corrigir peso de grupo do Remetido sem peso informado"
```

---

## Task 9: Checkpoint — suíte completa do Bloco 1

**Files:** nenhum (checkpoint de verificação).

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run`
Expected: todos os testes passam, incluindo os novos/atualizados das Tasks 1-8. Nenhuma regressão nos demais arquivos (Bloco 1 não deveria afetar login, visual, etc.).

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx next build 2>&1 | tail -40`
Expected: `✓ Compiled successfully`.

Run: `npx playwright test`
Expected: todos os testes e2e passam, incluindo `patio-recebimento.spec.ts`, `admin-recebimentos.spec.ts` (Task 4) e qualquer e2e de Remetido existente (confirma que Tasks 5-8 não quebraram o fluxo de lançamento/confirmação).

Nenhum commit nesta task — é só verificação. Se algo falhar, voltar à task correspondente antes de reportar o Bloco 1 como concluído.
