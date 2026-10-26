import Link from 'next/link';
import type { CSSProperties } from 'react';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { saudacaoCompleta } from '@/lib/saudacao';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { listarChegadasLiberadas } from '@/lib/services/chegada';
import { listarCarretasNaPortaria } from '@/lib/services/portaria';
import { CarretaNaPortaria } from '@/components/patio/CarretaNaPortaria';
import { DescarregadoBotao } from '@/components/patio/DescarregadoBotao';
import { CarregadoBotao } from '@/components/patio/CarregadoBotao';
import { normalizarLocal } from '@/lib/domain/local';
import { chavePublicaPush } from '@/lib/services/push';
import { ExcluirPatioBotao } from '@/components/patio/ExcluirPatioBotao';
import { excluirChegadaPatioAction } from './recebimentos/actions';

const atraso = (n: number) => ({ '--i': n }) as CSSProperties;

async function contarAguardando(): Promise<number> {
  try {
    return (await listarAguardandoChegada()).length;
  } catch {
    return 0; // o aviso é só um extra: nunca derruba a tela inicial do Pátio
  }
}

async function carregarLiberadas() {
  try {
    return await listarChegadasLiberadas();
  } catch {
    return []; // idem: o aviso é um extra
  }
}

async function carregarCarretas() {
  try {
    return await listarCarretasNaPortaria();
  } catch {
    return []; // idem
  }
}

type LinhaPatio = { descarregadaEm: Date | null; saidaEm: Date | null; cargaDescarga: boolean; cargaCarregadaEm: Date | null };

/** Rótulo do caminhão na lista do Pátio. Carga e descarga só fica "pode sair" depois do carregamento. */
function rotuloPatio(c: LinhaPatio): string {
  if (!c.descarregadaEm) return 'Chegou — toque para descarregar';
  if (c.cargaDescarga) {
    if (!c.cargaCarregadaEm) return 'Descarregado — aguardando carregamento';
    return c.saidaEm ? 'Carregado — já saiu' : 'Carregado — pode sair';
  }
  return c.saidaEm ? 'Já saiu — falta medir' : 'Descarregado — falta medir';
}

function hora(d: Date | null): string {
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
}

export default async function PatioHomePage() {
  const [aguardando, liberadasTodas, carretas] = await Promise.all([contarAguardando(), carregarLiberadas(), carregarCarretas()]);
  // Carga e descarga já descarregada espera o carregamento: fica numa seção própria, com um toque para carregar.
  const aguardandoCarga = liberadasTodas.filter((c) => c.cargaDescarga && c.descarregadaEm && !c.cargaCarregadaEm && !c.saidaEm);
  const liberadas = liberadasTodas.filter((c) => !aguardandoCarga.includes(c));

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-6 sm:max-w-2xl lg:max-w-none">
      <section className="patio-hero">
        <FundoTrilhos />
        <div className="patio-hero-texto">
          <p className="patio-hero-saudacao">{saudacaoCompleta()}!</p>
          <h1 className="patio-hero-titulo">O que vamos registrar?</h1>
          <p className="patio-hero-sub">Escolha uma opção. Sem internet, o registro fica guardado e é enviado depois.</p>
        </div>
      </section>

      <AtualizarAuto segundos={20} />

      <Link href="/patio/pilhas" className="card flex items-center justify-between gap-3 font-medium text-ink">
        <span>Pilhas do pátio</span>
        <span aria-hidden="true">→</span>
      </Link>

      {carretas.length > 0 && (
        <section aria-label="Carretas na Portaria" className="space-y-2">
          <h2 className="font-condensed text-base font-bold uppercase tracking-wide text-warn">Carretas na Portaria (carregar)</h2>
          {carretas.map((c) => (
            <CarretaNaPortaria
              key={c.id}
              id={c.id}
              ordemDia={c.ordemDia}
              placaCarreta={c.placaCarreta}
              placaCavalo={c.placaCavalo}
              origem={c.origem ? normalizarLocal(c.origem) : null}
              destino={c.destino ? normalizarLocal(c.destino) : null}
              detalhe={[c.transportadora, c.reservaPedido && `Reserva ${c.reservaPedido}`].filter(Boolean).join(' · ')}
              observacao={c.observacaoPortaria}
              chegouAs={hora(c.chegadaPortariaEm)}
              faltaConfirmar={c.status === 'AGUARDANDO_CHEGADA'}
            />
          ))}
        </section>
      )}

      {aguardandoCarga.length > 0 && (
        <section aria-label="Aguardando carregamento" className="space-y-2">
          <h2 className="font-condensed text-base font-bold uppercase tracking-wide text-warn">Aguardando carregamento</h2>
          {aguardandoCarga.map((c) => (
            <div key={c.id} className="card space-y-3 border-2 border-warn">
              <Link href={`/patio/recebimentos/novo?chegada=${c.id}`} className="block transition hover:brightness-110">
                <p className="font-medium text-ink">{c.ordemDia ? `Caminhão nº ${c.ordemDia} — ` : ''}{c.placaCarreta || c.placaCavalo || 'Caminhão'}{c.origem ? ` — ${c.origem}` : ''}</p>
                <p className="text-sm text-ink-muted">Descarregado. Esta carreta vai carregar{c.destinoCarga ? ` para ${c.destinoCarga}` : ''}.</p>
              </Link>
              <CarregadoBotao id={c.id} />
              <div className="flex justify-end">
                <ExcluirPatioBotao nome={c.placaCarreta || c.placaCavalo || 'caminhão'} oQue="esta chegada" alvoId={c.id} aoConfirmar={excluirChegadaPatioAction} />
              </div>
            </div>
          ))}
        </section>
      )}

      {liberadas.length > 0 && (
        <section aria-label="Caminhões na Portaria para descarregar" className="space-y-2">
          <h2 className="font-condensed text-base font-bold uppercase tracking-wide text-ok">Caminhões na Portaria (descarregar)</h2>
          {liberadas.map((c) => (
            <div key={c.id} className="card space-y-3 border-2 border-ok">
              <Link href={`/patio/recebimentos/novo?chegada=${c.id}`} className="block transition hover:brightness-110">
                <p className="font-medium text-ink">{c.ordemDia ? `Caminhão nº ${c.ordemDia} — ` : ''}{c.placaCarreta || c.placaCavalo || 'Caminhão'}{c.origem ? ` — ${c.origem}` : ''}</p>
                <p className="text-sm text-ink-muted">
                  {[c.transportadora, c.materialPrevisto].filter(Boolean).join(' · ') || 'Toque para registrar a descarga'}
                </p>
                {c.observacao && <p className="mt-1 text-sm text-warn">Portaria: {c.observacao}</p>}
                <span className="mt-1 flex flex-wrap gap-2">
                  <span className="badge badge-ok">
                    {rotuloPatio(c)}
                  </span>
                  {c.cargaDescarga && <span className="badge badge-warn">Carga e descarga{c.destinoCarga ? ` → ${c.destinoCarga}` : ''}</span>}
                </span>
              </Link>
              {!c.descarregadaEm && <DescarregadoBotao id={c.id} cargaDescarga={c.cargaDescarga} />}
              <div className="flex justify-end">
                <ExcluirPatioBotao nome={c.placaCarreta || c.placaCavalo || 'caminhão'} oQue="esta chegada" alvoId={c.id} aoConfirmar={excluirChegadaPatioAction} />
              </div>
            </div>
          ))}
        </section>
      )}


      <div className="acoes-patio">
        <Link href="/patio/recebimentos/novo" className="acao-patio acao-patio-principal" style={atraso(0)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
          <strong>Nova descarga</strong>
          <span>Caminhão chegando com trilhos para o pátio.</span>
        </Link>
        <Link href="/patio/remetidos" className="acao-patio" style={atraso(1)}>
          {aguardando > 0 && (
            <em className="acao-patio-aviso">
              {aguardando} {aguardando === 1 ? 'aguardando' : 'aguardando chegada'}
            </em>
          )}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 17H10V8h11zM10 11H6l-3 3v3h7" /><circle cx="6" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
          <strong>Cargas</strong>
          <span>Cadastrar saída (aguardando chegada ou lançar agora) e confirmar carregamentos.</span>
        </Link>
        <Link href="/patio/saidas" className="acao-patio" style={atraso(2)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3H4v5M4 3l6 6M15 21h5v-5M20 21l-6-6" /><path d="M4 14v5h5M20 10V5h-5" /></svg>
          <strong>Carretas que já saíram</strong>
          <span>Cargas e descargas que a Portaria registrou como saída. Busque por placa, cidade ou motorista.</span>
        </Link>
      </div>

      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Aviso de chegada na Portaria" descricao="Receba um aviso neste tablet quando a Portaria registrar a chegada de uma carreta ou de um caminhão." />
    </main>
  );
}
