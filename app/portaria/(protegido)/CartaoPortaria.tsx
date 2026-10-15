'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { liberarCarretaAction, salvarDadosAction, type ResultadoPortaria } from './actions';
import { ROTULO_ESTADO } from '@/lib/domain/portaria';
import type { ItemPortaria } from '@/lib/services/portaria';

const TIPO_REMETIDO: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };
const BADGE = { MEDINDO: 'badge-muted', AGUARDANDO_CARRETA: 'badge-warn', LIBERADA: 'badge-ok' } as const;

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function CartaoPortaria({ item }: { item: ItemPortaria }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_CARRETA');
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: item.motoristaCpf ?? '',
    motoristaTelefone: item.motoristaTelefone ?? '',
    placaCarreta: item.placaCarreta ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    origem: item.origem ?? '',
    destino: item.destino ?? '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacaoPortaria ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const liberada = item.estado === 'LIBERADA';
  const medindo = item.estado === 'MEDINDO';

  function enviar(acao: (id: string, dados: unknown) => Promise<ResultadoPortaria>) {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await acao(item.id, v);
        setResultado(r);
        if (r.ok) router.refresh();
      } catch {
        setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
      }
    });
  }

  const campo = (id: keyof typeof v, rotulo: string, extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number; className?: string } = {}) => (
    <div className={`field ${extra.className ?? ''}`}>
      <label htmlFor={`${item.id}-${id}`}>{rotulo}</label>
      <input
        id={`${item.id}-${id}`}
        value={v[id]}
        onChange={set(id)}
        className="h-12"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        autoComplete="off"
        disabled={pendente}
      />
    </div>
  );

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
          <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{item.destino || 'Remetido'}</span>
          <span className="block text-sm text-ink-muted">
            {TIPO_REMETIDO[item.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
            {item.reservaPedido ? ` · Reserva ${item.reservaPedido}` : ''}
            {item.numeroDocumento ? ` · NF ${item.numeroDocumento}` : ''}
          </span>
          </span>
        </span>
        <span className={`badge ${BADGE[item.estado]} shrink-0`}>{ROTULO_ESTADO[item.estado]}</span>
      </button>

      {aberto && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(salvarDadosAction);
          }}
        >
          <Secao titulo="Motorista">
            {campo('transportadora', 'Empresa (transportadora)')}
            {campo('motoristaNome', 'Motorista')}
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14 })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16 })}
          </Secao>
          <Secao titulo="Caminhão">
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7 })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7 })}
            {campo('capacidadeCarga', 'Capacidade de carga (t)', { inputMode: 'decimal', maxLength: 6 })}
          </Secao>
          <Secao titulo="Carga">
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem')}
            {campo('destino', 'Destino')}
          </Secao>
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente} />

          {medindo && <p className="text-sm text-ink-muted">O Pátio ainda está medindo. Você já pode salvar os dados; a liberação só fica disponível quando ele terminar.</p>}
          {liberada && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Carreta já liberada. Você ainda pode corrigir os dados.</p>}

          <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-ghost h-12 flex-1 sm:flex-none" disabled={pendente}>
              Salvar dados
            </button>
            <a href={`/portaria/pdf/${item.id}`} download className="btn btn-ghost h-12 flex-1 sm:flex-none" aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
            {!liberada && (
              <button type="button" className="btn btn-primary h-12 flex-1 sm:flex-none" disabled={pendente || medindo} onClick={() => enviar(liberarCarretaAction)}>
                {pendente ? 'Aguarde...' : 'Liberar carreta'}
              </button>
            )}
          </div>

          {resultado?.erro && (
            <p role="alert" className="text-sm text-bad">
              {resultado.erro}
            </p>
          )}
          {resultado?.ok && resultado.mensagem && <p role="status" className="badge badge-ok !text-sm !normal-case">{resultado.mensagem}</p>}
        </form>
      )}
    </section>
  );
}
