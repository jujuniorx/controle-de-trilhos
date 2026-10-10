import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 (compatível com S3). Ver relatório da etapa: credenciais reais
// ainda pendentes — R2_ENDPOINT/R2_FORCE_PATH_STYLE só existem para apontar
// para um S3 compatível local (scripts/s3-mock.ts) durante testes.
function endpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('Storage de documentos não configurado: defina R2_ACCOUNT_ID.');
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function client(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Storage de documentos não configurado: defina R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY.');
  }
  return new S3Client({
    region: 'auto',
    endpoint: endpoint(),
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE !== 'false',
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucket(): string {
  const nome = process.env.R2_BUCKET_NAME;
  if (!nome) throw new Error('Storage de documentos não configurado: defina R2_BUCKET_NAME.');
  return nome;
}

export async function enviarArquivoR2(chave: string, bytes: Buffer, contentType: string): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: chave, Body: bytes, ContentType: contentType }));
}

export async function gerarUrlTemporariaR2(chave: string, expiraEmSegundos = 300): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: chave }), { expiresIn: expiraEmSegundos });
}
