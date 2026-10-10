'use client';

import { useState, useTransition } from 'react';
import { alterarAtivoAction, redefinirSenhaAction } from './actions';

export function AcoesUsuario({ id, nome, ativo, ehVoce }: { id: string; nome: string; ativo: boolean; ehVoce: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [redefinindo, setRedefinindo] = useState(false);
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function alternar() {
    if (ativo && !window.confirm(`Desativar ${nome}? A pessoa perde o acesso agora.`)) return;
    iniciar(async () => {
      const r = await alterarAtivoAction(id, !ativo);
      setMsg(r.erro ? { ok: false, texto: r.erro } : { ok: true, texto: r.sucesso ?? 'Feito.' });
    });
  }
  function salvarSenha() {
    iniciar(async () => {
      const r = await redefinirSenhaAction(id, senha);
      if (r.erro) setMsg({ ok: false, texto: r.erro });
      else {
        setMsg({ ok: true, texto: r.sucesso ?? 'Feito.' });
        setRedefinindo(false);
        setSenha('');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn h-10" disabled={pendente} onClick={() => setRedefinindo((v) => !v)}>
          Redefinir senha
        </button>
        {!ehVoce && (
          <button type="button" className="btn h-10" disabled={pendente} onClick={alternar}>
            {ativo ? 'Desativar' : 'Reativar'}
          </button>
        )}
      </div>
      {redefinindo && (
        <div className="flex flex-wrap justify-end gap-2">
          <input
            aria-label={`Nova senha de ${nome}`}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha"
            className="h-10 rounded border px-3"
            autoComplete="off"
          />
          <button type="button" className="btn btn-primary h-10" disabled={pendente || !senha} onClick={salvarSenha}>
            Salvar
          </button>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-ink-muted' : 'text-bad'}`}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}
