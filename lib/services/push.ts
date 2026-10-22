import { prisma } from '@/lib/db';

export interface AvisoPush {
  titulo: string;
  corpo: string;
  /** Tela que abre ao tocar no aviso. */
  url: string;
}

/** Chaves VAPID (web push). Sem elas o aviso no tablet fica desligado, mas o resto do sistema funciona. */
export function pushConfigurado(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function chavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export type SetorPush = 'PATIO' | 'PORTARIA' | 'ADMIN';

export async function salvarInscricaoPush(endpoint: string, p256dh: string, auth: string, setor: SetorPush = 'PATIO'): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, setor },
    update: { p256dh, auth, setor },
  });
}

export async function removerInscricaoPush(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Envia o aviso para todos os aparelhos inscritos do setor (Pátio por padrão, ou Portaria). NUNCA lança: o aviso é um
 * extra — se falhar, a liberação já feita continua valendo (o Pátio também vê pela tela).
 * Devolve quantos aparelhos foram avisados.
 */
export async function enviarAvisoPush(aviso: AvisoPush, setor: SetorPush = 'PATIO'): Promise<number> {
  if (!pushConfigurado()) return 0;
  try {
    // web-push é CommonJS e exporta uma instância: dependendo do empacotador ela vem em `.default` ou direto.
    const modulo = await import('web-push');
    const webpush = (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:contato@tec-rail.com.br',
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    const inscricoes = await prisma.pushSubscription.findMany({ where: { setor } });
    const carga = JSON.stringify(aviso);
    let enviados = 0;
    await Promise.all(
      inscricoes.map(async (i) => {
        try {
          await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, carga, {
            TTL: 60 * 60,
            urgency: 'high',
          });
          enviados += 1;
        } catch (erro) {
          const status = (erro as { statusCode?: number }).statusCode;
          // 404/410: o aparelho cancelou ou a inscrição expirou — limpa para não tentar de novo.
          if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: i.id } });
          else console.error('[push] falha ao avisar um aparelho', status ?? erro);
        }
      }),
    );
    return enviados;
  } catch (erro) {
    console.error('[push] falha ao enviar avisos', erro);
    return 0;
  }
}
