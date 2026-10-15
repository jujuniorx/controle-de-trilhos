'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { atualizarBancoAction } from './actions';

/** Só aparece quando o banco ainda não recebeu as últimas alterações do sistema. */
export function AtualizarBanco() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <div className="card space-y-2 border-2 border-warn p-4" role="region" aria-label="Atualização do banco de dados">
      <h2 className="card-title">Atualização pendente do banco de dados</h2>
      <p className="text-sm text-ink-muted">
        O sistema recebeu novidades (Portaria, observação do Pátio) que precisam de uma atualização no banco. Enquanto
        isso não for feito, alguns lançamentos podem ficar carregando e não chegar. É seguro tocar mais de uma vez.
      </p>
      <button
        type="button"
        className="btn btn-primary h-12"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setMsg(null);
            try {
              const r = await atualizarBancoAction();
              setMsg(r.erro ? { ok: false, texto: r.erro } : { ok: true, texto: r.sucesso ?? 'Pronto.' });
              if (!r.erro) router.refresh();
            } catch {
              setMsg({ ok: false, texto: 'Sem conexão. Tente de novo.' });
            }
          })
        }
      >
        {pendente ? 'Atualizando...' : 'Atualizar banco de dados agora'}
      </button>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}
