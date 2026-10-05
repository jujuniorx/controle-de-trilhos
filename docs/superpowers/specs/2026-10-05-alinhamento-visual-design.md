# Alinhamento visual Admin + Pátio (design)

**Data:** 2026-10-05
**Status:** aprovado em brainstorming, pronto para plano de implementação

## Contexto

Cada tela do sistema foi implementada com Tailwind genérico ao longo das etapas anteriores, sem reaproveitar a identidade visual definida em `prototipos/` (`prototipos/administrativo/administrativo.html` + `style.css`, e `prototipos/patio/controle-de-trilhos-patio.html`). O resultado é inconsistente entre páginas.

**Causa raiz confirmada:** a rodada anterior ("fix(ui): remove flip indevido de dark mode e aplica a identidade visual azul-aço") criou **um único** token `--steel` (#2F6690) e aplicou-o tanto no Admin quanto no Pátio. Mas o protótipo do Admin define uma paleta **diferente** (navy/azul), nunca antes extraída. `#2F6690` é a cor certa — só que exclusivamente do Pátio.

Nenhum dos dois protótipos usa a fonte atual do projeto (Geist/Arial); ambos usam **Barlow** + **Barlow Semi Condensed** (Google Fonts), nunca carregadas no app real.

## Decisão de escopo (confirmada com o usuário)

Aplicar a linguagem visual dos protótipos — cores, tipografia, Shell (menu/topbar), componentes de botão/card/badge/input — **às páginas que já existem hoje**, sem redesenhar a arquitetura de informação de cada tela. Não serão reconstruídas estruturas do protótipo que não têm equivalente real hoje: painel de Conferência com abas e layout de duas colunas, accordion de grupos com breakdown por material, tela de Exportar com preview de planilha, Histórico, Configurações com usuários/permissões. Essas continuam fora de escopo (mesmo padrão já usado para a pendência de Estoque: comentário no código + linha no relatório final, sem bloquear a entrega).

Da mesma forma, nenhum dos dois protótipos tem uma tela de login/PIN — a orientação "seguem o estilo da tela de entrada de cada protótipo" é aplicada como: usar a paleta/tipografia/componentes da área correspondente nessas páginas, não copiar um mockup de login que não existe.

## A. Tokens e tipografia

Dois conjuntos de tokens CSS, valores exatos dos protótipos, expostos via `@theme inline` (padrão já usado em `app/globals.css`):

```css
/* Admin — prototipos/administrativo/administrativo.html + style.css */
--admin-navy:#0B1B31; --admin-blue:#0F5FCC; --admin-blue-dark:#0A4BA6; --admin-blue-light:#E6EEFA;
--admin-ok:#1E8449; --admin-ok-light:#DCF2E3;
--admin-warn:#F0A020; --admin-warn-light:#FDEBCB;
--admin-bad:#C63B2E; --admin-bad-light:#FCE6E3;
--admin-line:#DFE5EC;

/* Pátio — prototipos/patio/controle-de-trilhos-patio.html */
--patio-gr:#1E262E; --patio-steel:#2F6690; --patio-steel-dark:#234E70; --patio-steel-light:#E1ECF5;
--patio-mist:#EEF1F4; --patio-line:#D5DCE3;
--patio-ok:#1F8A5B; --patio-ok-light:#DDF1E6;
--patio-warn:#E39B1B; --patio-warn-light:#FBEFD3;
--patio-bad:#C4392D; --patio-bad-light:#FBE4E1;
```

Camada **semântica** (o que os componentes compartilhados realmente consomem): `--primary`, `--primary-dark`, `--primary-light`, `--surface`, `--line`, `--ok`, `--ok-light`, `--warn`, `--warn-light`, `--bad`, `--bad-light`, `--radius-card`, `--shadow-card`. Cada área (`.area-admin` / `.area-patio`, aplicada pelo Shell ou diretamente nas páginas de login/acesso) redefine esses semânticos para a paleta certa — por cascata de CSS custom properties, sem duplicar componente. `--steel`/`--steel-dark`/`--steel-light` (hoje usados em várias páginas do Pátio) continuam existindo como alias de `--patio-steel*` — mesmo valor, sem precisar de find-replace nessas páginas.

Valores de `--radius-card`/`--shadow-card` por área (exatos dos protótipos): Admin `8px` / `0 1px 2px rgba(15,35,65,.05), 0 4px 14px -6px rgba(15,35,65,.10)`; Pátio `12px` / sem sombra (só borda, como no protótipo).

Tipografia: `Barlow` (400/500/600/700) e `Barlow_Semi_Condensed` (500/600/700) via `next/font/google` em `app/layout.tsx` (mesmo mecanismo já usado para Geist — self-hosted no build, sem dependência de rede em runtime, compatível com o service worker/PWA existente). Barlow vira `--font-sans` (corpo), Barlow Semi Condensed vira um novo token `--font-condensed` (títulos), igual aos dois protótipos.

## B. AdminShell (`components/admin/AdminShell.tsx`)

- Sidebar navy (gradiente igual ao protótipo), logo "CONTROLE DE TRILHOS", nav.
- Nav com **apenas os destinos que existem de fato hoje**: "Pendências" (→ `/admin`) e "Relatórios" (→ `/admin/relatorios`, que já inclui a exportação Excel — não existe uma rota separada de "Exportar Excel"). Os itens do protótipo sem página real (Conferência como lista própria, Histórico, Configurações) **não entram no menu** — construir um link morto seria pior do que não ter o item. Registrado como pendência conhecida no relatório final.
- Topbar com o nome do admin logado de verdade: `validarSessao`/`requireAdmin` passam a trazer `nome` junto (um `select` a mais no mesmo `findUnique` de sessão, sem query extra). Sem dropdown/menu de usuário — não existe fluxo de logout implementado hoje; construir um dropdown que não leva a lugar nenhum também vira pendência registrada, não feature nova.
- Usado pelo `app/admin/(protegido)/layout.tsx`, envolvendo `children`. `/admin/login` (fora da área protegida) usa só a paleta/tipografia (`.area-admin`), sem o Shell.

## C. PatioShell (`components/patio/PatioShell.tsx`)

- Barra escura (`--patio-gr`) com marca + badge "Pátio". Sem ícone de menu — não existe menu real para abrir no app (o do protótipo é decorativo).
- `IndicadorSincronizacao` (lógica intacta, zero mudança de comportamento) logo abaixo, só reestilizado com os tokens do Pátio.
- Usado pelo `app/patio/(protegido)/layout.tsx` no lugar da renderização direta do indicador. `/patio/acesso` usa só a paleta/tipografia (`.area-patio`), sem o Shell.

## D. Componentes compartilhados (`components/ui/`)

- **Button** — `variant: primary | secondary | ghost | danger`, `size: default | sm`, `fullWidth?: boolean` (a maioria dos botões de submit hoje é `w-full`; sem a prop, o botão é largura automática — comportamento padrão de `<button>`/`<a>`), aceita `href` (renderiza `next/link` quando presente — vários "botões" hoje são `<Link>` estilizado). Simplificação consciente: mesma escala de tamanho nas duas áreas (não replica 44px Admin vs 56px Pátio do protótipo pixel-a-pixel) — o pedido aprovado é linguagem visual, não reprodução milimétrica.
- **Card** — borda/raio/sombra via tokens semânticos.
- **Badge** — `tone: neutral | info | ok | warn | bad`. O mapeamento de status real (`AGUARDANDO_CHEGADA`/`PENDENTE_CONFERENCIA`/`CONFERIDO`, ou os estados locais do wizard) continua em cada página/componente (como `STATUS_LABEL` já existe hoje), só passa a resolver para `<Badge tone=...>` em vez de `<span>` com classe solta.
- **Input / Select** — controle puro, sem label nem erro embutidos. **Field** — wrapper que recebe `label` e `error` e compõe em volta de um `Input`/`Select` (`<Field label="E-mail" error={erro}><Input .../></Field>`), espelhando o par `.field label` + `.inp` + `.err` dos protótipos.

**Restrição não negociável:** `Button`/`Input` preservam exatamente `name`, `id`, texto visível e `role` dos elementos que substituem — os seletores que os testes automatizados (unitários e e2e) já usam hoje (`input[name="email"]`, `getByRole('button', {name:'Entrar'})`, `#f-data`, etc.) não podem quebrar.

## E. Arquivos migrados

**Admin:** `app/admin/(protegido)/layout.tsx` (envolve com `AdminShell`), `page.tsx` (pendências), `relatorios/page.tsx`, `recebimentos/[id]/page.tsx` + `ConferenciaPainel.tsx` + `DocumentoPesagemPainel.tsx`, `remetidos/[id]/page.tsx` + `NfPainel.tsx`, `remetidos/novo/page.tsx`, `app/admin/login/page.tsx` (paleta Admin, sem Shell).

**Pátio:** `app/patio/(protegido)/layout.tsx` (envolve com `PatioShell`), `page.tsx` (home), `recebimentos/novo/page.tsx` + `RecebimentoWizard.tsx`, `recebimentos/[clientId]/confirmado/page.tsx`, `remetidos/page.tsx`, `remetidos/novo/page.tsx`, `remetidos/[id]/confirmar/page.tsx` + `RemetidoWizard.tsx` (compartilhado entre os dois fluxos de remetido), `app/patio/acesso/page.tsx` (paleta Pátio, sem Shell).

`app/page.tsx` (landing com dois links) recebe tratamento neutro — não pertence a nenhuma das duas áreas, não tenta casar com nenhum dos dois protótipos.

## F. Sequenciamento

1. Fundação: tokens, fontes, `Button`/`Card`/`Badge`/`Input`. Nenhuma tela muda de aparência ainda (exceto a fonte global, efeito colateral aceitável e esperado).
2. Migrar Admin inteiro + `/admin/login`.
3. Migrar Pátio inteiro + `/patio/acesso`.
4. Verificação completa (abaixo) → deploy → reteste de produção completo.

## G. Verificação (barra alta — nada "pronto" sem prova)

1. Build local limpo depois de cada fase.
2. Suíte completa (`vitest run` + e2e) depois da migração de cada área — risco principal é o Shell novo quebrar seletor de teste (ver restrição não negociável acima).
3. Abrir **cada rota** localmente e comparar visualmente contra o protótipo correspondente, uma por uma — login admin, `/admin` (pendências), `/admin/relatorios`, `/admin/recebimentos/[id]`, `/admin/remetidos/[id]`, `/admin/remetidos/novo`, `/patio/acesso`, `/patio` (home), wizard de recebimento, `/patio/remetidos`, as duas formas de remetido (pré-cadastro→confirmar e lançamento direto).
4. Só depois disso, deploy.
5. Reteste de produção completo: todas as rotas acima de novo (não só as que tinham bug conhecido) + os 5 fluxos já validados hoje (login admin — fluxo real de autenticação, não só aparência; acesso do pátio; recebimento; remetido nas duas formas) continuam funcionando.
6. Relatório final: tabela rota por rota — o que foi testado e o resultado real. Qualquer coisa não verificável (ambiente bloqueando alguma ação) é declarada como tal, não presumida como aprovada.

## Pendências registradas (fora de escopo desta rodada)

- Itens de menu do protótipo sem página real: Conferência (como lista própria), Histórico, Configurações.
- Logout/dropdown de usuário no Admin (não existe fluxo de logout implementado).
- Fidelidade pixel-a-pixel de altura de botão por área (44px Admin / 56px Pátio no protótipo).
- Estruturas elaboradas do protótipo sem equivalente real (painel de Conferência com abas, accordion de grupos, preview de exportação) — mesmo padrão de pendência já usado para Estoque.
