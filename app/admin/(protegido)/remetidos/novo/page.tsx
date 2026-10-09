'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { criarPreCadastroRemetidoAction, type EstadoPreCadastroRemetido } from './actions';
import { TIPOS_REMETIDO } from '@/lib/validation/remetido';

const ESTADO_INICIAL: EstadoPreCadastroRemetido = {};

const TIPO_REMETIDO_LABEL: Record<(typeof TIPOS_REMETIDO)[number], string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default function NovoRemetidoPage() {
  const [estado, formAction, enviando] = useActionState(criarPreCadastroRemetidoAction, ESTADO_INICIAL);

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href="/admin" className="back-link">
        ← Voltar
      </Link>
      <h1 className="mt-1 font-condensed text-xl font-bold uppercase tracking-wide text-ink">Novo remetido — pré-cadastro</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Fica em &quot;Aguardando chegada&quot; até o Pátio confirmar o carregamento. Nenhum estoque é alterado agora.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="tipoRemetido">Tipo de remetido</label>
          <select id="tipoRemetido" name="tipoRemetido" required className="h-11" defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {TIPOS_REMETIDO.map((t) => (
              <option key={t} value={t}>
                {TIPO_REMETIDO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="reservaPedido">Reserva/Pedido</label>
          <input id="reservaPedido" name="reservaPedido" required className="h-11" />
        </div>

        <div className="field">
          <label htmlFor="destino">Destino</label>
          <input id="destino" name="destino" required className="h-11" />
        </div>

        <div className="field">
          <label htmlFor="numeroDocumento">Nota fiscal (se já souber)</label>
          <input
            id="numeroDocumento"
            name="numeroDocumento"
            inputMode="numeric"
            placeholder="Opcional — o Pátio ou o Administrativo completam depois"
            className="h-11"
          />
        </div>

        {estado.erro && <p role="alert" className="text-sm text-bad">{estado.erro}</p>}

        <button type="submit" disabled={enviando} className="btn btn-primary h-12 w-full">
          {enviando ? 'Salvando...' : 'Criar pré-cadastro'}
        </button>
      </form>
    </main>
  );
}
