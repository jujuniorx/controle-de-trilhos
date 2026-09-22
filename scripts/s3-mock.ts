// Servidor S3 compatível local, só para desenvolvimento/testes — não usar em
// produção. Substitui o Cloudflare R2 real quando não há credenciais
// configuradas, para permitir testar o fluxo de upload/download de verdade
// (mesmo código do lib/storage/r2.ts) sem depender de nenhuma conta externa.
//
// Uso manual: `npx tsx scripts/s3-mock.ts`
// Uso em testes: importar `iniciarS3Mock`/`pararS3Mock` (ver tests/integration/documentoPesagem.test.ts).
import S3rver from 's3rver';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const S3_MOCK_PORT = Number(process.env.S3_MOCK_PORT ?? 4569);
export const S3_MOCK_BUCKET = process.env.R2_BUCKET_NAME || 'controle-trilhos-dev';

export async function iniciarS3Mock(): Promise<S3rver> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's3-mock-'));
  const server = new S3rver({
    port: S3_MOCK_PORT,
    address: 'localhost',
    silent: true,
    directory: dir,
    configureBuckets: [{ name: S3_MOCK_BUCKET, configs: [] }],
  });
  await server.run();
  return server;
}

export async function pararS3Mock(server: S3rver): Promise<void> {
  await server.close();
}

export function envS3Mock(): Record<string, string> {
  return {
    R2_ENDPOINT: `http://localhost:${S3_MOCK_PORT}`,
    R2_FORCE_PATH_STYLE: 'true',
    R2_ACCESS_KEY_ID: 'S3RVER',
    R2_SECRET_ACCESS_KEY: 'S3RVER',
    R2_BUCKET_NAME: S3_MOCK_BUCKET,
  };
}

const executadoDiretamente = process.argv[1]?.endsWith('s3-mock.ts') ?? false;
if (executadoDiretamente) {
  iniciarS3Mock().then(() => {
    console.log(`S3 mock local rodando em http://localhost:${S3_MOCK_PORT} (bucket "${S3_MOCK_BUCKET}"). Ctrl+C para parar.`);
  });
}
