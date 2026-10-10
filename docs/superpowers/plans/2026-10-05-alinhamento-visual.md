# Alinhamento Visual Admin + Pátio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a identidade visual exata dos protótipos (`prototipos/administrativo/`, `prototipos/patio/`) — cores, tipografia, Shell de navegação, componentes de botão/card/badge/input — às páginas Admin e Pátio que já existem hoje, sem redesenhar a arquitetura de informação de nenhuma tela.

**Architecture:** Dois conjuntos de tokens CSS exatos dos protótipos (`--admin-*`, `--patio-*`) expostos via `@theme inline` do Tailwind v4, mais uma camada semântica (`--primary`, `--ok`, `--warn`, `--bad`, `--line`, `--surface`, `--radius-card`...) que os componentes compartilhados (`components/ui/`) realmente consomem. `.area-patio` redefine a camada semântica por cascata de CSS — o mesmo `<Button variant="primary">` sai azul no Admin (default do `:root`) e aço no Pátio, sem duplicar componente. `AdminShell`/`PatioShell` envolvem as páginas protegidas de cada área.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (`@theme inline`, já em uso no projeto), `next/font/google` (já em uso para Geist), Vitest + Testing Library (já em uso), Playwright (já em uso).

**Spec:** `docs/superpowers/specs/2026-10-05-alinhamento-visual-design.md`

## Global Constraints

- Cores exatas dos protótipos — nunca aproximadas. Admin: `--navy:#0B1B31 --blue:#0F5FCC --blue-l:#E6EEFA --ok:#1E8449 --ok-l:#DCF2E3 --warn:#F0A020 --warn-l:#FDEBCB --bad:#C63B2E --bad-l:#FCE6E3 --line:#DFE5EC` (mais `--blue-d:#0A4BA6`, `--ok-d:#176B3B`, `--warn-d:#9A5300`, lidos diretamente de `prototipos/administrativo/style.css`, mais precisos que o resumo inicial). Pátio: `--gr:#1E262E --steel:#2F6690 --steel-d:#234E70 --steel-l:#E1ECF5 --mist:#EEF1F4 --ok:#1F8A5B --warn:#E39B1B --bad:#C4392D` (mais `--ok-d:#17683F`, `--warn-d:#7D5200`, `--line:#D5DCE3`, lidos de `prototipos/patio/controle-de-trilhos-patio.html`).
- Tipografia: Barlow (400/500/600/700) + Barlow Semi Condensed (500/600/700) via `next/font/google`, self-hosted — nunca carregar de `fonts.googleapis.com` em runtime.
- Escopo: só linguagem visual nas páginas que já existem. Não reconstruir painel de Conferência com abas, accordion de grupos, preview de exportação, Histórico, Configurações.
- Nenhum item de menu sem destino real. Sem dropdown de usuário/logout (não existe fluxo de logout implementado).
- `Button`/`Input`/`Select` preservam exatamente `name`, `id`, texto visível e `role` dos elementos que substituem — os seletores que os testes já usam hoje (`input[name="email"]`, `getByRole('button', {name:'Entrar'})`, `#f-data`, etc.) não podem quebrar.
- Suíte completa (`npx vitest run` + `npx playwright test`) tem que passar depois de cada fase, antes de prosseguir.
- Deploy só depois da verificação visual local completa (todas as rotas, uma por uma, contra o protótipo). Produção retestada por inteiro depois do deploy, nunca só as rotas que tinham bug conhecido.

---

## Fase 0 — Fundação

### Task 1: Tokens CSS (Admin + Pátio + camada semântica)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: classes utilitárias Tailwind `bg-admin-navy`, `bg-admin-blue`, `text-admin-blue-dark`, `bg-patio-gr`, `bg-patio-steel`, `bg-primary`, `text-primary-dark`, `bg-primary-light`, `bg-surface`, `border-line`, `text-ink`, `text-ink-muted`, `bg-ok-light`, `text-ok-dark`, `bg-warn-light`, `text-warn-dark`, `bg-bad-light`, `text-bad`, `rounded-card`, `shadow-card`, `font-condensed`. Classe `area-patio` (aplicada num elemento ancestral) redefine a camada semântica para a paleta do Pátio.

- [ ] **Step 1: Substituir o conteúdo de `app/globals.css`**

Conteúdo atual (a ser substituído por inteiro):

```css
@import "tailwindcss";

/* Design sempre claro, independente de prefers-color-scheme do dispositivo
   (decisão explícita — ver prototipos/). Um tablet de pátio ou celular com
   modo escuro do sistema não deve mudar a aparência do app. */
:root {
  color-scheme: light;
  --background: #ffffff;
  --foreground: #1e262e;

  /* Azul-aço da identidade visual (prototipos/patio/controle-de-trilhos-patio.html) */
  --steel: #2f6690;
  --steel-dark: #234e70;
  --steel-light: #e1ecf5;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-steel: var(--steel);
  --color-steel-dark: var(--steel-dark);
  --color-steel-light: var(--steel-light);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Novo conteúdo completo:

```css
@import "tailwindcss";

/* Design sempre claro, independente de prefers-color-scheme do dispositivo
   (decisão explícita — ver prototipos/). Um tablet de pátio ou celular com
   modo escuro do sistema não deve mudar a aparência do app. */
:root {
  color-scheme: light;
  --background: #ffffff;
  --foreground: #1e262e;

  /* Azul-aço (alias de --patio-steel, mesmo valor) — mantido por compatibilidade
     com páginas do Pátio que já usam bg-steel/text-steel-dark diretamente. */
  --steel: #2f6690;
  --steel-dark: #234e70;
  --steel-light: #e1ecf5;

  /* Admin — valores exatos de prototipos/administrativo/style.css */
  --admin-navy: #0b1b31;
  --admin-blue: #0f5fcc;
  --admin-blue-dark: #0a4ba6;
  --admin-blue-light: #e6eefa;
  --admin-ok: #1e8449;
  --admin-ok-light: #dcf2e3;
  --admin-ok-dark: #176b3b;
  --admin-warn: #f0a020;
  --admin-warn-light: #fdebcb;
  --admin-warn-dark: #9a5300;
  --admin-bad: #c63b2e;
  --admin-bad-light: #fce6e3;
  --admin-line: #dfe5ec;

  /* Pátio — valores exatos de prototipos/patio/controle-de-trilhos-patio.html */
  --patio-gr: #1e262e;
  --patio-steel: #2f6690;
  --patio-steel-dark: #234e70;
  --patio-steel-light: #e1ecf5;
  --patio-mist: #eef1f4;
  --patio-line: #d5dce3;
  --patio-ok: #1f8a5b;
  --patio-ok-light: #ddf1e6;
  --patio-ok-dark: #17683f;
  --patio-warn: #e39b1b;
  --patio-warn-light: #fbefd3;
  --patio-warn-dark: #7d5200;
  --patio-bad: #c4392d;
  --patio-bad-light: #fbe4e1;

  /* Semânticos — o que components/ui/* consome. Default = paleta Admin;
     .area-patio redefine abaixo por cascata (sem duplicar componente). */
  --primary: var(--admin-blue);
  --primary-dark: var(--admin-blue-dark);
  --primary-light: var(--admin-blue-light);
  --surface: #ffffff;
  --line: var(--admin-line);
  --ink: #14202e;
  --ink-muted: #5e6c7c;
  --ok: var(--admin-ok);
  --ok-light: var(--admin-ok-light);
  --ok-dark: var(--admin-ok-dark);
  --warn: var(--admin-warn);
  --warn-light: var(--admin-warn-light);
  --warn-dark: var(--admin-warn-dark);
  --bad: var(--admin-bad);
  --bad-light: var(--admin-bad-light);
  --card-radius: 8px;
  --card-shadow: 0 1px 2px rgba(15, 35, 65, .05), 0 4px 14px -6px rgba(15, 35, 65, .10);
}

/* Pátio redefine a camada semântica — qualquer componente de components/ui/
   usado dentro de um elemento com esta classe (PatioShell, /patio/acesso)
   sai com a paleta do Pátio automaticamente. */
.area-patio {
  --primary: var(--patio-steel);
  --primary-dark: var(--patio-steel-dark);
  --primary-light: var(--patio-steel-light);
  --surface: #ffffff;
  --line: var(--patio-line);
  --ink: #1e262e;
  --ink-muted: #5b6773;
  --ok: var(--patio-ok);
  --ok-light: var(--patio-ok-light);
  --ok-dark: var(--patio-ok-dark);
  --warn: var(--patio-warn);
  --warn-light: var(--patio-warn-light);
  --warn-dark: var(--patio-warn-dark);
  --bad: var(--patio-bad);
  --bad-light: var(--patio-bad-light);
  --card-radius: 12px;
  --card-shadow: none;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-steel: var(--steel);
  --color-steel-dark: var(--steel-dark);
  --color-steel-light: var(--steel-light);

  --color-admin-navy: var(--admin-navy);
  --color-admin-blue: var(--admin-blue);
  --color-admin-blue-dark: var(--admin-blue-dark);
  --color-admin-blue-light: var(--admin-blue-light);

  --color-patio-gr: var(--patio-gr);
  --color-patio-steel: var(--patio-steel);
  --color-patio-steel-dark: var(--patio-steel-dark);
  --color-patio-steel-light: var(--patio-steel-light);
  --color-patio-mist: var(--patio-mist);

  --color-primary: var(--primary);
  --color-primary-dark: var(--primary-dark);
  --color-primary-light: var(--primary-light);
  --color-surface: var(--surface);
  --color-line: var(--line);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ok: var(--ok);
  --color-ok-light: var(--ok-light);
  --color-ok-dark: var(--ok-dark);
  --color-warn: var(--warn);
  --color-warn-light: var(--warn-light);
  --color-warn-dark: var(--warn-dark);
  --color-bad: var(--bad);
  --color-bad-light: var(--bad-light);

  --radius-card: var(--card-radius);
  --shadow-card: var(--card-shadow);

  --font-sans: var(--font-barlow);
  --font-condensed: var(--font-barlow-condensed);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}

h1, h2, h3 {
  font-family: var(--font-condensed), var(--font-sans), Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 2: Rodar o build local e confirmar que o CSS gerado contém os novos tokens**

Run: `npx next build 2>&1 | tail -40`
Expected: `✓ Compiled successfully`, sem erros de TypeScript/CSS.

Run (ajuste o nome do arquivo .css gerado, que muda a cada build — liste `.next/static/chunks/*.css` primeiro):
```bash
find .next/static/chunks -name "*.css" | xargs grep -o "bg-admin-navy\|bg-primary\|font-condensed\|rounded-card\|shadow-card" | sort -u
```
Expected: as cinco classes aparecem na lista (confirma que o Tailwind gerou as utilities a partir dos namespaces `--color-*`/`--font-*`/`--radius-*`/`--shadow-*`). **Se `rounded-card` ou `shadow-card` não aparecerem** (o Tailwind v4 pode não gerar utility a partir de `--radius-*`/`--shadow-*` fora dos nomes padrão), o fallback é usar `rounded-[var(--radius-card)]` e `shadow-[var(--shadow-card)]` diretamente no componente `Card` (Task 4) — anote qual dos dois caminhos foi necessário.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): tokens exatos do Admin e do Pátio + camada semântica compartilhada"
```

---

### Task 2: Tipografia (Barlow + Barlow Semi Condensed)

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `--font-sans`/`--font-condensed` definidos em `app/globals.css` (Task 1), apontando para `--font-barlow`/`--font-barlow-condensed`.
- Produces: variáveis CSS `--font-barlow`, `--font-barlow-condensed` no elemento `<html>`.

- [ ] **Step 1: Substituir o carregamento de fontes em `app/layout.tsx`**

De:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Para:
```tsx
import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed, Geist_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

E, mais abaixo, troque a `className` do `<html>`:

De:
```tsx
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
```

Para:
```tsx
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
```

- [ ] **Step 2: Build local + verificação visual de fonte**

Run: `npx next build 2>&1 | tail -20`
Expected: build limpo.

Depois do build, rodar `npx next start -p 3911` e, num script Playwright simples (ou DevTools manual), conferir `getComputedStyle(document.body).fontFamily` numa página qualquer (ex.: `/`) — deve conter `Barlow`, não `Arial`/`Geist`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(ui): carrega Barlow + Barlow Semi Condensed (next/font/google), substitui Geist Sans"
```

---

### Task 3: Componente `Button`

**Files:**
- Create: `components/ui/Button.tsx`
- Test: `tests/unit/ui-button.test.tsx`

**Interfaces:**
- Consumes: tokens semânticos `--primary`/`--primary-dark`/`--primary-light`/`--line`/`--surface`/`--ink`/`--bad` (Task 1).
- Produces: `Button`, tipo `ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'`, tipo `ButtonSize = 'default' | 'sm'`. Props: `variant?`, `size?`, `fullWidth?`, `className?`, `href?` (string — quando presente, renderiza `next/link`), mais todos os atributos nativos de `<button>` quando `href` está ausente.

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/ui-button.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  afterEach(cleanup);

  it('renderiza um <button> com o texto e type informados quando não há href', () => {
    render(<Button type="submit">Entrar</Button>);
    const el = screen.getByRole('button', { name: 'Entrar' });
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveAttribute('type', 'submit');
  });

  it('renderiza um link (<a>) quando href é informado, preservando o texto visível', () => {
    render(<Button href="/admin/relatorios">Relatórios</Button>);
    const el = screen.getByRole('link', { name: 'Relatórios' });
    expect(el).toHaveAttribute('href', '/admin/relatorios');
  });

  it('repassa disabled para o <button>', () => {
    render(<Button disabled>Salvando...</Button>);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/ui-button.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Button'` (ou equivalente de import não resolvido).

- [ ] **Step 3: Implementar `Button`**

```tsx
// components/ui/Button.tsx
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'sm';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'border border-primary bg-surface text-primary-dark hover:bg-primary-light',
  ghost: 'border border-line bg-surface text-ink hover:bg-primary-light',
  danger: 'bg-bad text-white',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-12 px-4 text-base',
  sm: 'h-9 px-3 text-sm',
};

function buildClassName(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean | undefined, className: string | undefined): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'default', fullWidth, className, children } = props;
  const finalClassName = buildClassName(variant, size, fullWidth, className);

  if (props.href !== undefined) {
    const { href, variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, ...rest } = props;
    return (
      <Link href={href} className={finalClassName} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, href: _h, ...rest } = props;
  return (
    <button className={finalClassName} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/ui-button.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx tests/unit/ui-button.test.tsx
git commit -m "feat(ui): componente Button compartilhado (variant/size/fullWidth/href)"
```

---

### Task 4: Componente `Card`

**Files:**
- Create: `components/ui/Card.tsx`
- Test: `tests/unit/ui-card.test.tsx`

**Interfaces:**
- Consumes: `--line`/`--surface`/`--radius-card`/`--shadow-card` (Task 1).
- Produces: `Card`, props `{ children: ReactNode; className?: string; padded?: boolean }` (`padded` default `true`).

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/ui-card.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  afterEach(cleanup);

  it('renderiza os filhos dentro de um container com borda e fundo de superfície', () => {
    render(<Card>Conteúdo do card</Card>);
    expect(screen.getByText('Conteúdo do card')).toBeTruthy();
  });

  it('aceita className extra sem substituir as classes base', () => {
    render(<Card className="mt-4">X</Card>);
    const el = screen.getByText('X').parentElement;
    expect(el?.className).toContain('mt-4');
    expect(el?.className).toContain('border-line');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/ui-card.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `Card`**

```tsx
// components/ui/Card.tsx
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={[
        'rounded-card border border-line bg-surface shadow-card',
        padded ? 'p-4' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
```

Se o Step 2 da Task 1 tiver confirmado que `rounded-card`/`shadow-card` não são gerados pelo Tailwind, troque a primeira linha da classe por `'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]'`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/ui-card.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Card.tsx tests/unit/ui-card.test.tsx
git commit -m "feat(ui): componente Card compartilhado"
```

---

### Task 5: Componente `Badge`

**Files:**
- Create: `components/ui/Badge.tsx`
- Test: `tests/unit/ui-badge.test.tsx`

**Interfaces:**
- Consumes: `--primary-light`/`--primary-dark`/`--ok-light`/`--ok-dark`/`--warn-light`/`--warn-dark`/`--bad-light`/`--bad` (Task 1).
- Produces: `Badge`, tipo `BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad'`, props `{ tone: BadgeTone; children: ReactNode }`.

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/ui-badge.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  afterEach(cleanup);

  it('renderiza o texto passado', () => {
    render(<Badge tone="warn">Pendente de conferência</Badge>);
    expect(screen.getByText('Pendente de conferência')).toBeTruthy();
  });

  it('aplica a classe de cor correspondente a cada tone', () => {
    const { rerender } = render(<Badge tone="ok">Conferido</Badge>);
    expect(screen.getByText('Conferido').className).toContain('bg-ok-light');

    rerender(<Badge tone="bad">Erro</Badge>);
    expect(screen.getByText('Erro').className).toContain('bg-bad-light');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/ui-badge.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `Badge`**

```tsx
// components/ui/Badge.tsx
import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-200 text-neutral-800',
  info: 'bg-primary-light text-primary-dark',
  ok: 'bg-ok-light text-ok-dark',
  warn: 'bg-warn-light text-warn-dark',
  bad: 'bg-bad-light text-bad',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/ui-badge.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Badge.tsx tests/unit/ui-badge.test.tsx
git commit -m "feat(ui): componente Badge (status pill) compartilhado"
```

---

### Task 6: Componentes `Input`, `Select`, `Field`

**Files:**
- Create: `components/ui/Input.tsx`
- Test: `tests/unit/ui-field.test.tsx`

**Interfaces:**
- Consumes: `--line`/`--surface`/`--ink`/`--primary`/`--primary-light`/`--bad` (Task 1).
- Produces: `Input` (todos os `InputHTMLAttributes`), `Select` (todos os `SelectHTMLAttributes`), `Field` (`{ label: string; htmlFor: string; error?: string; children: ReactNode }`).

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/ui-field.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Field, Input } from '@/components/ui/Input';

describe('Field + Input', () => {
  afterEach(cleanup);

  it('associa o label ao input via htmlFor/id', () => {
    render(
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" />
      </Field>,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('name', 'email');
  });

  it('mostra a mensagem de erro com role="alert" quando error é informado', () => {
    render(
      <Field label="E-mail" htmlFor="email" error="E-mail obrigatório">
        <Input id="email" name="email" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail obrigatório');
  });

  it('não renderiza nenhum role="alert" quando não há erro', () => {
    render(
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" />
      </Field>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/ui-field.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `Input`, `Select`, `Field`**

```tsx
// components/ui/Input.tsx
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const CONTROL_CLASSES =
  'h-11 w-full rounded-md border border-line bg-surface px-3 text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary-light disabled:bg-neutral-100';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[CONTROL_CLASSES, className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[CONTROL_CLASSES, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/ui-field.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Input.tsx tests/unit/ui-field.test.tsx
git commit -m "feat(ui): componentes Input/Select/Field compartilhados"
```

---

### Task 7: `requireAdmin`/`validarSessao` passam a trazer o nome do admin

**Files:**
- Modify: `lib/services/auth.ts`
- Modify: `lib/services/requireAdmin.ts`
- Modify: `tests/integration/auth-session.test.ts`

**Interfaces:**
- Produces: `validarSessao(token): Promise<{ userId: string; nome: string } | null>`, `requireAdmin(): Promise<{ userId: string; nome: string }>`.
- **Nenhum outro call site precisa mudar** — todos os existentes fazem só `await requireAdmin();` e descartam o retorno; adicionar um campo ao objeto retornado não quebra nenhum deles.

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar ao teste existente `tests/integration/auth-session.test.ts` (não criar arquivo novo):

```ts
  it('validarSessao também devolve o nome do usuário', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Admin Com Nome', email: 'admin-nome-teste@example.com', senhaHash: 'x' },
    });

    const { token } = await criarSessao(user.id);
    const valida = await validarSessao(token);
    expect(valida?.nome).toBe('Admin Com Nome');

    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email: 'admin-nome-teste@example.com' } });
  });
```

(Inserir este bloco dentro do `describe('sessão administrativa', ...)` existente, logo após o teste `'cria, valida e revoga uma sessão'`.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/integration/auth-session.test.ts`
Expected: FAIL — `valida?.nome` é `undefined`, não `'Admin Com Nome'`.

- [ ] **Step 3: Implementar — `validarSessao` passa a incluir o usuário**

Em `lib/services/auth.ts`, trocar:

```ts
export async function validarSessao(token: string): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}
```

Por:

```ts
export async function validarSessao(token: string): Promise<{ userId: string; nome: string } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { nome: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return { userId: session.userId, nome: session.user.nome };
}
```

Em `lib/services/requireAdmin.ts`, trocar:

```ts
export async function requireAdmin(): Promise<{ userId: string }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/admin/login');
  return sessao;
}
```

Por:

```ts
export async function requireAdmin(): Promise<{ userId: string; nome: string }> {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) redirect('/admin/login');
  return sessao;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/integration/auth-session.test.ts`
Expected: PASS (2 testes).

Run também: `npx tsc --noEmit` (confirma que nenhum call site existente de `requireAdmin()`/`validarSessao()` quebrou com o tipo de retorno maior).
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/services/auth.ts lib/services/requireAdmin.ts tests/integration/auth-session.test.ts
git commit -m "feat(admin): validarSessao/requireAdmin passam a trazer o nome do admin logado"
```

---

### Task 8: `AdminShell`

**Files:**
- Create: `components/admin/AdminShell.tsx`
- Test: `tests/unit/admin-shell.test.tsx`

**Interfaces:**
- Consumes: `--admin-navy`/`--primary` (Task 1).
- Produces: `AdminShell`, props `{ nome: string; children: ReactNode }`.

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/admin-shell.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AdminShell } from '@/components/admin/AdminShell';

describe('AdminShell', () => {
  afterEach(cleanup);

  it('renderiza só os dois destinos reais do menu (Pendências e Relatórios)', () => {
    render(<AdminShell nome="Fulano de Tal">conteúdo</AdminShell>);
    expect(screen.getByRole('link', { name: 'Pendências' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/admin/relatorios');
    // Itens do protótipo sem página real — nunca devem aparecer como link.
    expect(screen.queryByRole('link', { name: 'Conferência' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Histórico' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Configurações' })).toBeNull();
  });

  it('mostra o nome do admin logado e renderiza os filhos', () => {
    render(<AdminShell nome="Fulano de Tal">área de conteúdo</AdminShell>);
    expect(screen.getByText('Fulano de Tal')).toBeTruthy();
    expect(screen.getByText('área de conteúdo')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/admin-shell.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `AdminShell`**

```tsx
// components/admin/AdminShell.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Pendências' },
  { href: '/admin/relatorios', label: 'Relatórios' },
] as const;

function iniciaisDe(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminShell({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="area-admin flex min-h-screen bg-neutral-100">
      <aside className="flex w-60 flex-none flex-col bg-admin-navy px-2 py-6 text-white">
        <div className="px-3 font-condensed leading-none">
          <p className="text-lg font-semibold">CONTROLE</p>
          <p className="text-2xl font-bold">DE TRILHOS</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-4 py-3 text-base text-neutral-200 hover:bg-white/10">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-none items-center justify-end bg-admin-navy px-6 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold">
              {iniciaisDe(nome) || '?'}
            </span>
            <span className="text-sm font-semibold">{nome}</span>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/admin-shell.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add components/admin/AdminShell.tsx tests/unit/admin-shell.test.tsx
git commit -m "feat(admin): componente AdminShell (sidebar navy + topbar com usuário logado)"
```

---

### Task 9: `PatioShell`

**Files:**
- Create: `components/patio/PatioShell.tsx`
- Test: `tests/unit/patio-shell.test.tsx`

**Interfaces:**
- Consumes: `--patio-gr` (Task 1), `IndicadorSincronizacao` (`components/IndicadorSincronizacao.tsx`, já existe — lógica intocada).
- Produces: `PatioShell`, props `{ children: ReactNode }`.

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// tests/unit/patio-shell.test.tsx
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PatioShell } from '@/components/patio/PatioShell';

vi.mock('@/lib/offline/sync', () => ({
  sincronizarPendentes: vi.fn().mockResolvedValue(undefined),
}));

describe('PatioShell', () => {
  afterEach(cleanup);

  it('mostra a marca "Controle de Trilhos" e o badge "Pátio"', () => {
    render(<PatioShell>conteúdo</PatioShell>);
    expect(screen.getByText('Controle de Trilhos')).toBeTruthy();
    expect(screen.getByText('Pátio')).toBeTruthy();
  });

  it('renderiza o indicador de sincronização e os filhos', async () => {
    render(<PatioShell>área de conteúdo</PatioShell>);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('área de conteúdo')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/patio-shell.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `PatioShell`**

```tsx
// components/patio/PatioShell.tsx
import type { ReactNode } from 'react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio flex min-h-screen flex-col bg-patio-mist">
      <header className="flex h-14 flex-none items-center gap-3 border-b-4 border-patio-steel bg-patio-gr px-4 text-white">
        <span className="font-condensed text-lg font-bold">Controle de Trilhos</span>
        <span className="rounded-md border border-white/30 px-2 py-0.5 text-xs font-semibold text-patio-steel-light">
          Pátio
        </span>
      </header>
      <IndicadorSincronizacao />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/unit/patio-shell.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add components/patio/PatioShell.tsx tests/unit/patio-shell.test.tsx
git commit -m "feat(patio): componente PatioShell (barra escura + indicador de sincronização)"
```

---

### Task 10: Rodar a suíte completa antes de migrar páginas

**Files:** nenhum (checkpoint de verificação).

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run`
Expected: todos os testes existentes + os 8 novos (Button, Card, Badge, Field, AdminShell, PatioShell, auth-session) passam. Nenhuma regressão.

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx next build 2>&1 | tail -40`
Expected: build limpo.

Nenhum commit nesta task — é só um checkpoint. Se algo falhar, voltar à task correspondente antes de prosseguir para a Fase 1.

---

## Fase 1 — Migração do Admin

### Task 11: `app/admin/(protegido)/layout.tsx` usa `AdminShell`

**Files:**
- Modify: `app/admin/(protegido)/layout.tsx`

**Interfaces:**
- Consumes: `AdminShell` (Task 8), `requireAdmin()` agora devolvendo `{ userId, nome }` (Task 7).

- [ ] **Step 1: Envolver com `AdminShell`**

De:
```tsx
import { requireAdmin } from '@/lib/services/requireAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
```

Para:
```tsx
import { requireAdmin } from '@/lib/services/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await requireAdmin();
  return <AdminShell nome={nome}>{children}</AdminShell>;
}
```

- [ ] **Step 2: Verificar visualmente e checar regressão nos testes que dependem do admin**

Run: `npx next build 2>&1 | tail -30` — build limpo.

Run: `npx vitest run tests/integration/admin-page-authz.test.ts`
Expected: PASS (este arquivo testa que o Pátio não acessa `/admin` — o Shell não deve alterar esse comportamento, já que `requireAdmin()` continua redirecionando antes de renderizar).

Rodar `npx playwright test tests/e2e/admin-conferencia.spec.ts tests/e2e/admin-recebimentos.spec.ts` (local, com `npm run dev` — o `webServer` do `playwright.config.ts` sobe sozinho).
Expected: todos os testes desses dois arquivos continuam passando — eles navegam por `/admin/...` e dependem de `getByRole('button', ...)`/texto visível, que o Shell não deve alterar.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protegido)/layout.tsx"
git commit -m "feat(admin): layout protegido usa AdminShell"
```

---

### Task 12: Migrar `/admin/login`

**Files:**
- Modify: `app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input` (Tasks 3, 6). Classe `area-admin` já é o default do `:root` (Task 1) — não precisa de wrapper extra, mas a página recebe a classe explicitamente por clareza (não é filha de `AdminShell`, que é só para dentro de `(protegido)`).

- [ ] **Step 1: Substituir o JSX mantendo `name`/`id`/texto exatamente iguais**

De (arquivo atual inteiro):
```tsx
'use client';

import { useActionState } from 'react';
import { loginAction, type EstadoLogin } from './actions';

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Login do Administrativo</h1>
      <p className="mt-1 text-sm text-neutral-600">Entre com seu e-mail e senha para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 h-12 w-full rounded border px-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            className="mt-1 h-12 w-full rounded border px-3"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {estado.erro && (
          <p role="alert" className="text-sm text-red-700">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
```

Para:
```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { loginAction, type EstadoLogin } from './actions';

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <main className="area-admin mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">Login do Administrativo</h1>
      <p className="mt-1 text-sm text-ink-muted">Entre com seu e-mail e senha para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" required />
        </Field>

        <Field label="Senha" htmlFor="senha">
          <Input id="senha" name="senha" type="password" required />
        </Field>

        <Button type="submit" disabled={enviando} fullWidth>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Button>

        {estado.erro && (
          <p role="alert" className="text-sm text-bad">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Rodar a suíte de login e verificar visualmente**

Run: `npx vitest run tests/integration/login.test.ts`
Expected: PASS — este arquivo testa `loginAction` diretamente, não a página; não deve ser afetado, mas confirma que nada na cadeia quebrou.

Verificação visual: `npx next build && npx next start -p 3911`, abrir `http://localhost:3911/admin/login`, comparar com a paleta Admin (botão azul `#0F5FCC`, não mais o aço do Pátio). Usar o mesmo script Playwright de screenshot já usado nas rodadas anteriores desta sessão (`chromium.launch()` + `page.goto` + `page.screenshot`).

Confirmar manualmente com Playwright que o fluxo de erro (credenciais erradas) ainda mostra a mensagem — reaproveitar o script de verificação já escrito para esta página numa rodada anterior desta sessão (login errado → `page.getByRole('button').textContent()` volta a "Entrar" e `p[role="alert"]` mostra "E-mail ou senha inválidos.").

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat(admin): migra /admin/login para a paleta Admin e os componentes compartilhados"
```

---

### Task 13: Migrar `/admin` (pendências)

**Files:**
- Modify: `app/admin/(protegido)/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Badge` (Tasks 3, 4, 5).

- [ ] **Step 1: Substituir os botões do cabeçalho por `Button`, a tabela por dentro de um `Card`, e o status por `Badge`**

Trocar o bloco do cabeçalho:

De:
```tsx
        <div className="flex gap-2">
          <Link href="/admin/relatorios" className="rounded border border-steel px-3 py-2 text-sm font-medium text-steel-dark">
            Relatórios
          </Link>
          <Link href="/admin/remetidos/novo" className="rounded bg-steel px-3 py-2 text-sm font-medium text-white">
            + Novo remetido
          </Link>
        </div>
```

Para (remove o import de `Link`, que deixa de ser usado diretamente neste arquivo — ver Step seguinte):
```tsx
        <div className="flex gap-2">
          <Button href="/admin/relatorios" variant="secondary" size="sm">
            Relatórios
          </Button>
          <Button href="/admin/remetidos/novo" size="sm">
            + Novo remetido
          </Button>
        </div>
```

Trocar a célula de status (dentro do `.map` da primeira tabela):

De:
```tsx
                <td className="p-2">{m.status}</td>
```

Para:
```tsx
                <td className="p-2">
                  <Badge tone={m.status === 'CONFERIDO' ? 'ok' : m.status === 'PENDENTE_CONFERENCIA' ? 'warn' : 'neutral'}>
                    {m.status === 'CONFERIDO' ? 'Conferido' : m.status === 'PENDENTE_CONFERENCIA' ? 'Pendente de conferência' : 'Aguardando chegada'}
                  </Badge>
                </td>
```

Trocar o link de detalhe (duas ocorrências, na primeira e na segunda tabela):

De:
```tsx
                  <Link
                    href={m.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${m.id}` : `/admin/remetidos/${m.id}`}
                    className="text-blue-700 underline"
                  >
                    Ver detalhes
                  </Link>
```

Para:
```tsx
                  <Button href={m.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${m.id}` : `/admin/remetidos/${m.id}`} variant="ghost" size="sm">
                    Ver detalhes
                  </Button>
```

De:
```tsx
                    <Link href={`/admin/remetidos/${r.id}`} className="text-blue-700 underline">
                      Ver detalhes
                    </Link>
```

Para:
```tsx
                    <Button href={`/admin/remetidos/${r.id}`} variant="ghost" size="sm">
                      Ver detalhes
                    </Button>
```

Envolver as duas tabelas (hoje em `<div className="overflow-x-auto rounded border">`) com `Card` em vez da div com borda solta:

De (as duas ocorrências):
```tsx
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
```
e
```tsx
        <div className="mt-2 overflow-x-auto rounded border">
          <table className="w-full text-sm">
```

Para:
```tsx
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-sm">
```
e
```tsx
        <Card padded={false} className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
```

(Fechando com `</Card>` em vez de `</div>` nos respectivos pontos de fechamento — a estrutura de `<table>` continua idêntica.)

Atualizar o import no topo do arquivo:

De:
```tsx
import Link from 'next/link';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
```

Para:
```tsx
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
```

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/admin-recebimentos.spec.ts` (local) — confirma que "Ver detalhes"/"+ Novo remetido" continuam clicáveis com o texto esperado.

Visual: abrir `/admin` logado, comparar com o protótipo (cards com borda/sombra do Admin, badges de status com as cores certas).

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protegido)/page.tsx"
git commit -m "feat(admin): migra /admin (pendências) para Button/Card/Badge"
```

---

### Task 14: Migrar `/admin/relatorios`

**Files:**
- Modify: `app/admin/(protegido)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Badge`, `Field`, `Input`, `Select` (Tasks 3-6).

- [ ] **Step 1: Migrar o formulário de filtros**

Trocar cada bloco `<div><label>...</label><input .../></div>` do formulário de filtros pelo padrão `Field` + `Input`/`Select`. Exemplo (Período início — repetir o mesmo padrão para os demais 7 campos do formulário, mantendo `id`/`name`/`defaultValue`/`options` exatamente iguais):

De:
```tsx
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-inicio">Período (início)</label>
            <input id="f-inicio" type="date" name="dataInicio" defaultValue={filtros.dataInicio} className="mt-1 h-10 w-full rounded border px-2 text-sm" />
          </div>
```

Para:
```tsx
          <Field label="Período (início)" htmlFor="f-inicio">
            <Input id="f-inicio" type="date" name="dataInicio" defaultValue={filtros.dataInicio} />
          </Field>
```

Para os `<select>` (Tipo, Status, Perfil, Material), mesmo padrão trocando `<input>` por `<Select>` com as mesmas `<option>` internas. Exemplo (Tipo):

De:
```tsx
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''} className="mt-1 h-10 w-full rounded border px-2 text-sm">
              <option value="">Todos</option>
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="REMETIDO">Remetido</option>
            </select>
          </div>
```

Para:
```tsx
          <Field label="Tipo" htmlFor="f-tipo">
            <Select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''}>
              <option value="">Todos</option>
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="REMETIDO">Remetido</option>
            </Select>
          </Field>
```

Trocar os botões do formulário:

De:
```tsx
        <div className="mt-3 flex gap-2">
          <button type="submit" className="h-10 rounded bg-steel px-4 text-sm font-medium text-white">
            Filtrar
          </button>
          {temFiltro && (
            <Link href="/admin/relatorios" className="flex h-10 items-center rounded border px-4 text-sm font-medium text-neutral-700">
              Limpar filtros
            </Link>
          )}
        </div>
```

Para:
```tsx
        <div className="mt-3 flex gap-2">
          <Button type="submit" size="sm">
            Filtrar
          </Button>
          {temFiltro && (
            <Button href="/admin/relatorios" variant="ghost" size="sm">
              Limpar filtros
            </Button>
          )}
        </div>
```

Envolver o `<form>` inteiro com `Card` em vez de `className="rounded-lg border bg-white p-4"`:

De: `<form method="get" className="rounded-lg border bg-white p-4">`
Para: `<form method="get">` — e envolver esse `<form>` com `<Card><form ...>...</form></Card>` (o `Card` assume a borda/fundo/padding).

Trocar os 4 cards de resumo (Carregamentos/Peças/Metros/Toneladas):

De (um dos quatro, mesmo padrão para os outros três):
```tsx
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-neutral-500">Carregamentos</p>
          <p className="text-2xl font-semibold">{resumo.carregamentos}</p>
        </div>
```

Para:
```tsx
        <Card>
          <p className="text-xs text-ink-muted">Carregamentos</p>
          <p className="text-2xl font-semibold">{resumo.carregamentos}</p>
        </Card>
```

Em `STATUS_LABEL` e `LinhaTabela`, trocar o `<span>` de status por `Badge` (os tons seguem o status real):

De:
```tsx
const STATUS_LABEL: Record<string, { texto: string; className: string }> = {
  AGUARDANDO_CHEGADA: { texto: 'Aguardando chegada', className: 'bg-neutral-200 text-neutral-800' },
  PENDENTE_CONFERENCIA: { texto: 'Pendente de conferência', className: 'bg-amber-100 text-amber-800' },
  CONFERIDO: { texto: 'Conferido', className: 'bg-emerald-100 text-emerald-800' },
};

function LinhaTabela({ mov }: { mov: MovimentacaoRelatorio }) {
  const statusInfo = STATUS_LABEL[mov.status];
  return (
    <tr className="border-t">
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
      <td className="p-2">{fmtData(mov.dataMovimentacao)}</td>
      <td className="p-2">{mov.numeroDocumento ?? 'Em aberto'}</td>
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino}</td>
      <td className="p-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo?.className ?? 'bg-neutral-100'}`}>
          {statusInfo?.texto ?? mov.status}
        </span>
      </td>
      <td className="p-2 text-right">
        <Link href={detalheHref(mov)} className="text-blue-700 underline">
          Ver detalhes
        </Link>
      </td>
    </tr>
  );
}
```

Para:
```tsx
const STATUS_LABEL: Record<string, { texto: string; tone: 'neutral' | 'warn' | 'ok' }> = {
  AGUARDANDO_CHEGADA: { texto: 'Aguardando chegada', tone: 'neutral' },
  PENDENTE_CONFERENCIA: { texto: 'Pendente de conferência', tone: 'warn' },
  CONFERIDO: { texto: 'Conferido', tone: 'ok' },
};

function LinhaTabela({ mov }: { mov: MovimentacaoRelatorio }) {
  const statusInfo = STATUS_LABEL[mov.status];
  return (
    <tr className="border-t">
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
      <td className="p-2">{fmtData(mov.dataMovimentacao)}</td>
      <td className="p-2">{mov.numeroDocumento ?? 'Em aberto'}</td>
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino}</td>
      <td className="p-2">
        <Badge tone={statusInfo?.tone ?? 'neutral'}>{statusInfo?.texto ?? mov.status}</Badge>
      </td>
      <td className="p-2 text-right">
        <Button href={detalheHref(mov)} variant="ghost" size="sm">
          Ver detalhes
        </Button>
      </td>
    </tr>
  );
}
```

Trocar o contêiner de tabela em `TabelaPendencia` e na seção "Movimentações" (duas ocorrências de `<div className="mt-1 overflow-x-auto rounded border">`/`<div className="overflow-x-auto rounded border bg-white">`) por `Card padded={false}`, mesmo padrão da Task 13.

Trocar o botão "Exportar Excel":

De:
```tsx
          <a
            href={`/api/relatorios/exportar${queryString ? `?${queryString}` : ''}`}
            className="rounded border border-steel px-3 py-1.5 text-sm font-medium text-steel-dark"
          >
            Exportar Excel
          </a>
```

Para:
```tsx
          <Button href={`/api/relatorios/exportar${queryString ? `?${queryString}` : ''}`} variant="secondary" size="sm">
            Exportar Excel
          </Button>
```

Envolver a seção "Pendências" (`<section className="space-y-4 rounded-lg border bg-white p-4">`) com `Card` em vez da classe solta.

Atualizar o import no topo:

De:
```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
```

Para:
```tsx
import { requireAdmin } from '@/lib/services/requireAdmin';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Input';
```

(`Link` deixa de ser usado neste arquivo depois da migração — remover o import evita erro de lint `no-unused-vars`.)

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx vitest run tests/unit/relatorio.test.ts` — este arquivo testa o serviço, não a página, mas confirma que nada na cadeia de dados quebrou.

Rodar manualmente (ou via Playwright) o fluxo de filtro em `/admin/relatorios`: preencher Tipo=Recebimento, clicar Filtrar, confirmar que a URL reflete `?tipo=RECEBIMENTO` e a tabela filtra — o `name` de cada campo não pode ter mudado, senão o `method="get"` do form para de funcionar.

Visual: comparar cards de resumo, badges de status e botão "Exportar Excel" com o protótipo (cores Admin exatas).

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protegido)/relatorios/page.tsx"
git commit -m "feat(admin): migra /admin/relatorios para Button/Card/Badge/Field"
```

---

### Task 15: Migrar `/admin/recebimentos/[id]` + `ConferenciaPainel` + `DocumentoPesagemPainel`

**Files:**
- Modify: `app/admin/(protegido)/recebimentos/[id]/page.tsx`
- Modify: `app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel.tsx`
- Modify: `app/admin/(protegido)/recebimentos/[id]/DocumentoPesagemPainel.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Badge`, `Field`, `Input` (Tasks 3-6).

- [ ] **Step 1: `page.tsx` — envolver as 7 `<section className="rounded-lg border bg-white p-4">` com `Card`, trocar os dois badges de status do topo**

Cada uma das 7 ocorrências de `<section className="rounded-lg border bg-white p-4">...</section>` vira `<Card><h2 className="font-semibold text-ink">...</h2>...</Card>` (`Card` renderiza uma `<div>`, não um `<section>` — aceitável, nenhum teste depende da tag `section` aqui; o conteúdo interno de cada bloco não muda).

Trocar o badge de status do cabeçalho:

De:
```tsx
          {mov.status === 'CONFERIDO' ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">CONFERIDO</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              PENDENTE DE CONFERÊNCIA
            </span>
          )}
```

Para:
```tsx
          <Badge tone={mov.status === 'CONFERIDO' ? 'ok' : 'warn'}>
            {mov.status === 'CONFERIDO' ? 'CONFERIDO' : 'PENDENTE DE CONFERÊNCIA'}
          </Badge>
```

Trocar o badge "Peso pendente" (seção de materiais):

De:
```tsx
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Peso pendente</span>
```

Para:
```tsx
                <Badge tone="warn">Peso pendente</Badge>
```

Adicionar import no topo:
```tsx
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
```

- [ ] **Step 2: `ConferenciaPainel.tsx` — migrar badge de status, input de peso e os dois botões**

Trocar:
```tsx
      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
        {status === 'CONFERIDO' ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">CONFERIDO</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">PENDENTE DE CONFERÊNCIA</span>
        )}
      </div>
```

Por:
```tsx
      <div className="mt-2">
        <Badge tone={status === 'CONFERIDO' ? 'ok' : 'warn'}>
          {status === 'CONFERIDO' ? 'CONFERIDO' : 'PENDENTE DE CONFERÊNCIA'}
        </Badge>
      </div>
```

Trocar o campo de peso + botão "Salvar peso/Corrigir peso":

De:
```tsx
          <label className="block text-sm font-medium text-neutral-700" htmlFor="peso-sucata">
            Peso real da sucata (t) — com base no documento de pesagem
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="peso-sucata"
              className="h-11 flex-1 rounded border px-3"
              inputMode="decimal"
              placeholder="Ex.: 1,250"
              value={pesoTexto}
              onChange={(e) => {
                setPesoTexto(e.target.value);
                setErroPeso('');
              }}
            />
            <button
              className="h-11 rounded bg-steel px-4 text-white disabled:bg-neutral-300"
              disabled={salvandoPeso}
              onClick={salvarPeso}
            >
              {salvandoPeso ? 'Salvando...' : pesoSucataReal != null ? 'Corrigir peso' : 'Salvar peso'}
            </button>
          </div>
          {erroPeso && <p className="mt-1 text-sm text-red-600">{erroPeso}</p>}
```

Para:
```tsx
          <Field label="Peso real da sucata (t) — com base no documento de pesagem" htmlFor="peso-sucata" error={erroPeso}>
            <div className="flex gap-2">
              <Input
                id="peso-sucata"
                className="flex-1"
                inputMode="decimal"
                placeholder="Ex.: 1,250"
                value={pesoTexto}
                onChange={(e) => {
                  setPesoTexto(e.target.value);
                  setErroPeso('');
                }}
              />
              <Button disabled={salvandoPeso} onClick={salvarPeso}>
                {salvandoPeso ? 'Salvando...' : pesoSucataReal != null ? 'Corrigir peso' : 'Salvar peso'}
              </Button>
            </div>
          </Field>
```

Trocar o botão "Conferir recebimento":

De:
```tsx
        <button
          className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
          disabled={!podeConferir || conferindo}
          onClick={conferir}
        >
          {conferindo ? 'Conferindo...' : status === 'CONFERIDO' ? 'Recebimento conferido' : 'Conferir recebimento'}
        </button>
        {erroConferir && <p className="mt-1 text-sm text-red-600">{erroConferir}</p>}
```

Para:
```tsx
        <Button fullWidth disabled={!podeConferir || conferindo} onClick={conferir}>
          {conferindo ? 'Conferindo...' : status === 'CONFERIDO' ? 'Recebimento conferido' : 'Conferir recebimento'}
        </Button>
        {erroConferir && <p className="mt-1 text-sm text-bad">{erroConferir}</p>}
```

Envolver o `<section className="rounded-lg border bg-white p-4">` com `Card`, como nas tasks anteriores.

Adicionar import:
```tsx
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
```

- [ ] **Step 3: `DocumentoPesagemPainel.tsx` — migrar o botão "Abrir documento" e o botão "Enviar/Substituir documento"**

De:
```tsx
          <button
            className="h-10 rounded border px-4 disabled:opacity-50"
            disabled={abrindo}
            onClick={abrir}
          >
            {abrindo ? 'Abrindo...' : 'Abrir documento'}
          </button>
```

Para:
```tsx
          <Button variant="ghost" size="sm" disabled={abrindo} onClick={abrir}>
            {abrindo ? 'Abrindo...' : 'Abrir documento'}
          </Button>
```

De:
```tsx
        <button
          className="h-10 rounded bg-steel px-4 text-sm text-white disabled:bg-neutral-300"
          disabled={enviando}
          onClick={enviar}
        >
          {enviando ? 'Enviando...' : anexo ? 'Substituir documento' : 'Enviar documento'}
        </button>
```

Para:
```tsx
        <Button size="sm" disabled={enviando} onClick={enviar}>
          {enviando ? 'Enviando...' : anexo ? 'Substituir documento' : 'Enviar documento'}
        </Button>
```

Envolver o `<section className="rounded-lg border bg-white p-4">` com `Card`.

Adicionar import: `import { Card } from '@/components/ui/Card'; import { Button } from '@/components/ui/Button';`

- [ ] **Step 4: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/admin-conferencia.spec.ts` (local).
Expected: PASS — este arquivo clica em "Conferir recebimento" e lê o texto do botão; a troca de `<button>` por `<Button>` (que renderiza um `<button>` real quando sem `href`) preserva role/texto.

Visual: abrir um recebimento pendente (`/admin/recebimentos/[id]`) logado, comparar cards/badges com o protótipo.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protegido)/recebimentos/[id]/page.tsx" "app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel.tsx" "app/admin/(protegido)/recebimentos/[id]/DocumentoPesagemPainel.tsx"
git commit -m "feat(admin): migra detalhe de Recebimento + Conferência + Documento de pesagem"
```

---

### Task 16: Migrar `/admin/remetidos/[id]` + `NfPainel`

**Files:**
- Modify: `app/admin/(protegido)/remetidos/[id]/page.tsx`
- Modify: `app/admin/(protegido)/remetidos/[id]/NfPainel.tsx`

**Interfaces:**
- Consumes: `Card`, `Badge`, `Button`, `Field`, `Input` (Tasks 3-6).

- [ ] **Step 1: `page.tsx` — badge de status e cards**

Trocar `STATUS_LABEL` e o uso do badge:

De:
```tsx
const STATUS_LABEL: Record<string, { texto: string; className: string }> = {
  AGUARDANDO_CHEGADA: { texto: 'AGUARDANDO CHEGADA', className: 'bg-neutral-200 text-neutral-800' },
  PENDENTE_CONFERENCIA: { texto: 'PENDENTE DE CONFERÊNCIA', className: 'bg-amber-100 text-amber-800' },
  CONFERIDO: { texto: 'CONFERIDO', className: 'bg-emerald-100 text-emerald-800' },
};
```
...
```tsx
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.className}`}>{statusInfo.texto}</span>
```

Para:
```tsx
const STATUS_LABEL: Record<string, { texto: string; tone: 'neutral' | 'warn' | 'ok' }> = {
  AGUARDANDO_CHEGADA: { texto: 'AGUARDANDO CHEGADA', tone: 'neutral' },
  PENDENTE_CONFERENCIA: { texto: 'PENDENTE DE CONFERÊNCIA', tone: 'warn' },
  CONFERIDO: { texto: 'CONFERIDO', tone: 'ok' },
};
```
...
```tsx
          <Badge tone={statusInfo.tone}>{statusInfo.texto}</Badge>
```

Envolver as 3 `<section className="rounded-lg border bg-white p-4">` com `Card`, mesmo padrão das tasks anteriores.

Adicionar import: `import { Card } from '@/components/ui/Card'; import { Badge } from '@/components/ui/Badge';`

- [ ] **Step 2: `NfPainel.tsx` — campo + botão**

De:
```tsx
      <div className="flex gap-2">
        <input
          className="h-11 flex-1 rounded border px-3"
          inputMode="numeric"
          placeholder="Número da NF"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setErro('');
          }}
        />
        <button
          className="h-11 rounded bg-steel px-4 text-white disabled:bg-neutral-300"
          disabled={salvando}
          onClick={salvar}
        >
          {salvando ? 'Salvando...' : 'Salvar NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
```

Para:
```tsx
      <div className="flex gap-2">
        <Input
          className="flex-1"
          inputMode="numeric"
          placeholder="Número da NF"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setErro('');
          }}
        />
        <Button disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Salvar NF'}
        </Button>
      </div>
      {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
```

Adicionar import: `import { Input } from '@/components/ui/Input'; import { Button } from '@/components/ui/Button';`

- [ ] **Step 3: Verificar regressão + visual**

Run: `npx vitest run` (suíte completa — garante que nada no backend relacionado a remetido quebrou, embora esta task só mexa em UI).

Visual: abrir um remetido confirmado (`/admin/remetidos/[id]`) logado, comparar badge/cards com o protótipo.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(protegido)/remetidos/[id]/page.tsx" "app/admin/(protegido)/remetidos/[id]/NfPainel.tsx"
git commit -m "feat(admin): migra detalhe de Remetido + painel de NF"
```

---

### Task 17: Migrar `/admin/remetidos/novo`

**Files:**
- Modify: `app/admin/(protegido)/remetidos/novo/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input`, `Select` (Tasks 3, 6).

- [ ] **Step 1: Substituir os 4 campos do formulário e o botão de submit**

De (arquivo atual inteiro, a partir do `<form>`):
```tsx
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="tipoRemetido">
            Tipo de remetido
          </label>
          <select
            id="tipoRemetido"
            name="tipoRemetido"
            required
            className="mt-1 h-11 w-full rounded border px-3"
            defaultValue=""
          >
            <option value="" disabled>
              Selecione
            </option>
            {TIPOS_REMETIDO.map((t) => (
              <option key={t} value={t}>
                {TIPO_REMETIDO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="reservaPedido">
            Reserva/Pedido
          </label>
          <input id="reservaPedido" name="reservaPedido" required className="mt-1 h-11 w-full rounded border px-3" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="destino">
            Destino
          </label>
          <input id="destino" name="destino" required className="mt-1 h-11 w-full rounded border px-3" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="numeroDocumento">
            Nota fiscal (se já souber)
          </label>
          <input
            id="numeroDocumento"
            name="numeroDocumento"
            inputMode="numeric"
            placeholder="Opcional — o Pátio ou o Administrativo completam depois"
            className="mt-1 h-11 w-full rounded border px-3"
          />
        </div>

        {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Salvando...' : 'Criar pré-cadastro'}
        </button>
      </form>
```

Para:
```tsx
      <form action={formAction} className="mt-4 space-y-4">
        <Field label="Tipo de remetido" htmlFor="tipoRemetido">
          <Select id="tipoRemetido" name="tipoRemetido" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {TIPOS_REMETIDO.map((t) => (
              <option key={t} value={t}>
                {TIPO_REMETIDO_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reserva/Pedido" htmlFor="reservaPedido">
          <Input id="reservaPedido" name="reservaPedido" required />
        </Field>

        <Field label="Destino" htmlFor="destino">
          <Input id="destino" name="destino" required />
        </Field>

        <Field label="Nota fiscal (se já souber)" htmlFor="numeroDocumento">
          <Input
            id="numeroDocumento"
            name="numeroDocumento"
            inputMode="numeric"
            placeholder="Opcional — o Pátio ou o Administrativo completam depois"
          />
        </Field>

        {estado.erro && <p role="alert" className="text-sm text-bad">{estado.erro}</p>}

        <Button type="submit" disabled={enviando} fullWidth>
          {enviando ? 'Salvando...' : 'Criar pré-cadastro'}
        </Button>
      </form>
```

Adicionar import: `import { Button } from '@/components/ui/Button'; import { Field, Input, Select } from '@/components/ui/Input';`

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/patio-remetido.spec.ts` (local) — o primeiro teste deste arquivo passa por `/admin/remetidos/novo` (`#tipoRemetido`, `#reservaPedido`, `#destino`, botão "Criar pré-cadastro"). `id`/`name` preservados garantem que continua passando.

Visual: abrir `/admin/remetidos/novo` logado, comparar com o protótipo.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protegido)/remetidos/novo/page.tsx"
git commit -m "feat(admin): migra /admin/remetidos/novo para Field/Input/Select/Button"
```

---

### Task 18: Checkpoint — suíte completa antes de migrar o Pátio

**Files:** nenhum.

- [ ] **Step 1: Suíte completa + build**

Run: `npx vitest run` — tudo passa.
Run: `npx tsc --noEmit` — sem erros.
Run: `npx next build 2>&1 | tail -40` — build limpo.
Run: `npx playwright test tests/e2e/admin-conferencia.spec.ts tests/e2e/admin-recebimentos.spec.ts tests/e2e/patio-remetido.spec.ts` (local) — todos passam (cobre as rotas Admin migradas + `/admin/remetidos/novo`).

Nenhum commit — checkpoint antes da Fase 2.

---

## Fase 2 — Migração do Pátio

### Task 19: `app/patio/(protegido)/layout.tsx` usa `PatioShell`

**Files:**
- Modify: `app/patio/(protegido)/layout.tsx`

**Interfaces:**
- Consumes: `PatioShell` (Task 9).

- [ ] **Step 1: Substituir a renderização direta do indicador pelo Shell**

De:
```tsx
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return (
    <>
      <IndicadorSincronizacao />
      {children}
    </>
  );
}
```

Para:
```tsx
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';
import { PatioShell } from '@/components/patio/PatioShell';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return <PatioShell>{children}</PatioShell>;
}
```

- [ ] **Step 2: Verificar regressão**

Run: `npx playwright test tests/e2e/patio-recebimento.spec.ts tests/e2e/patio-remetido.spec.ts` (local).
Expected: todos passam — `IndicadorSincronizacao` continua montado (agora dentro de `PatioShell`), nenhum seletor usado pelos testes depende da ausência do Shell.

- [ ] **Step 3: Commit**

```bash
git add "app/patio/(protegido)/layout.tsx"
git commit -m "feat(patio): layout protegido usa PatioShell"
```

---

### Task 20: Migrar `/patio/acesso`

**Files:**
- Modify: `app/patio/acesso/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input` (Tasks 3, 6). Esta página recebe a classe `area-patio` diretamente (não é filha de `PatioShell`).

- [ ] **Step 1: Substituir o JSX**

De (arquivo atual inteiro):
```tsx
'use client';

import { useActionState } from 'react';
import { acessarPatioAction, type EstadoAcessoPatio } from './actions';

const ESTADO_INICIAL: EstadoAcessoPatio = {};

export default function AcessoPatioPage() {
  const [estado, formAction, enviando] = useActionState(acessarPatioAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Acesso do Pátio</h1>
      <p className="mt-1 text-sm text-neutral-600">Digite o código de acesso do Pátio para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="pin">
            Código de acesso
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            required
            className="mt-1 h-12 w-full rounded border px-3 text-center text-lg tracking-widest"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {estado.erro && (
          <p role="alert" className="text-sm text-red-700">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
```

Para:
```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { acessarPatioAction, type EstadoAcessoPatio } from './actions';

const ESTADO_INICIAL: EstadoAcessoPatio = {};

export default function AcessoPatioPage() {
  const [estado, formAction, enviando] = useActionState(acessarPatioAction, ESTADO_INICIAL);

  return (
    <main className="area-patio mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">Acesso do Pátio</h1>
      <p className="mt-1 text-sm text-ink-muted">Digite o código de acesso do Pátio para continuar.</p>

      <form action={formAction} className="mt-4 space-y-4">
        <Field label="Código de acesso" htmlFor="pin">
          <Input id="pin" name="pin" type="password" inputMode="numeric" required className="text-center text-lg tracking-widest" />
        </Field>

        <Button type="submit" disabled={enviando} fullWidth>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Button>

        {estado.erro && (
          <p role="alert" className="text-sm text-bad">
            {estado.erro}
          </p>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/patio-recebimento.spec.ts` (local) — usa `entrarNoPatio()` (`input[name="pin"]`, botão "Entrar"); `name`/texto preservados garantem que continua passando.

Visual: abrir `/patio/acesso`, comparar com a paleta do Pátio (botão aço `#2F6690`).

- [ ] **Step 3: Commit**

```bash
git add app/patio/acesso/page.tsx
git commit -m "feat(patio): migra /patio/acesso para a paleta Pátio e os componentes compartilhados"
```

---

### Task 21: Migrar `/patio` (home)

**Files:**
- Modify: `app/patio/(protegido)/page.tsx`

**Interfaces:**
- Consumes: `Button` (Task 3).

- [ ] **Step 1: Substituir os dois links estilizados por `Button`**

De (arquivo atual inteiro):
```tsx
import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Pátio — Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Área do Pátio. Fluxo completo disponível hoje: recebimento por caminhão.
      </p>
      <Link
        href="/patio/recebimentos/novo"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-steel px-4 font-medium text-white"
      >
        Novo recebimento
      </Link>
      <Link
        href="/patio/remetidos"
        className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg border border-steel px-4 font-medium text-steel-dark"
      >
        Remetidos aguardando chegada
      </Link>
    </main>
  );
}
```

Para:
```tsx
import { Button } from '@/components/ui/Button';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-ink">Pátio — Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Área do Pátio. Fluxo completo disponível hoje: recebimento por caminhão.
      </p>
      <Button href="/patio/recebimentos/novo" fullWidth className="mt-6">
        Novo recebimento
      </Button>
      <Button href="/patio/remetidos" variant="secondary" fullWidth className="mt-3">
        Remetidos aguardando chegada
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Verificar visual**

Abrir `/patio` logado, comparar com o protótipo.

- [ ] **Step 3: Commit**

```bash
git add "app/patio/(protegido)/page.tsx"
git commit -m "feat(patio): migra home do Pátio para Button"
```

---

### Task 22: Migrar `/patio/remetidos` (lista)

**Files:**
- Modify: `app/patio/(protegido)/remetidos/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card` (Tasks 3, 4).

- [ ] **Step 1: Substituir o botão "+ Novo remetido" e os itens da lista**

De (arquivo atual inteiro):
```tsx
import Link from 'next/link';
import { listarAguardandoChegada } from '@/lib/services/remetido';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function RemetidosAguardandoPage() {
  const remetidos = await listarAguardandoChegada();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Remetidos aguardando chegada</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Pré-cadastrados pelo Administrativo. Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <Link
        href="/patio/remetidos/novo"
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg bg-steel px-4 font-medium text-white"
      >
        + Novo remetido
      </Link>

      <div className="mt-4 space-y-2">
        {remetidos.map((r) => (
          <Link
            key={r.id}
            href={`/patio/remetidos/${r.id}/confirmar`}
            className="block rounded-lg border bg-white p-3 hover:bg-neutral-50"
          >
            <p className="font-medium">{r.reservaPedido}</p>
            <p className="text-sm text-neutral-600">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {r.destino}
            </p>
            {r.numeroDocumento && <p className="text-sm text-neutral-500">NF {r.numeroDocumento}</p>}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <p className="rounded-lg border bg-white p-4 text-center text-sm text-neutral-500">
            Nenhum remetido aguardando chegada.
          </p>
        )}
      </div>
    </main>
  );
}
```

Para:
```tsx
import Link from 'next/link';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function RemetidosAguardandoPage() {
  const remetidos = await listarAguardandoChegada();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-ink">Remetidos aguardando chegada</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Pré-cadastrados pelo Administrativo. Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <Button href="/patio/remetidos/novo" fullWidth className="mt-4">
        + Novo remetido
      </Button>

      <div className="mt-4 space-y-2">
        {remetidos.map((r) => (
          <Link key={r.id} href={`/patio/remetidos/${r.id}/confirmar`} className="block">
            <Card className="hover:bg-neutral-50">
              <p className="font-medium text-ink">{r.reservaPedido}</p>
              <p className="text-sm text-ink-muted">
                {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {r.destino}
              </p>
              {r.numeroDocumento && <p className="text-sm text-ink-muted">NF {r.numeroDocumento}</p>}
            </Card>
          </Link>
        ))}
        {remetidos.length === 0 && (
          <Card className="text-center text-sm text-ink-muted">Nenhum remetido aguardando chegada.</Card>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/patio-remetido.spec.ts` (local) — este arquivo clica em `getByRole('link', {name: '+ Novo remetido'})` e em `page.getByText(MARCADOR)` (o texto da reserva dentro do card). Ambos preservados.

Visual: abrir `/patio/remetidos` logado, com e sem itens na lista.

- [ ] **Step 3: Commit**

```bash
git add "app/patio/(protegido)/remetidos/page.tsx"
git commit -m "feat(patio): migra lista de remetidos aguardando chegada para Button/Card"
```

---

### Task 23: Migrar `RecebimentoWizard.tsx` (e `/patio/recebimentos/novo`)

**Files:**
- Modify: `app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input`, `Select` (Tasks 3, 6).

Este arquivo é grande (4 etapas). A troca é mecânica e repetitiva: todo `<label>...</label><input .../>` vira `<Field><Input/></Field>` (ou `<Select>` quando é um `<select>`), toda `className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"` vira `<Button fullWidth>`, todo `className="h-12 flex-1 rounded border"` vira `<Button variant="ghost" fullWidth>` dentro de um `flex` (a classe `flex-1` some porque cada `Button` já ocupa a largura do seu container flex por padrão quando não tem `fullWidth` — manter os dois botões lado a lado num `<div className="flex gap-3">` como hoje, cada `Button` com `className="flex-1"`).

- [ ] **Step 1: Etapa 1 (Dados) — trocar os 6 campos e o botão "Próximo"**

De:
```tsx
          <div>
            <label className="block text-sm font-medium" htmlFor="f-data">Data</label>
            <input
              id="f-data"
              type="date"
              className="mt-1 h-11 w-full rounded border px-3"
              value={dados.data}
              onChange={(e) => {
                setDataTocada(true);
                setDados({ ...dados, data: e.target.value });
              }}
            />
            {errosDados.data && <p className="text-sm text-red-600">{errosDados.data}</p>}
          </div>
```

Para:
```tsx
          <Field label="Data" htmlFor="f-data" error={errosDados.data}>
            <Input
              id="f-data"
              type="date"
              value={dados.data}
              onChange={(e) => {
                setDataTocada(true);
                setDados({ ...dados, data: e.target.value });
              }}
            />
          </Field>
```

Aplicar o mesmo padrão (label do `<label>` original vira `label` do `Field`, `htmlFor`/`id` iguais, `error` recebe a mensagem que hoje é um `<p>` condicional logo abaixo) aos campos: `f-nf` (Nota fiscal), `f-origem` (Origem), `f-cavalo` (Placa do cavalo — mantém `maxLength={7}` e `className="uppercase"` no `Input`), `f-carreta` (Placa da carreta), `f-transportadora` (Transportadora — sem erro), `f-resp` (Responsável).

Trocar o botão final da etapa 1:

De:
```tsx
          <button className="h-12 w-full rounded bg-steel font-medium text-white" onClick={proximoDeDados}>
            Próximo
          </button>
```

Para:
```tsx
          <Button fullWidth onClick={proximoDeDados}>
            Próximo
          </Button>
```

- [ ] **Step 2: Etapa 2 (Grupos) — trocar "Excluir", "Medir/Lançar medidas", "Voltar"/"Ver resumo", e o `NovoGrupoForm`**

Trocar:
```tsx
                <button className="text-red-600" onClick={() => removerGrupo(g.clientId)}>
                  Excluir
                </button>
```
Para:
```tsx
                <button className="text-sm text-bad" onClick={() => removerGrupo(g.clientId)}>
                  Excluir
                </button>
```
(Mantido como `<button>` simples, não `Button` — é um link de texto inline, não um botão de ação; só a cor muda de `text-red-600` para `text-bad`.)

Trocar:
```tsx
              <button className="mt-2 h-10 rounded border px-3" onClick={() => abrirMedicoes(g.clientId)}>
                {g.medicoes.length ? 'Medir' : 'Lançar medidas'}
              </button>
```
Para:
```tsx
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => abrirMedicoes(g.clientId)}>
                {g.medicoes.length ? 'Medir' : 'Lançar medidas'}
              </Button>
```

Trocar o rodapé da etapa 2:

De:
```tsx
          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded border" onClick={() => irPara(1)}>
              Voltar
            </button>
            <button
              className="h-12 flex-1 rounded bg-steel font-medium text-white disabled:bg-neutral-300"
              disabled={grupos.length === 0}
              onClick={() => irPara(4)}
            >
              Ver resumo
            </button>
          </div>
```

Para:
```tsx
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => irPara(1)}>
              Voltar
            </Button>
            <Button className="flex-1" disabled={grupos.length === 0} onClick={() => irPara(4)}>
              Ver resumo
            </Button>
          </div>
```

Dentro de `NovoGrupoForm`, trocar os dois `<select>` (mantendo os `aria-label` exatamente iguais — os testes e2e usam `getByLabelText`/seletor por `aria-label`) por `<Select aria-label=...>`, e o botão final:

De:
```tsx
      <button
        className="h-10 rounded bg-steel px-4 text-white disabled:bg-neutral-300"
        disabled={!perfil}
        onClick={() => {
          if (!perfil) return;
          onAdd(perfil, tipoMaterial);
          setPerfil('');
        }}
      >
        Adicionar grupo
      </button>
```

Para:
```tsx
      <Button
        size="sm"
        disabled={!perfil}
        onClick={() => {
          if (!perfil) return;
          onAdd(perfil, tipoMaterial);
          setPerfil('');
        }}
      >
        Adicionar grupo
      </Button>
```

(Os `<select>` de `NovoGrupoForm` e do bloco "Classificação"/"Marca" de cada grupo trocam `className="h-10 rounded border px-2"`/`className="mt-1 h-10 w-full rounded border px-2"` por `<Select aria-label="..." className="h-10">` preservando `aria-label` — a classe de altura menor (`h-10` em vez do `h-11` default do `Select`) é aceitável como `className` extra, igual já é feito com `Input`.)

- [ ] **Step 3: Etapa 3 (Medições) — trocar os botões de modo, o input/select de medição, "Adicionar", "Voltar aos grupos"**

Trocar os dois botões de modo (Individual / Quantidade × comprimento):

De:
```tsx
            <button
              className={`h-10 flex-1 rounded border ${modoDraft === 'INDIVIDUAL' ? 'bg-steel text-white' : ''}`}
              onClick={() => setModoDraft('INDIVIDUAL')}
            >
              Individual
            </button>
            <button
              className={`h-10 flex-1 rounded border ${modoDraft === 'QTD_COMPRIMENTO' ? 'bg-steel text-white' : ''}`}
              onClick={() => setModoDraft('QTD_COMPRIMENTO')}
            >
              Quantidade × comprimento
            </button>
```

Para:
```tsx
            <Button
              variant={modoDraft === 'INDIVIDUAL' ? 'primary' : 'ghost'}
              className="flex-1"
              onClick={() => setModoDraft('INDIVIDUAL')}
            >
              Individual
            </Button>
            <Button
              variant={modoDraft === 'QTD_COMPRIMENTO' ? 'primary' : 'ghost'}
              className="flex-1"
              onClick={() => setModoDraft('QTD_COMPRIMENTO')}
            >
              Quantidade × comprimento
            </Button>
```

Trocar os inputs/select de medição (mantendo `aria-label` iguais) por `Input`/`Select`, e o botão "Adicionar":

De (o `<input aria-label="Quantidade">`, `<input aria-label="Comprimento">`, `<select aria-label="Classificação SC">` e o botão final do bloco):
```tsx
            <button className="h-11 rounded bg-steel px-4 text-white" onClick={adicionarMedicao}>
              Adicionar
            </button>
```

Para:
```tsx
            <Button onClick={adicionarMedicao}>
              Adicionar
            </Button>
```

(Os três campos trocam `<input .../>`/`<select .../>` por `<Input .../>`/`<Select .../>` com os mesmos `aria-label`/`value`/`onChange`, sem `Field` em volta — este bloco não usa label visível, só `aria-label`, então `Input`/`Select` sozinhos bastam.)

Trocar "Voltar aos grupos":

De:
```tsx
          <button className="h-12 w-full rounded bg-steel font-medium text-white" onClick={() => irPara(2)}>
            Voltar aos grupos
          </button>
```

Para:
```tsx
          <Button fullWidth onClick={() => irPara(2)}>
            Voltar aos grupos
          </Button>
```

- [ ] **Step 4: Etapa 4 (Resumo) — "Voltar" e "Finalizar e salvar"**

De:
```tsx
          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded border" onClick={() => irPara(2)}>
              Voltar
            </button>
            <button
              className="h-12 flex-1 rounded bg-steel font-medium text-white disabled:bg-neutral-300"
              disabled={enviando || grupos.length === 0 || grupos.some(grupoIncompleto)}
              onClick={finalizar}
            >
              {enviando ? 'Salvando...' : 'Finalizar e salvar'}
            </button>
          </div>
```

Para:
```tsx
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => irPara(2)}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={enviando || grupos.length === 0 || grupos.some(grupoIncompleto)}
              onClick={finalizar}
            >
              {enviando ? 'Salvando...' : 'Finalizar e salvar'}
            </Button>
          </div>
```

Trocar `text-sm text-red-600` do erro final por `text-sm text-bad` (uma ocorrência, `erroFinal`).

Adicionar import no topo do arquivo:
```tsx
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
```

- [ ] **Step 5: Verificar regressão — esta é a página com mais cobertura e2e do projeto**

Run: `npx playwright test tests/e2e/patio-recebimento.spec.ts` (local).
Expected: os 3 testes (NOVO/REEMPREGO/SUCATA) continuam passando — todos dependem de `getByLabelText`/`getByRole('button', {name: ...})` com os textos exatos preservados.

Run: `npx vitest run tests/unit/recebimento-wizard.test.tsx` (se este arquivo testa o wizard diretamente — conferir se existe teste de componente para ele; se sim, rodar e confirmar que passa).

Visual: percorrer as 4 etapas do wizard em `/patio/recebimentos/novo`, comparar com o protótipo (botões `h-12`/cor aço, campos com anel de foco aço).

- [ ] **Step 6: Commit**

```bash
git add "app/patio/(protegido)/recebimentos/novo/RecebimentoWizard.tsx"
git commit -m "feat(patio): migra RecebimentoWizard para Button/Field/Input/Select"
```

---

### Task 24: Migrar `/patio/recebimentos/[clientId]/confirmado`

**Files:**
- Modify: `app/patio/(protegido)/recebimentos/[clientId]/confirmado/page.tsx`

**Interfaces:**
- Consumes: `Button` (Task 3).

- [ ] **Step 1: Trocar os links "Voltar ao início" e o botão "Tentar novamente"**

Trocar (duas ocorrências do link, uma no branch "não encontrado" e outra no final):

De:
```tsx
        <Link href="/patio" className="mt-6 inline-block h-11 rounded border px-4 py-2">
          Voltar ao início
        </Link>
```

Para:
```tsx
        <Button href="/patio" variant="ghost" className="mt-6">
          Voltar ao início
        </Button>
```

Trocar:
```tsx
          <button
            className="mt-2 h-10 rounded border px-3 disabled:opacity-50"
            onClick={tentarNovamente}
            disabled={retentando}
          >
            {retentando ? 'Tentando novamente...' : 'Tentar novamente'}
          </button>
```

Para:
```tsx
          <Button variant="ghost" size="sm" className="mt-2" onClick={tentarNovamente} disabled={retentando}>
            {retentando ? 'Tentando novamente...' : 'Tentar novamente'}
          </Button>
```

Trocar `text-amber-700` (aviso de sucata pendente) por `text-warn-dark` (uma ocorrência).

Atualizar import — `Link` deixa de ser necessário (substituído por `Button href=...`):

De: `import Link from 'next/link';`
Para: `import { Button } from '@/components/ui/Button';`

- [ ] **Step 2: Verificar regressão + visual**

Run: `npx playwright test tests/e2e/patio-recebimento.spec.ts` (local) — os 3 testes navegam até `**/confirmado` e checam `getByText('Sincronizado com sucesso')`; este texto não muda.

Visual: abrir a página de confirmação depois de um recebimento de teste.

- [ ] **Step 3: Commit**

```bash
git add "app/patio/(protegido)/recebimentos/[clientId]/confirmado/page.tsx"
git commit -m "feat(patio): migra página de confirmação de recebimento para Button"
```

---

### Task 25: Migrar `RemetidoWizard.tsx` (compartilhado) + páginas `novo`/`confirmar`

**Files:**
- Modify: `app/patio/(protegido)/remetidos/RemetidoWizard.tsx`
- Modify: `app/patio/(protegido)/remetidos/novo/page.tsx`
- Modify: `app/patio/(protegido)/remetidos/[id]/confirmar/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Input`, `Select` (Tasks 3, 6).

- [ ] **Step 1: `RemetidoWizard.tsx` — seção de identificação (modo novo)**

Trocar os 3 campos da seção "Identificação do remetido":

De:
```tsx
          <div>
            <label className="block text-sm font-medium" htmlFor="f-tipo-remetido">Tipo de remetido</label>
            <select
              id="f-tipo-remetido"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.tipoRemetido}
              onChange={(e) => setIdentificacao({ ...identificacao, tipoRemetido: e.target.value as TipoRemetido })}
            >
              <option value="" disabled>Selecione</option>
              {TIPOS_REMETIDO.map((t) => (
                <option key={t} value={t}>{TIPO_REMETIDO_LABEL[t]}</option>
              ))}
            </select>
            {errosIdentificacao.tipoRemetido && <p className="text-sm text-red-600">{errosIdentificacao.tipoRemetido}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-reserva-pedido">Reserva/Pedido</label>
            <input
              id="f-reserva-pedido"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.reservaPedido}
              onChange={(e) => setIdentificacao({ ...identificacao, reservaPedido: e.target.value })}
            />
            {errosIdentificacao.reservaPedido && <p className="text-sm text-red-600">{errosIdentificacao.reservaPedido}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-destino">Destino</label>
            <input
              id="f-destino"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.destino}
              onChange={(e) => setIdentificacao({ ...identificacao, destino: e.target.value })}
            />
            {errosIdentificacao.destino && <p className="text-sm text-red-600">{errosIdentificacao.destino}</p>}
          </div>
```

Para:
```tsx
          <Field label="Tipo de remetido" htmlFor="f-tipo-remetido" error={errosIdentificacao.tipoRemetido}>
            <Select
              id="f-tipo-remetido"
              value={identificacao.tipoRemetido}
              onChange={(e) => setIdentificacao({ ...identificacao, tipoRemetido: e.target.value as TipoRemetido })}
            >
              <option value="" disabled>Selecione</option>
              {TIPOS_REMETIDO.map((t) => (
                <option key={t} value={t}>{TIPO_REMETIDO_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reserva/Pedido" htmlFor="f-reserva-pedido" error={errosIdentificacao.reservaPedido}>
            <Input
              id="f-reserva-pedido"
              value={identificacao.reservaPedido}
              onChange={(e) => setIdentificacao({ ...identificacao, reservaPedido: e.target.value })}
            />
          </Field>
          <Field label="Destino" htmlFor="f-destino" error={errosIdentificacao.destino}>
            <Input
              id="f-destino"
              value={identificacao.destino}
              onChange={(e) => setIdentificacao({ ...identificacao, destino: e.target.value })}
            />
          </Field>
```

- [ ] **Step 2: "Dados da chegada" — mesmo padrão `Field`/`Input` para os 6 campos**

Aplicar o mesmo padrão de substituição da Task 23/Step 1 aos campos `f-data`, `f-nf` (mantendo o `disabled={Boolean(numeroDocumentoPreCadastrado)}` no `Input`), `f-cavalo`, `f-carreta`, `f-transp`, `f-resp`.

- [ ] **Step 3: Seção "Grupos" — botões e selects**

Aplicar o mesmo padrão da Task 23/Step 2-3: `<select>` de Marca/Classificação/Perfil/Tipo de material viram `<Select>`, o `<input>` de peso vira `<Input>`, os botões "Remover" (texto, mantêm `<button>` simples com `text-bad`), "Adicionar grupo"/"Adicionar"/"Lançar medidas" viram `<Button size="sm">`, os dois botões de modo (Individual/Qtd×comprimento, hoje com `className={`rounded px-2 py-1 ${modoDraft === ... ? 'bg-steel text-white' : 'border'}`}`) seguem o mesmo padrão `variant={condição ? 'primary' : 'ghost'}` da Task 23/Step 3.

- [ ] **Step 4: Botão final**

De:
```tsx
      <button
        className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        disabled={enviando}
        onClick={confirmar}
      >
        {enviando
          ? (props.modo === 'novo' ? 'Lançando...' : 'Confirmando...')
          : (props.modo === 'novo' ? 'Lançar remetido' : 'Confirmar chegada e salvar')}
      </button>
```

Para:
```tsx
      <Button fullWidth disabled={enviando} onClick={confirmar}>
        {enviando
          ? (props.modo === 'novo' ? 'Lançando...' : 'Confirmando...')
          : (props.modo === 'novo' ? 'Lançar remetido' : 'Confirmar chegada e salvar')}
      </Button>
```

Trocar `erroFinal` de `text-red-600` para `text-bad`.

Adicionar import:
```tsx
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
```

- [ ] **Step 5: Páginas `novo/page.tsx` e `[id]/confirmar/page.tsx` — títulos**

Trocar `text-neutral-600`/`text-neutral-500` por `text-ink-muted` nos dois arquivos (parágrafos de subtítulo), sem mudar estrutura.

- [ ] **Step 6: Verificar regressão — maior superfície de teste e2e de Remetido**

Run: `npx playwright test tests/e2e/patio-remetido.spec.ts` (local).
Expected: os 3 testes passam — confirmação de pré-cadastro, lançamento direto, e exportação Excel (este último não toca UI do Pátio, mas roda na mesma suíte).

Run: `npx vitest run tests/integration/remetido.test.ts tests/unit/validation-remetido.test.ts` — confirma que a camada de validação/serviço não foi tocada.

Visual: percorrer os dois fluxos (confirmar pré-cadastro e lançar direto) em `/patio/remetidos/[id]/confirmar` e `/patio/remetidos/novo`.

- [ ] **Step 7: Commit**

```bash
git add "app/patio/(protegido)/remetidos/RemetidoWizard.tsx" "app/patio/(protegido)/remetidos/novo/page.tsx" "app/patio/(protegido)/remetidos/[id]/confirmar/page.tsx"
git commit -m "feat(patio): migra RemetidoWizard (confirmação + lançamento direto) para Button/Field/Input/Select"
```

---

### Task 26: `app/page.tsx` (landing neutra)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:** nenhuma nova — ajuste cosmético isolado.

- [ ] **Step 1: Trocar `bg-steel`/`border-steel`/`text-steel-dark` por tons neutros**

De:
```tsx
        <Link
          href="/patio/acesso"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-steel px-4 font-medium text-white"
        >
          Acesso do Pátio
        </Link>
        <Link
          href="/admin/login"
          className="flex h-12 w-full items-center justify-center rounded-lg border border-steel px-4 font-medium text-steel-dark"
        >
          Login do Administrativo
        </Link>
```

Para:
```tsx
        <Link
          href="/patio/acesso"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 font-medium text-white"
        >
          Acesso do Pátio
        </Link>
        <Link
          href="/admin/login"
          className="flex h-12 w-full items-center justify-center rounded-lg border border-neutral-900 px-4 font-medium text-neutral-900"
        >
          Login do Administrativo
        </Link>
```

(Esta página não pertence a nenhuma das duas áreas — não usa `Button`/tokens de área, só troca a cor emprestada do Pátio por um neutro genérico, como combinado na spec.)

- [ ] **Step 2: Verificar visual**

Abrir `/`, confirmar que os dois links continuam funcionando e não usam mais a cor do Pátio.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "chore(ui): landing neutra deixa de usar a cor do Pátio emprestada"
```

---

## Fase 3 — Verificação completa e deploy

### Task 27: Verificação local completa + tabela rota por rota

**Files:** nenhum (task de verificação — produz o relatório, não código).

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run` — todos os testes (os já existentes + os ~14 novos desta rodada) passam.
Run: `npx tsc --noEmit` — sem erros.
Run: `npx eslint .` — sem erros novos (os 2 avisos pré-existentes de destructuring em teste, se ainda lá, não bloqueiam).
Run: `npx next build 2>&1 | tail -40` — build limpo.
Run: `npx playwright test` (suíte e2e completa local, sem filtrar arquivo) — todos os specs passam, incluindo `pwa.spec.ts` e `security-headers.spec.ts` (não tocados nesta rodada, mas precisam continuar passando).

Se qualquer um desses falhar, voltar à task correspondente antes de prosseguir — não seguir para o Step 2 com qualquer coisa vermelha.

- [ ] **Step 2: Abrir cada rota localmente e comparar com o protótipo**

Com `npx next start -p 3911` rodando (build de produção, não dev), usar um script Playwright (mesmo padrão já usado nesta sessão: `chromium.launch()`, `page.goto`, `page.screenshot()`) para visitar e tirar screenshot de cada uma das rotas abaixo, autenticando antes quando necessário (reaproveitar os helpers `entrarNoAdmin`/`entrarNoPatio` de `tests/e2e/helpers.ts` como referência de credenciais/fluxo, mesmo rodando fora do Playwright Test runner):

- `/` (landing)
- `/admin/login`
- `/admin` (pendências)
- `/admin/relatorios`
- `/admin/recebimentos/[id]` (abrir um recebimento pendente real)
- `/admin/remetidos/[id]` (abrir um remetido real)
- `/admin/remetidos/novo`
- `/patio/acesso`
- `/patio` (home)
- `/patio/recebimentos/novo` (as 4 etapas do wizard)
- `/patio/remetidos` (lista)
- `/patio/remetidos/novo` (lançamento direto)
- `/patio/remetidos/[id]/confirmar` (confirmação de pré-cadastro — criar um pré-cadastro de teste antes, se não houver nenhum `AGUARDANDO_CHEGADA`)

Para cada rota, comparar visualmente contra o protótipo correspondente (`prototipos/administrativo/administrativo.html` para as rotas `/admin/*`, `prototipos/patio/controle-de-trilhos-patio.html` para as rotas `/patio/*`): cor do botão primário, cor de fundo da sidebar/topbar, fonte dos títulos (Barlow Semi Condensed, mais condensada que o corpo).

- [ ] **Step 3: Produzir a tabela rota por rota**

Montar uma tabela com as colunas: Rota | O que foi testado | Resultado real. Preencher com o resultado de fato observado em cada rota do Step 2 (não "deveria estar ok" — só o que foi visto na tela/no teste). Qualquer rota que não pôde ser aberta (ex.: falta de dado de teste no banco local) entra como "não verificado — motivo X", nunca como aprovada por suposição.

Nenhum commit nesta task — é só verificação. Se tudo passar, prosseguir para a Task 28 (deploy). Se algo falhar, voltar à task da página correspondente.

---

### Task 28: Deploy + reteste de produção completo

**Files:** nenhum — task de publicação e verificação.

- [ ] **Step 1: Push para a branch de deploy**

Run: `git push origin claude/vibrant-feynman-bdpcbc`
Expected: push aceito, dispara o deploy automático na Vercel (URL: `https://controle-de-trilhos.vercel.app`).

- [ ] **Step 2: Aguardar o deploy e confirmar que a versão nova está no ar**

Poll (mesmo padrão já usado nesta sessão):
```bash
for i in $(seq 1 20); do
  html=$(curl -s https://controle-de-trilhos.vercel.app/admin/login)
  if echo "$html" | grep -q "Barlow"; then echo "DEPLOY OK na tentativa $i"; break; fi
  echo "tentativa $i: aguardando..."
  sleep 15
done
```
(O `<link>`/`<style>` de fonte do Next injeta o nome da fonte no HTML/CSS — ajustar a string de busca para algo que só exista na versão nova, como uma classe gerada ou o próprio nome da fonte, conferindo primeiro o HTML real retornado.)

- [ ] **Step 3: Reteste de produção completo — TODAS as rotas, não só as que tinham bug conhecido**

Repetir o Step 2 da Task 27 (screenshot + comparação visual) contra `https://controle-de-trilhos.vercel.app` em vez de `localhost:3911`, para a mesma lista completa de rotas.

Além disso, executar os 5 fluxos completos já validados em rodadas anteriores desta sessão, usando dados de teste marcados (prefixo `VERIFICACAO-PROD-<timestamp>` ou equivalente, como já foi feito) e limpando o banco ao final (mesmo script de cleanup via Prisma já usado nesta sessão):

1. Login do Admin — fluxo real de autenticação (credenciais corretas → redireciona para `/admin`; credenciais erradas → mensagem de erro aparece), não só a aparência da tela.
2. Acesso do Pátio (PIN → redireciona para `/patio`).
3. Recebimento completo (wizard de 4 etapas → `/confirmado` → "Sincronizado com sucesso").
4. Remetido via pré-cadastro + confirmação (Admin cria pré-cadastro → Pátio confirma → status `PENDENTE_CONFERENCIA`).
5. Remetido via lançamento direto (Pátio preenche tudo numa tela só → status `PENDENTE_CONFERENCIA`, pula `AGUARDANDO_CHEGADA`).

**Nota de ambiente:** rodar a suíte e2e formal (`npx playwright test`) apontando para a URL de produção foi bloqueado pelo classificador de modo automático numa rodada anterior desta sessão — usar o mesmo contorno já validado (script Playwright direto via `node`, fora do `playwright test` runner) em vez de tentar reconfigurar `playwright.config.ts` para produção.

- [ ] **Step 4: Montar o relatório final**

Tabela final: Rota | O que foi testado em produção | Resultado real. Mais uma seção separada para os 5 fluxos (nome do fluxo | passos executados | resultado real). Qualquer item não verificável (ambiente, permissão, etc.) entra explicitamente como tal — nunca presumido como aprovado.

Nenhum commit nesta task.

---

## Self-Review (preenchido durante a escrita deste plano)

- **Cobertura da spec:** tokens (Task 1), tipografia (Task 2), `Button`/`Card`/`Badge`/`Input`/`Select`/`Field` (Tasks 3-6), nome do admin (Task 7), `AdminShell`/`PatioShell` (Tasks 8-9), todas as páginas listadas na spec (Tasks 11-26), verificação local rota por rota + suíte completa (Task 27), deploy + reteste de produção completo + os 5 fluxos (Task 28). Nenhuma seção da spec ficou sem task correspondente.
- **Placeholders:** nenhum "TBD"/"adicionar validação apropriada" — toda substituição de JSX tem o texto antes/depois literal.
- **Consistência de tipos:** `ButtonVariant`/`ButtonSize`/`BadgeTone` definidos na Task 3/5 são usados com os mesmos nomes em todas as tasks de migração (`variant="secondary"`, `variant="ghost"`, `tone="warn"` etc. — nenhuma task posterior inventa um variant/tone novo).
