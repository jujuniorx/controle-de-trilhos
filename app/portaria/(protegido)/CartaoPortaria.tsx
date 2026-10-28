'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { ICONE_SETA_BAIXO } from '@/components/portaria/icones';
import { apagarCarretaAction, confirmarSaidaAction, desfazerSaidaAction, registrarChegadaAction, salvarDadosAction, type ResultadoPortaria } from './actions';
import { ROTULO_ESTADO } from '@/lib/domain/portaria';
import { quandoLegivel } from '@/lib/domain/quando';
import type { ItemPortaria } from '@/lib/services/portaria';
import { formatarCpfDigitado, formatarTelefoneDigitado } from '@/lib/validation/portaria';
import { formatarCpf, formatarTelefone } from '@/lib/domain/portaria';

const TIPO_REMETIDO: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };
const BADGE = { AGUARDANDO_CARRETA: 'badge-muted', CHEGOU: 'badge-warn', LIBERADA: 'badge-ok', SAIU: 'badge-info' } as const;

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function CartaoPortaria({ item, origens = [] }: { item: ItemPortaria; origens?: string[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_CARRETA' || item.estado === 'LIBERADA');
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [confirmaApagar, setConfirmaApagar] = useState(false);
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
    origem: item.origem ?? '',
    destino: item.destino ?? '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacaoPortaria ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: campo === 'motoristaCpf' ? formatarCpfDigitado(e.target.value) : campo === 'motoristaTelefone' ? formatarTelefoneDigitado(e.target.value) : String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const aguardando = item.estado === 'AGUARDANDO_CARRETA';
  const chegou = item.estado === 'CHEGOU';
  const liberada = item.estado === 'LIBERADA';
  const saiu = item.estado === 'SAIU';

  function executar(acao: () => Promise<ResultadoPortaria>, aoOk?: () => void) {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await acao();
        setResultado(r);
        if (r.ok) {
          aoOk?.();
          router.refresh();
        }
      } catch {
        setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
      }
    });
  }

  function enviar(acao: (id: string, dados: unknown) => Promise<ResultadoPortaria>) {
    executar(() => acao(item.id, v));
  }

  const campo = (
    id: keyof typeof v,
    rotulo: string,
    extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number; placeholder?: string; placa?: boolean; lista?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={`${item.id}-${id}`}>{rotulo}</label>
      <input
        id={`${item.id}-${id}`}
        value={v[id]}
        onChange={set(id)}
        className="h-12"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength ?? 120}
        placeholder={extra.placeholder}
        autoComplete="off"
        autoCapitalize={extra.placa ? 'characters' : undefined}
        list={extra.lista}
        disabled={pendente || saiu}
      />
    </div>
  );

  const placas = [item.placaCavalo, item.placaCarreta, item.placaCarreta2].filter(Boolean).join(' / ');
  const listaOrigens = `origens-carga-${item.id}`;

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold text-ink">
            {item.ordemDia ? `Carreta nº ${item.ordemDia} · ` : ''}
            {item.destino || 'Sem destino informado'}
          </span>
          <span className="block break-words text-sm text-ink">
            {placas || 'Sem placa ainda'}
            {item.motoristaNome ? ` · ${item.motoristaNome}` : ''}
          </span>
          <span className="block text-sm text-ink-muted">
            {TIPO_REMETIDO[item.remetidoDetalhe?.tipoRemetido ?? ''] ?? 'Tipo não informado'}
            {item.reservaPedido ? ` · Reserva ${item.reservaPedido}` : ''}
            {item.numeroDocumento ? ` · NF ${item.numeroDocumento}` : ''}
          </span>
          {item.chegadaPortariaEm && (
            <span className="block text-xs text-ink-muted">
              Chegou {quandoLegivel(item.chegadaPortariaEm)}
              {item.saidaPortariaEm ? ` · saiu ${quandoLegivel(item.saidaPortariaEm)}` : ''}
            </span>
          )}
        </span>
        <span className="flex flex-none flex-col items-end gap-2">
          <span className={`badge ${BADGE[item.estado]}`}>{ROTULO_ESTADO[item.estado]}</span>
          <span className={`text-ink-muted transition-transform ${aberto ? 'rotate-180' : ''}`}>{ICONE_SETA_BAIXO(18)}</span>
        </span>
      </button>

      {aberto && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(salvarDadosAction);
          }}
        >
          {origens.length > 0 && (
            <datalist id={listaOrigens}>
              {origens.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
          <Secao titulo="Motorista">
            {campo('transportadora', 'Empresa (transportadora)')}
            {campo('motoristaNome', 'Motorista')}
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14, placeholder: '000.000.000-00' })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16, placeholder: '(00) 00000-0000' })}
          </Secao>
          <Secao titulo="Caminhão">
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7, placeholder: 'ABC1D23 ou CMG1234', placa: true })}
            {campo('placaCarreta2', 'Placa da 2ª carreta (opcional)', { maxLength: 7, placeholder: 'ABC1D23 ou CMG1234', placa: true })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7, placeholder: 'ABC1D23 ou CMG1234', placa: true })}
          </Secao>
          <Secao titulo="Carga">
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem', { lista: origens.length > 0 ? listaOrigens : undefined })}
            {campo('destino', 'Destino')}
          </Secao>
          <div className="grid grid-cols-2 gap-2">
            {campo('capacidadeCarga', 'Limite de carga (t)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 48 (máx. 200)' })}
            {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 15,5 (máx. 60)' })}
          </div>
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente || saiu} />

          {aguardando && <p className="text-sm text-ink-muted">Quando a carreta chegar, preencha ao menos uma placa e toque em &ldquo;Registrar chegada&rdquo;. O Pátio será avisado.</p>}
          {chegou && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Chegada registrada. Agora o Pátio carrega e libera a carreta; você será avisado.</p>}
          {liberada && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">O Pátio liberou a carreta. Quando ela passar pela portaria, toque em &ldquo;Saída confirmada&rdquo;.</p>}
          {saiu && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">Carreta saiu. Só consulta.</p>}

          {/* Uma ação principal por vez, no topo; o resto é secundário. */}
          {aguardando && (
            <button type="button" className="btn btn-primary h-12 w-full" disabled={pendente} onClick={() => enviar(registrarChegadaAction)}>
              {pendente ? 'Aguarde...' : 'Registrar chegada'}
            </button>
          )}
          {liberada && (
            <button
              type="button"
              className="btn btn-primary h-12 w-full"
              disabled={pendente}
              onClick={() => executar(() => confirmarSaidaAction(item.id))}
            >
              {pendente ? 'Aguarde...' : 'Saída confirmada'}
            </button>
          )}
          {chegou && (
            <button type="submit" className="btn btn-primary h-12 w-full" disabled={pendente}>
              {pendente ? 'Aguarde...' : 'Salvar dados'}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!saiu && !chegou && (
              <button type="submit" className="btn btn-ghost h-12" disabled={pendente}>
                Salvar dados
              </button>
            )}
            <a href={`/portaria/pdf/${item.id}`} download className={`btn btn-ghost h-12 ${saiu ? 'col-span-2' : ''}`} aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
          </div>
          <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>

          {saiu && (
            <button type="button" className="btn btn-ghost h-12 w-full" disabled={pendente} onClick={() => executar(() => desfazerSaidaAction(item.id))}>
              {pendente ? 'Aguarde...' : 'Desfazer saída (voltar para a portaria)'}
            </button>
          )}

          {resultado?.erro && (
            <p role="alert" className="text-sm text-bad">
              {resultado.erro}
            </p>
          )}
          {resultado?.ok && resultado.mensagem && <p role="status" className="badge badge-ok !text-sm !normal-case">{resultado.mensagem}</p>}

          {/* Apagar fica escondido no fim do cartão aberto, em vermelho e discreto: não pode ser o botão mais visível. */}
          {chegou && (
            <div className="border-t border-line pt-3">
              {!confirmaApagar ? (
                <button type="button" className="text-sm font-semibold text-bad underline underline-offset-4" onClick={() => setConfirmaApagar(true)} disabled={pendente}>
                  Apagar carreta
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bad/10 px-3 py-2 text-sm">
                  <span>Apagar esta carreta? Ela some das telas da Portaria e do Pátio. O dono consegue restaurar pela lixeira.</span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={pendente} onClick={() => executar(() => apagarCarretaAction(item.id))}>
                    {pendente ? 'Aguarde...' : 'Sim, apagar'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmaApagar(false)}>
                    Não
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      )}
      {!aberto && resultado?.erro && (
        <p role="alert" className="text-sm text-bad">{resultado.erro}</p>
      )}
    </section>
  );
}
