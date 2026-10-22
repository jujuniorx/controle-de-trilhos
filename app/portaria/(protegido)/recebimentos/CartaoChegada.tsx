'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { cancelarChegadaAction, confirmarSaidaChegadaAction, definirOrdemChegadaAction, desfazerSaidaChegadaAction, registrarChegadaAction, salvarChegadaAction } from './actions';
import type { ResultadoPortaria } from '../actions';
import { ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import { formatarCpfDigitado, formatarTelefoneDigitado } from '@/lib/validation/portaria';
import { formatarCpf, formatarTelefone } from '@/lib/domain/portaria';
import type { ItemChegada } from '@/lib/services/chegada';

const BADGE_CHEGADA = { AGUARDANDO_LIBERACAO: 'badge-muted', LIBERADA: 'badge-warn', RECEBIDA: 'badge-ok', SAIU: 'badge-info', CANCELADA: 'badge-muted' } as const;

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function hora(d: Date): string {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function dataHora(d: Date): string {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

export function CartaoChegada({ item }: { item: ItemChegada }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_LIBERACAO' || item.estado === 'RECEBIDA');
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [tambemCarrega, setTambemCarrega] = useState(false);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: formatarCpf(item.motoristaCpf),
    motoristaTelefone: formatarTelefone(item.motoristaTelefone),
    placaCarreta: item.placaCarreta ?? '',
    placaCarreta2: item.placaCarreta2 ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    comprimentoCarreta: item.comprimentoCarreta != null ? String(item.comprimentoCarreta).replace('.', ',') : '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacao ?? '',
    origem: item.origem ?? '',
  });
  const [cargaDescarga, setCargaDescarga] = useState(item.cargaDescarga ?? false);
  const [destinoCarga, setDestinoCarga] = useState(item.destinoCarga ?? '');
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: campo === 'motoristaCpf' ? formatarCpfDigitado(e.target.value) : campo === 'motoristaTelefone' ? formatarTelefoneDigitado(e.target.value) : String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const rascunho = item.estado === 'AGUARDANDO_LIBERACAO';
  const chegou = item.estado === 'LIBERADA';
  const descarregado = item.estado === 'RECEBIDA';
  // Carga e descarga: a saída só libera depois que o Pátio confirma o carregamento.
  const aguardaCarga = descarregado && item.cargaDescarga && !item.cargaCarregadaEm;
  const saiu = item.estado === 'SAIU';
  const semSalvar = saiu || descarregado;

  function enviar(acao: (id: string, dados: unknown) => Promise<ResultadoPortaria>) {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await acao(item.id, { ...v, cargaDescarga, destinoCarga });
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

  const campo = (id: keyof typeof v, rotulo: string, extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number; placeholder?: string } = {}) => (
    <div className="field">
      <label htmlFor={`${item.id}-${id}`}>{rotulo}</label>
      <input
        id={`${item.id}-${id}`}
        value={v[id]}
        onChange={set(id)}
        className="h-12"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        autoComplete="off"
        disabled={pendente || saiu || descarregado}
      />
    </div>
  );

  const titulo = item.placaCarreta || item.placaCavalo || item.motoristaNome || 'Caminhão sem identificação';
  const numero = item.ordemDia ? `Caminhão nº ${item.ordemDia} — ` : '';
  const [ordemTexto, setOrdemTexto] = useState(item.ordemDia ? String(item.ordemDia) : '');
  const [ordemPendente, iniciarOrdem] = useTransition();
  const [ordemErro, setOrdemErro] = useState('');
  function trocarOrdem() {
    const n = Number(ordemTexto);
    setOrdemErro('');
    iniciarOrdem(async () => {
      const r = await definirOrdemChegadaAction(item.id, n);
      if (!r.ok) setOrdemErro(r.erro ?? 'Não foi possível trocar o número.');
      else router.refresh();
    });
  }

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full flex-col items-start gap-2 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
          <span className="min-w-0">
          <span className="block break-words font-semibold text-ink">{numero}{titulo}</span>
          <span className="block text-sm text-ink-muted">
            {item.origem ? `${item.origem} · ` : ''}{item.liberadaEm ? `chegou às ${hora(item.liberadaEm)}` : `aberta às ${hora(item.criadoEm)}`}
            {item.saidaEm ? ` · saiu ${dataHora(item.saidaEm)}` : ''}
          </span>
          </span>
        </span>
        <span className={`badge ${BADGE_CHEGADA[item.estado]} shrink-0`}>{ROTULO_ESTADO_CHEGADA[item.estado]}</span>
      </button>

      {aberto && !semSalvar && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="field">
            <label htmlFor={`${item.id}-ordem`}>Número do caminhão (ordem)</label>
            <input id={`${item.id}-ordem`} className="h-12 w-28" inputMode="numeric" maxLength={3} value={ordemTexto} onChange={(e) => setOrdemTexto(e.target.value.replace(/\D/g, '').slice(0, 3))} disabled={ordemPendente} />
          </div>
          <button type="button" className="btn btn-ghost h-12" disabled={ordemPendente || !ordemTexto} onClick={trocarOrdem}>
            {ordemPendente ? 'Aguarde...' : 'Trocar número'}
          </button>
          {ordemErro && <p role="alert" className="w-full text-sm text-bad">{ordemErro}</p>}
        </div>
      )}
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
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14, placeholder: '000.000.000-00' })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16, placeholder: '(00) 00000-0000' })}
          </Secao>
          <Secao titulo="Caminhão">
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7, placeholder: 'ABC1D23' })}
            {campo('placaCarreta2', 'Placa da 2ª carreta (opcional)', { maxLength: 7, placeholder: 'ABC1D23' })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7, placeholder: 'ABC1D23' })}
          </Secao>
          <Secao titulo="Carga">
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem')}
          </Secao>
          <div className="grid grid-cols-2 gap-2">
            {campo('capacidadeCarga', 'Limite de carga (t)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 48' })}
            {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 15,5' })}
          </div>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={cargaDescarga} onChange={(e) => setCargaDescarga(e.target.checked)} disabled={pendente || saiu || descarregado} />
            <span><b>Carga e descarga</b> — este caminhão também vai carregar depois de descarregar</span>
          </label>
          {cargaDescarga && (
            <div className="field">
              <label htmlFor={`${item.id}-destino-carga`}>Carregar para (destino)</label>
              <input id={`${item.id}-destino-carga`} value={destinoCarga} onChange={(e) => setDestinoCarga(e.target.value)} className="h-12" maxLength={120} autoComplete="off" disabled={pendente || saiu || descarregado} />
            </div>
          )}
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente || saiu || descarregado} />

          {rascunho && (
            <div className="space-y-2 rounded-lg border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5" checked={tambemCarrega} onChange={(e) => setTambemCarrega(e.target.checked)} disabled={pendente} />
                Também vai carregar depois de descarregar
              </label>
              {tambemCarrega && (
                <div className="field">
                  <label htmlFor={`${item.id}-destino-carga`}>Destino da carga *</label>
                  <input id={`${item.id}-destino-carga`} className="h-12" value={destinoCarga} onChange={(e) => setDestinoCarga(e.target.value)} disabled={pendente} placeholder="Para onde vai o carregamento" />
                  <p className="text-xs text-ink-muted">Aparece na aba Carga. O Pátio confirma o carregamento depois.</p>
                </div>
              )}
            </div>
          )}
          {rascunho && <p className="text-sm text-ink-muted">Preencha ao menos uma placa e toque em &ldquo;Registrar chegada&rdquo;. O Pátio será avisado.</p>}
          {chegou && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Chegada registrada. O Pátio vai descarregar; você será avisado quando terminar.</p>}
          {aguardaCarga && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">O Pátio descarregou. Aguardando o carregamento: a saída libera depois que o Pátio confirmar a carga.</p>}
          {descarregado && !aguardaCarga && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">O Pátio descarregou. Quando o caminhão passar pela portaria, toque em &ldquo;Saída confirmada&rdquo;.</p>}
          {saiu && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">Caminhão saiu. Só consulta.</p>}
          {saiu && (
            <button
              type="button"
              className="btn btn-ghost h-12 w-full"
              disabled={pendente}
              onClick={() => {
                setResultado(null);
                iniciar(async () => {
                  try {
                    const r = await desfazerSaidaChegadaAction(item.id);
                    setResultado(r);
                    if (r.ok) router.refresh();
                  } catch {
                    setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
                  }
                });
              }}
            >
              {pendente ? 'Aguarde...' : 'Desfazer saída (voltar para a portaria)'}
            </button>
          )}
          {!rascunho && <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>}

          <div className="grid grid-cols-2 gap-2">
            {!semSalvar && !rascunho && (
              <button type="submit" className="btn btn-ghost h-12" disabled={pendente}>
                Salvar dados
              </button>
            )}
            <a href={`/portaria/pdf-chegada/${item.id}`} download className={`btn btn-ghost h-12 ${semSalvar || rascunho ? 'col-span-2' : ''}`} aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
            {rascunho && (
              <button type="button" className="btn btn-primary h-12 col-span-2 order-first" disabled={pendente} onClick={() => enviar((id, dados) => registrarChegadaAction(id, { ...(dados as object), tambemCarrega, destinoCarga }))}>
                {pendente ? 'Aguarde...' : 'Registrar chegada'}
              </button>
            )}
            {descarregado && !aguardaCarga && (
              <button
                type="button"
                className="btn btn-primary h-12 col-span-2 order-first"
                disabled={pendente}
                onClick={() => {
                  setResultado(null);
                  iniciar(async () => {
                    try {
                      const r = await confirmarSaidaChegadaAction(item.id);
                      setResultado(r);
                      if (r.ok) router.refresh();
                    } catch {
                      setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
                    }
                  });
                }}
              >
                {pendente ? 'Aguarde...' : 'Saída confirmada'}
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
      {(rascunho || chegou) && (!confirmaCancelar ? (
        <button type="button" className="btn btn-ghost h-11 w-full text-bad" onClick={() => setConfirmaCancelar(true)}>
          Apagar chegada
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bad/10 px-3 py-2 text-sm">
          <span>Apagar esta chegada? Ela some das telas da Portaria e do Pátio.</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={pendente} onClick={cancelar}>
            {pendente ? 'Aguarde...' : 'Sim, apagar'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmaCancelar(false)}>
            Não
          </button>
        </div>
      ))}
      {resultado?.erro && !aberto && (
        <p role="alert" className="text-sm text-bad">{resultado.erro}</p>
      )}
    </section>
  );
}
