'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmar2faAction, desativar2faAction, iniciar2faAction } from './actions';

export function Painel2fa({ ativo, disponivel }: { ativo: boolean; disponivel: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [segredo, setSegredo] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');

  function comecar() {
    setErro(null);
    iniciar(async () => {
      const r = await iniciar2faAction();
      if (r.ok && r.segredo) {
        setSegredo(r.segredo);
        setUri(r.uri ?? null);
      } else setErro(r.erro ?? 'Não foi possível iniciar.');
    });
  }
  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await confirmar2faAction(codigo);
      if (r.ok) {
        setSegredo(null);
        setCodigo('');
        router.refresh();
      } else setErro(r.erro ?? 'Código incorreto.');
    });
  }
  function desativar() {
    setErro(null);
    iniciar(async () => {
      const r = await desativar2faAction(senha, codigo);
      if (r.ok) {
        setCodigo('');
        setSenha('');
        router.refresh();
      } else setErro(r.erro ?? 'Não foi possível desativar.');
    });
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="card-title !mb-0">Verificação em duas etapas</h2>
        <span className={`badge ${ativo ? 'badge-ok' : 'badge-muted'}`}>{ativo ? 'Ativa' : 'Desativada'}</span>
      </div>

      {!ativo && !segredo && (
        <>
          <p className="text-sm text-ink-muted">
            Além da senha, o login passa a pedir um código de 6 dígitos de um app autenticador (Google Authenticator,
            Microsoft Authenticator, Authy). Mesmo que alguém descubra a senha, não entra sem o seu celular.
          </p>
          {!disponivel && (
            <p className="text-sm text-warn">
              Ainda não está configurado no servidor. Quem administra o sistema precisa definir a variável TOTP_ENC_KEY na Vercel.
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={comecar} disabled={pendente || !disponivel}>
            Ativar verificação em duas etapas
          </button>
        </>
      )}

      {!ativo && segredo && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>No app autenticador, escolha <b>adicionar conta</b> e <b>inserir chave de configuração</b>.</li>
            <li>Nome da conta: <b>Controle de Trilhos</b>. Chave (tipo: baseada em tempo):</li>
          </ol>
          <p className="break-all rounded-xl border border-line-2 bg-surface-2 p-3 font-mono text-base tracking-wider text-ink">{segredo}</p>
          {uri && (
            <p className="text-xs text-ink-dim">
              No celular, você também pode tocar aqui para abrir direto no app: <a className="underline" href={uri}>abrir no autenticador</a>.
            </p>
          )}
          <div className="field">
            <label htmlFor="cod-ativar">Código mostrado no app</label>
            <input id="cod-ativar" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="h-12 text-center text-xl tracking-widest" />
          </div>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={pendente || codigo.replace(/\s/g, '').length < 6}>
            Confirmar e ativar
          </button>
        </div>
      )}

      {ativo && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            O login pede o código do app. Para desativar, confirme a senha e um código atual.
            Se perder o celular, quem administra o servidor pode desativar pelo script <code>scripts/desativar-2fa.ts</code>.
          </p>
          <div className="field">
            <label htmlFor="senha-desativar">Senha</label>
            <input id="senha-desativar" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-12" />
          </div>
          <div className="field">
            <label htmlFor="cod-desativar">Código atual do app</label>
            <input id="cod-desativar" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="h-12 text-center text-xl tracking-widest" />
          </div>
          <button type="button" className="btn btn-danger" onClick={desativar} disabled={pendente || !senha || codigo.replace(/\s/g, '').length < 6}>
            Desativar
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
