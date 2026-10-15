'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { cancelarChegadaAction, liberarChegadaAction, salvarChegadaAction } from './actions';
import type { ResultadoPortaria } from '../actions';
import { ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import type { ItemChegada } from '@/lib/services/chegada';

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function hora(d: Date): string {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export function CartaoChegada({ item }: { item: ItemChegada }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_LIBERACAO');
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: item.motoristaCpf ?? '',
    motoristaTelefone: item.motoristaTelefone ?? '',
    placaCarreta: item.placaCarreta ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacao ?? '',
    origem: item.origem ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const liberada = item.estado === 'LIBERADA';

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

  function cancelar() {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await cancelarChegadaAction(item.id);
        if (!r.ok) setResultado(r);
        else router.refresh();
      } catch {
        setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
      }
    });
  }

  const campo = (id: keyof typeof v, rotulo: string, extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number } = {}) => (
    <div className="field">
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

  const titulo = item.placaCarreta || item.placaCavalo || item.motoristaNome || 'Caminhão sem identificação';

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
          <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{titulo}</span>
          <span className="block text-sm text-ink-muted">
            {item.origem ? `${item.origem} · ` : ''}chegou às {hora(item.criadoEm)}
          </span>
          </span>
        </span>
        <span className={`badge ${liberada ? 'badge-ok' : 'badge-warn'} shrink-0`}>{ROTULO_ESTADO_CHEGADA[item.estado]}</span>
      </button>

      {aberto && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(salvarChegadaAction);
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
          </Secao>
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente} />

          {liberada && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Caminhão liberado. O Pátio já pode descarregar. Você ainda pode corrigir os dados.</p>}
          <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-ghost h-12 flex-1 sm:flex-none" disabled={pendente}>
              Salvar dados
            </button>
            <a href={`/portaria/pdf-chegada/${item.id}`} download className="btn btn-ghost h-12 flex-1 sm:flex-none" aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
            {!liberada && (
              <button type="button" className="btn btn-primary h-12 flex-1 sm:flex-none" disabled={pendente} onClick={() => enviar(liberarChegadaAction)}>
                {pendente ? 'Aguarde...' : 'Liberar para descarregar'}
              </button>
            )}
          </div>

          {!confirmaCancelar ? (
            <button type="button" className="text-sm text-ink-muted underline" onClick={() => setConfirmaCancelar(true)}>
              Cancelar esta chegada
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Cancelar esta chegada?</span>
              <button type="button" className="btn btn-ghost btn-sm text-bad" disabled={pendente} onClick={cancelar}>
                Sim, cancelar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmaCancelar(false)}>
                Não
              </button>
            </div>
          )}

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
