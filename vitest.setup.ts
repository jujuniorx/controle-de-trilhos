import { loadEnvConfig } from '@next/env';

// Next.js carrega .env/.env.local automaticamente; o Vitest não — sem isso,
// qualquer teste que toque o Prisma falha com "DATABASE_URL not found". Usa
// @next/env (não `dotenv` puro) para ler os arquivos com a MESMA semântica
// do Next — inclusive a expansão de "$NOME" (dotenv-expand por baixo). Um
// `dotenv.config()` comum não desfaz o escape "\$" exigido em PATIO_PIN_HASH
// (ver .env.example) e carregaria o hash Argon2id corrompido.
loadEnvConfig(process.cwd(), true);

import '@testing-library/jest-dom/vitest';
