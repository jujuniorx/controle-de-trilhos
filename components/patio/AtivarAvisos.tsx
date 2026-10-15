'use client';

import { useEffect, useState } from 'react';

type Situacao = 'carregando' | 'indisponivel' | 'desligado' | 'ligado' | 'bloqueado';

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchida = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(preenchida);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/** Botão para ligar os avisos neste aparelho (tablet do Pátio ou aparelho da Portaria). */
export function AtivarAvisos({
  chavePublica,
  titulo = 'Avisos da Portaria',
  descricao = 'Receba um aviso neste aparelho quando a Portaria registrar a chegada de um caminhão.',
}: {
  chavePublica: string | null;
  titulo?: string;
  descricao?: string;
}) {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const suporta = chavePublica && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!suporta) return void (!cancelado && setSituacao('indisponivel'));
      if (Notification.permission === 'denied') return void (!cancelado && setSituacao('bloqueado'));
      try {
        const reg = await navigator.serviceWorker.ready;
        const inscricao = await reg.pushManager.getSubscription();
        if (!cancelado) setSituacao(inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado');
      } catch {
        if (!cancelado) setSituacao('desligado');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [chavePublica]);

  async function ligar() {
    setErro('');
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') return setSituacao(permissao === 'denied' ? 'bloqueado' : 'desligado');
      const reg = await navigator.serviceWorker.ready;
      const inscricao =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica as string) }));
      const resposta = await fetch('/api/push/inscrever', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inscricao.toJSON()),
      });
      if (!resposta.ok) throw new Error('falha');
      setSituacao('ligado');
    } catch {
      setErro('Não foi possível ligar os avisos agora. Tente de novo com internet.');
    }
  }

  async function desligar() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao) {
        await fetch('/api/push/inscrever', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: inscricao.endpoint }),
        });
        await inscricao.unsubscribe();
      }
      setSituacao('desligado');
    } catch {
      setErro('Não foi possível desligar agora.');
    }
  }

  if (situacao === 'carregando') return null;

  return (
    <div className="card mt-4 space-y-2">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {situacao === 'indisponivel' && (
        <p className="text-sm text-ink-muted">
          Os avisos no aparelho não estão disponíveis aqui (no iPhone/iPad, instale o app na tela inicial). A tela
          se atualiza sozinha.
        </p>
      )}
      {situacao === 'bloqueado' && (
        <p className="text-sm text-ink-muted">Os avisos estão bloqueados neste aparelho. Libere as notificações nas configurações do navegador.</p>
      )}
      {situacao === 'desligado' && (
        <>
          <p className="text-sm text-ink-muted">{descricao}</p>
          <button type="button" className="btn btn-primary h-12" onClick={() => void ligar()}>
            Ligar avisos neste aparelho
          </button>
        </>
      )}
      {situacao === 'ligado' && (
        <div className="flex items-center justify-between gap-2">
          <span className="badge badge-ok">Avisos ligados</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void desligar()}>
            Desligar
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
