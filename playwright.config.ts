import { loadEnvConfig } from '@next/env';
import { defineConfig } from '@playwright/test';

// Next.js carrega .env/.env.local automaticamente para o dev server que o
// webServer sobe; mas os próprios arquivos de spec importam `prisma`
// diretamente (ex. afterAll de limpeza) e rodam fora do Next — sem isso,
// essas chamadas falham com "DATABASE_URL not found". Usa @next/env (não
// `dotenv` puro) para ler os arquivos com a MESMA semântica do Next —
// inclusive a expansão de "$NOME" (dotenv-expand por baixo): um
// `dotenv.config()` comum não desfaz o escape "\$" exigido em
// PATIO_PIN_HASH (ver .env.example) e carregaria o hash Argon2id
// corrompido no processo deste config — e, se o webServer abaixo tiver que
// subir o próprio `npm run dev` (em vez de reaproveitar um já rodando),
// esse processo filho herdaria o valor já corrompido.
loadEnvConfig(process.cwd(), true);

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
