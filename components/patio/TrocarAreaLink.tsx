'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/offline/db';

/**
 * "Trocar área": se há um lançamento de recebimento em andamento neste aparelho, pede
 * confirmação antes de sair (o rascunho fica guardado, mas é fácil tocar por engano).
 */
export function TrocarAreaLink({ className, children, rotulo }: { className?: string; children: ReactNode; rotulo?: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);

  async function aoTocar() {
    let emAndamento = false;
    try {
      emAndamento = (await db.rascunhosRecebimento.count()) > 0;
    } catch {
      emAndamento = false;
    }
    if (emAndamento) setConfirmando(true);
    else router.push('/');
  }

  return (
    <>
      <button type="button" className={className} aria-label={rotulo} title={rotulo} onClick={() => void aoTocar()}>
        {children}
      </button>
      {confirmando && (
        <div role="alertdialog" aria-modal="true" aria-label="Sair com lançamento em andamento" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-sm space-y-3">
            <p className="font-semibold text-ink">Há um lançamento em andamento.</p>
            <p className="text-sm text-ink-muted">Ele fica guardado neste aparelho e você retoma de onde parou. Trocar de área agora?</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost h-12 flex-1" onClick={() => setConfirmando(false)} autoFocus>
                Continuar aqui
              </button>
              <button type="button" className="btn btn-primary h-12 flex-1" onClick={() => router.push('/')}>
                Trocar área
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
