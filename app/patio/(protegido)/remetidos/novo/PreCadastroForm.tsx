'use client';

import { useActionState } from 'react';
import { criarPreCadastroPatioAction, type EstadoPreCadastroPatio } from './actions';
import { TIPOS_REMETIDO } from '@/lib/validation/remetido';

const ESTADO_INICIAL: EstadoPreCadastroPatio = {};

const TIPO_REMETIDO_LABEL: Record<(typeof TIPOS_REMETIDO)[number], string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export function PreCadastroForm() {
  const [estado, formAction, enviando] = useActionState(criarPreCadastroPatioAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <p className="text-sm text-ink-muted">
        Fica em &quot;Aguardando chegada&quot; até o caminhão chegar e você confirmar o carregamento. Nenhum estoque é
        alterado agora.
      </p>

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
          placeholder="Opcional — dá para completar depois"
          className="h-11"
        />
      </div>

      {estado.erro && (
        <p role="alert" className="text-sm text-bad">
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn btn-primary h-12 w-full">
        {enviando ? 'Salvando...' : 'Cadastrar e aguardar chegada'}
      </button>
    </form>
  );
}
