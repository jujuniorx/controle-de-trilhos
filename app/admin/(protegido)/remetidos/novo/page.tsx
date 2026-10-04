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
      <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-1 text-xl font-semibold">Novo remetido — pré-cadastro</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Fica em &quot;Aguardando chegada&quot; até o Pátio confirmar o carregamento. Nenhum estoque é alterado agora.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="tipoRemetido">
            Tipo de remetido
          </label>
          <select
            id="tipoRemetido"
            name="tipoRemetido"
            required
            className="mt-1 h-11 w-full rounded border px-3"
            defaultValue=""
          >
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

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="reservaPedido">
            Reserva/Pedido
          </label>
          <input id="reservaPedido" name="reservaPedido" required className="mt-1 h-11 w-full rounded border px-3" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="destino">
            Destino
          </label>
          <input id="destino" name="destino" required className="mt-1 h-11 w-full rounded border px-3" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="numeroDocumento">
            Nota fiscal (se já souber)
          </label>
          <input
            id="numeroDocumento"
            name="numeroDocumento"
            inputMode="numeric"
            placeholder="Opcional — o Pátio ou o Administrativo completam depois"
            className="mt-1 h-11 w-full rounded border px-3"
          />
        </div>

        {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="h-12 w-full rounded bg-neutral-900 font-medium text-white disabled:bg-neutral-300"
        >
          {enviando ? 'Salvando...' : 'Criar pré-cadastro'}
        </button>
      </form>
    </main>
  );
}
