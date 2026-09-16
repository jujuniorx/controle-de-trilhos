# Controle de Trilhos — Spec de Design: Etapa 1 (Fundação)

- Data: 2026-09-16
- Status: todas as decisões da Etapa 1 confirmadas — aguardando revisão do plano de implementação e autorização explícita para começar
- Escopo deste documento: **apenas a Etapa 1 (Fundação)**. Etapas 2–5 são citadas só como contexto de roadmap (seção 15).
- PostgreSQL gerenciado: **Neon** (confirmado em 2026-09-16)

## 1. Contexto e objetivo

O Controle de Trilhos substitui o controle manual (planilhas/folhas de papel) da movimentação de trilhos, começando pelo fluxo de Recebimentos, com arquitetura já preparada para Remetidos. Uma única aplicação, duas áreas de acesso (Pátio e Administrativo), base de dados e lógica de domínio compartilhadas — nunca dois sistemas separados.

Esta etapa entrega a fundação: arquitetura, banco de dados, autenticação, permissões, PWA/offline, sincronização, entidades principais (Movimentação/Grupo/Medição) e auditoria. As telas de negócio completas (criar Recebimento, painel administrativo, Remetidos, exportação) são das Etapas 2–5.

## 2. Fora de escopo desta etapa

- Telas completas de criação de Recebimento/Remetido (Etapa 2 / Etapa 4).
- Painel administrativo completo — busca, filtros, correção, gestão de usuários (Etapa 3).
- Upload real de anexos e escolha definitiva do provedor de storage (Etapa 3 — ver seção 8).
- Fluxo de peso pendente da sucata em Remetidos (a UI é da Etapa 4; o schema já é preparado agora).
- Recuperação de senha por e-mail (entra junto da gestão de usuários, Etapa 3 — ver seção 6).
- Exportação para Excel (Etapa 5).
- Qualquer papel administrativo além de `ADMIN`.
- Tratamento detalhado de vagão (apenas o enum existe; sem campos adicionais).
- Resolução de conflito bidirecional de sincronização (o fluxo é unidirecional: Pátio cria uma vez, só o Administrativo edita depois).

## 3. Identidade visual

A imagem de referência é usada **apenas como referência estética** (composição, hierarquia, paleta escura/industrial, tipografia editorial, cards, tabelas, navegação). **Nenhum logo, símbolo ou elemento de marca da Rumo será usado** — a autorização existente cobre construir o sistema, não reproduzir a identidade visual oficial da empresa. O Controle de Trilhos terá nome, wordmark e paleta próprios.

Nesta etapa, o único entregável visual é a configuração inicial do design system (tokens de cor, tipografia, espaçamento e raio no Tailwind) — sem telas de negócio finalizadas ainda.

## 4. Arquitetura

Aplicação única em Next.js (App Router), com duas áreas de rota compartilhando o mesmo domínio de dados:

```
Movimentacao (RECEBIMENTO | REMETIDO)
  → Grupo (perfil + tipo de material + classificação)
    → Medicao (individual ou quantidade × comprimento)
```

Recebimento e Remetido são a mesma entidade `Movimentacao`, diferenciada pelo campo `tipo`. Os poucos campos exclusivos de Remetido ficam em `RemetidoDetalhe` (relação 1:1), evitando duplicar o sistema.

## 5. Stack tecnológica

- **Next.js (App Router) + TypeScript** — rotas `/(patio)` (mobile-first) e `/(admin)` (desktop-first) sobre os mesmos serviços de domínio.
- **PostgreSQL gerenciado + Prisma** (ver decisão pendente na seção 14).
- **Tailwind CSS + shadcn/ui (Radix)** — componentes acessíveis, re-estilizados com identidade própria.
- **PWA**: manifest próprio + Service Worker (Workbox) para o app shell.
- **Dexie.js** (camada sobre IndexedDB) para a fila offline do Pátio.
- **Zod** para validação compartilhada entre formulário e servidor.
- **Argon2id** para hash de senha e do PIN do Pátio.
- **Vitest** (unitário) + **Playwright** (integração, E2E, offline, responsivo).

## 6. Modelo de dados (fundação completa)

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
  identificador String    @unique  // email ou IP
  tentativas    Int       @default(0)
  bloqueadoAte  DateTime?
  atualizadoEm  DateTime  @updatedAt
}

model Movimentacao {
  id               String              @id @default(cuid())
  clientId         String              @unique   // gerado no dispositivo, chave de idempotência
  tipo             TipoMovimentacao
  tipoDocumento    String
  numeroDocumento  String
  tipoTransporte   TipoTransporte
  placaCavalo      String?
  placaCarreta     String?
  origem           String?             // texto livre — uso em RECEBIMENTO
  destino          String?             // texto livre — uso em REMETIDO
  responsavelPatio String              // nome informado no lançamento, não é login
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
  classificacao  ClassificacaoReemprego?  // só quando tipoMaterial = REEMPREGO
  fabricante     String?                  // texto livre — só quando tipoMaterial = NOVO
  metrosTotal    Decimal       @default(0)
  pesoCalculado  Decimal       @default(0)  // metros × (nº do perfil / 1000), 3 casas
  statusPeso     StatusPeso    @default(CALCULADO)
  pesoReal       Decimal?                    // 3 casas — preenchido pelo Administrativo

  medicoes       Medicao[]
  anexos         Anexo[]
}

model Medicao {
  id              String        @id @default(cuid())
  clientId        String        @unique
  grupoId         String
  grupo           Grupo         @relation(fields: [grupoId], references: [id])
  modo            ModoMedicao
  quantidade      Int           @default(1)   // = 1 no modo INDIVIDUAL
  comprimento     Decimal
  metros          Decimal                     // = quantidade × comprimento
  classificacaoSC ClassificacaoSC?            // calculado — só quando grupo.tipoMaterial = SUCATA
}

model Anexo {
  id             String        @id @default(cuid())
  movimentacaoId String
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  grupoId        String?                      // opcional: liga o anexo a um grupo específico
  grupo          Grupo?        @relation(fields: [grupoId], references: [id])
  tipo           String                       // DOCUMENTO_PESAGEM, OUTRO
  url            String
  uploadedById   String
  uploadedAt     DateTime      @default(now())
}

model HistoricoAlteracao {
  id             String        @id @default(cuid())
  movimentacaoId String
  movimentacao   Movimentacao  @relation(fields: [movimentacaoId], references: [id])
  usuarioId      String?       // nulo quando a ação é do Pátio
  usuarioNome    String
  acao           String        // CRIACAO, EDICAO, CONFERENCIA, ANEXO, PESO_INFORMADO
  campo          String?
  valorAntigo    String?
  valorNovo      String?
  timestamp      DateTime      @default(now())
}
```

Decisões de modelagem que respondem diretamente ao que você definiu hoje:

- **Fator do perfil não é uma tabela**: `pesoCalculado = metros × (número extraído de PerfilTrilho ÷ 1000)`, calculado em código — só o enum `PerfilTrilho` valida a entrada.
- **Peso da sucata em Remetidos não bloqueia nada**: `Grupo.statusPeso` é totalmente independente de `Movimentacao.status`. Uma movimentação pode ficar `CONFERIDO` mesmo com um grupo em `statusPeso = PENDENTE`; a UI (Etapa 3/4) mostra isso como um indicador, não como um impedimento.
- **Nível da pesagem deixado em aberto, sem retrabalho**: mantive `pesoReal`/`statusPeso` no `Grupo` como hipótese de trabalho, mas `Anexo` já aceita `grupoId` nulo — ou seja, um documento de pesagem pode representar um grupo específico OU a movimentação inteira sem mudar o schema. Se confirmarmos antes da Etapa 4 que a pesagem é sempre do carregamento inteiro, movemos `pesoReal`/`statusPeso` para `Movimentacao` — migração simples, sem dado real em risco ainda.
- **Fabricante é texto livre** (`String?` em `Grupo`), sem enum fechado; a UI vai sugerir "ARCELORMITTAL" e "PANGANG 4" via autocomplete, mas aceita qualquer valor.
- **Um único `Medicao` cobre os dois modos de lançamento**: `quantidade = 1` no modo individual, `quantidade = N` no modo quantidade×comprimento — evita duas tabelas para o mesmo conceito.
- **SC-1/2/3 é calculado por medição**, não por grupo, porque um mesmo grupo de sucata pode ter peças de comprimentos diferentes caindo em faixas diferentes.

## 7. Autenticação e permissões

**Administrativo** — e-mail + senha, hash Argon2id, sessão registrada em `Session` (permite revogação server-side, ex. ao trocar senha), cookie `httpOnly` + `Secure` + `SameSite=Lax`. Bloqueio progressivo por tentativas falhas via `LoginAttempt` (identificador = e-mail ou IP). Único papel `Role.ADMIN` nesta etapa — sem hierarquia adicional, conforme definido. O primeiro usuário Administrativo é criado por script de seed (lê credenciais de variáveis de ambiente), não há autorregistro público.

**Pátio** — protegido por um **código/PIN de acesso único**, que é uma barreira de entrada à área `/patio`, não uma identificação individual:
1. Ao acessar `/patio` sem um cookie de acesso válido, o usuário vê uma tela pedindo o PIN.
2. O servidor compara o PIN informado com o hash (Argon2id) guardado em configuração/variável de ambiente.
3. Se correto, um cookie `httpOnly` de longa duração é gravado, liberando as rotas `/patio/*` no middleware.
4. O nome do responsável continua sendo pedido em **cada lançamento** (`Movimentacao.responsavelPatio`) — o PIN nunca substitui essa identificação.
5. Trocar o PIN é só atualizar a configuração; nenhuma tela de administração de PIN é necessária nesta etapa.

Autorização sempre revalidada no servidor (middleware + checagem em cada ação), nunca só escondida na UI. IDs não sequenciais (`cuid`) para reduzir risco de IDOR por enumeração.

## 8. PWA e estratégia offline/sincronização

- **Manifest** próprio (nome, ícones, `display: standalone`, tema escuro) e **Service Worker** (Workbox) cacheando o app shell — só leitura passa pelo Service Worker; a escrita não depende de Background Sync (incompatível com Safari/iOS).
- **Local-first**: toda criação no Pátio grava primeiro no IndexedDB (via Dexie), com um `clientId` (UUID) gerado no dispositivo — isso é o que garante "não perder dado se o app fechar ou a conexão cair", porque a gravação local é síncrona e ocorre antes de qualquer tentativa de rede.
- **Fila de sincronização**: processa os pendentes do IndexedDB quando a conexão volta (`online` event), quando o app volta ao primeiro plano, em retentativas periódicas enquanto o app está aberto, e sob comando manual do usuário ("sincronizar agora").
- **Idempotência**: o servidor faz upsert por `clientId` em `Movimentacao`, `Grupo` e `Medicao` — reenviar o mesmo registro nunca duplica.
- **Indicação visual**: banner de offline (`navigator.onLine` + eventos `online`/`offline`) e contador de "X aguardando sincronização".
- **Conflitos**: o fluxo é unidirecional (Pátio cria uma única vez → Administrativo edita depois), então não há edição concorrente do mesmo registro por dois lados — não é necessária uma estratégia de merge/last-write-wins nesta etapa.

## 9. Auditoria

Toda criação e alteração relevante grava uma linha em `HistoricoAlteracao` (quem — usuário ou nome do Pátio —, quando, o quê mudou, valor antigo/novo). Nada é apagado silenciosamente; correções geram novas entradas de histórico, nunca sobrescrevem o rastro anterior.

## 10. Segurança (fundação)

- Senhas e PIN: Argon2id. Sessões administrativas revogáveis via tabela `Session`.
- Rate limiting/bloqueio progressivo de login via `LoginAttempt`.
- Autorização centralizada (middleware + Server Actions), nunca só no cliente.
- Validação de entrada com Zod em toda fronteira.
- CORS restrito à própria origem; sem consumo externo cross-origin previsto.
- Headers de segurança (CSP, X-Content-Type-Options, Referrer-Policy, HSTS em produção) via middleware.
- XSS mitigado pelo escaping padrão do React + CSP; nunca `dangerouslySetInnerHTML` com dado de usuário.
- SQL Injection mitigado pelas queries parametrizadas do Prisma.
- CSRF: cookies `SameSite`, validação de `Origin` nas mutações (Server Actions do Next já fazem isso nativamente).
- Segredos via variáveis de ambiente, nunca hardcoded.
- Checkpoint com a skill `security-review` ao final da etapa, mapeado contra OWASP ASVS 5.0 (V2 Autenticação, V3 Sessão, V4 Controle de acesso, V5 Validação) e OWASP Top 10.

## 11. Estrutura de pastas

```
/app
  /(patio)/...        # gate de PIN, mobile-first
  /(admin)/...        # painel autenticado, desktop-first
  /api/sync
/lib
  /services            # movimentacao, grupo, medicao, calculo, auth
  /validation           # schemas Zod compartilhados
  /offline              # Dexie schema, motor de sincronização
  /db                   # Prisma client
/prisma
  schema.prisma
  seed.ts               # cria o primeiro usuário ADMIN
/components
  /ui        # primitivos shadcn com identidade própria (sem marca Rumo)
  /shared
/public
  manifest.json, sw.js, ícones
/tests
  /unit (Vitest)
  /integration
  /e2e (Playwright, incl. offline/)
```

## 12. Estratégia de testes da Etapa 1

- **Unitários**: fator/peso (3 casas), soma de metros, limites exatos de SC-1/2/3 (6,99/7,00 e 2,99/3,00), validação "reemprego ≥ 7m", geração/validação de `clientId`.
- **Integração**: login (sucesso/falha/bloqueio), revogação de sessão, gate de PIN do Pátio (acesso negado sem PIN, liberado após PIN correto), upsert idempotente por `clientId` (teste de duplicidade).
- **Offline (Playwright)**: emular rede offline, criar registro, confirmar persistência local, reconectar, confirmar sincronização sem duplicata.
- **Segurança**: rota `/admin` bloqueada sem sessão, rota `/patio` bloqueada sem PIN, headers de segurança presentes nas respostas.

## 13. Critérios de conclusão (Definition of Done) da Etapa 1

- [ ] Projeto Next.js + TypeScript + Tailwind + Prisma configurado, repositório git com histórico limpo.
- [ ] Schema acima migrado no Postgres definido (seção 14).
- [ ] Login administrativo funcional (sucesso, falha, bloqueio por tentativas, logout, revogação de sessão).
- [ ] Gate de PIN do Pátio funcional, com cookie de acesso.
- [ ] PWA instalável, com Service Worker ativo e app shell funcionando offline.
- [ ] Fila offline (Dexie) funcional: criar localmente, sincronizar ao reconectar, sem duplicar.
- [ ] `HistoricoAlteracao` gravando criação de registros.
- [ ] Headers de segurança e CORS configurados.
- [ ] Todos os testes da seção 12 escritos e passando.
- [ ] Checkpoint de `security-review` sem pendências críticas.

## 14. Decisões confirmadas

Todas as decisões necessárias para iniciar a Etapa 1 estão fechadas:

- **PostgreSQL gerenciado: Neon.** Confirmado — Postgres serverless, branching de banco para desenvolvimento/preview, connection pooling nativo para funções serverless.
- **ORM: Prisma**, conforme proposto.
- **Acesso do Pátio: PIN compartilhado** + nome do responsável por lançamento (seção 7).
- **Administrativo: papel único `ADMIN`**, sem hierarquia adicional (seção 7).
- **Fabricante: texto livre com sugestões**, sem lista fechada (seção 6).
- **Offline: local-first com Dexie/IndexedDB**, sincronização por `clientId` (seção 8).
- **Peso pendente de sucata em Remetidos não bloqueia o registro** (`statusPeso` independente de `Movimentacao.status`, seção 6).

Nada mais bloqueia o início. O que segue formalmente adiado, sem impedir a Etapa 1:

- **Storage de anexos** — decisão adiada para a Etapa 3. Comparativo objetivo entre as opções que fazem sentido para este projeto:

  | Critério | Vercel Blob | Cloudflare R2 | Supabase Storage |
  |---|---|---|---|
  | Segurança | Boa — token de acesso, modelo de permissão simples | Ótima — privado por padrão, compatível S3, políticas finas | Boa — políticas por bucket, privado por padrão |
  | Integração | Trivial — SDK oficial, zero-config na Vercel | Simples — SDK S3 padrão, bem documentado | Simples, mas amarra a escolha ao Supabase como banco |
  | Custo | Armazenamento + banda; cresce com uso de imagens/documentos | Sem taxa de saída (egress) — relevante pois documentos de pesagem serão reabertos várias vezes na conferência | Camada gratuita generosa; custo cresce com o projeto todo |
  | Privado por padrão | Sim | Sim | Sim |
  | URLs assinadas/temporárias | Sim | Sim (presigned URL padrão S3) | Sim |
  | Compatibilidade/portabilidade | Atrelado à Vercel como host | Independente do host, funciona com qualquer backend Node | Atrelado ao Supabase como banco |

  **Recomendação objetiva: Cloudflare R2** — custo previsível sem taxa de saída, e mantém a escolha de storage independente da escolha de hospedagem/banco. Vercel Blob é a alternativa mais simples operacionalmente se preferirem reduzir contas/serviços. Nenhuma implementação será feita agora.

- **Recuperação de senha por e-mail** — não faz parte da Etapa 1; entra junto da gestão de usuários (Etapa 3), quando houver mais de um Administrativo. Até lá, o primeiro usuário é criado/recriado via script de seed.
- **Nível da pesagem (grupo vs. carregamento inteiro)** — mantido em aberto conforme pedido; o schema já suporta os dois cenários sem retrabalho (seção 6).

## 15. Roadmap (contexto, fora do escopo desta spec)

- **Etapa 2** — Recebimentos (fluxo completo do Pátio).
- **Etapa 3** — Administrativo (listagem, busca/filtros, conferência, correção, anexos, histórico, usuários, recuperação de senha).
- **Etapa 4** — Remetidos (campos específicos, fluxo de peso pendente da sucata).
- **Etapa 5** — Exportação Excel, testes finais, revisão e auditoria de segurança completa.

Cada etapa só avança após testes passando e sua validação explícita.
