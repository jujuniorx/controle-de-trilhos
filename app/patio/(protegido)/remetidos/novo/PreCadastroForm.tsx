'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { preCadastroSyncSchema, TIPOS_REMETIDO } from '@/lib/validation/remetido';
import { salvarPreCadastroLocal } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';

const TIPO_REMETIDO_LABEL: Record<(typeof TIPOS_REMETIDO)[number], string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

// Tempo máximo esperando o envio antes de voltar para a lista. Com internet o envio
// leva uma fração de segundo e a lista já nasce com o remetido; sem internet (ou com
// sinal ruim) não seguramos o operador: o cadastro fica guardado no aparelho e segue
// sozinho quando a conexão voltar (IndicadorSincronizacao).
const ESPERA_ENVIO_MS = 4000;

export function PreCadastroForm() {
  const router = useRouter();
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro('');

    const form = new FormData(evento.currentTarget);
    const numeroDocumento = String(form.get('numeroDocumento') ?? '').trim();
    const parsed = preCadastroSyncSchema.safeParse({
      clientId: crypto.randomUUID(),
      tipoRemetido: form.get('tipoRemetido'),
      destino: form.get('destino'),
      numeroDocumento: numeroDocumento || undefined,
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Dados inválidos. Revise os campos.');
      return;
    }

    setSalvando(true);
    try {
      await salvarPreCadastroLocal(parsed.data);
    } catch {
      setErro('Não foi possível guardar neste aparelho. Tente de novo.');
      setSalvando(false);
      return;
    }

    await Promise.race([
      sincronizarPendentes().catch(() => undefined),
      new Promise((resolver) => setTimeout(resolver, ESPERA_ENVIO_MS)),
    ]);
    router.push('/patio/remetidos');
  }

  return (
    <form onSubmit={aoEnviar} className="mt-4 space-y-4">
      <p className="text-sm text-ink-muted">
        Fica em &quot;Aguardando chegada&quot; até o caminhão chegar e você confirmar o carregamento. Nenhum estoque é
        alterado agora. Sem internet, o cadastro fica guardado no aparelho e é enviado quando a conexão voltar.
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

      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}

      <button type="submit" disabled={salvando} className="btn btn-primary h-12 w-full">
        {salvando ? 'Salvando...' : 'Cadastrar e aguardar chegada'}
      </button>
    </form>
  );
}
