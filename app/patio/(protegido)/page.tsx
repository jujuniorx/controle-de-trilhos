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
import { ICONE_CARGA, ICONE_RECEBER, ICONE_SAIDAS } from '@/components/patio/icones';

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

/**
 * Situação do caminhão na lista do Pátio, com a cor certa: verde é só "pronto para você agir
 * agora"; o que está pendente de medição fica em âmbar, para não se confundir de longe.
 * Carga e descarga só fica "pode sair" depois do carregamento.
 */
function situacaoPatio(c: LinhaPatio): { texto: string; badge: string } {
  if (!c.descarregadaEm) return { texto: 'Chegou — toque para descarregar', badge: 'badge-ok' };
  if (c.cargaDescarga) {
    if (!c.cargaCarregadaEm) return { texto: 'Descarregado — aguardando carregamento', badge: 'badge-warn' };
    return c.saidaEm ? { texto: 'Carregado — já saiu', badge: 'badge-info' } : { texto: 'Carregado — pode sair', badge: 'badge-ok' };
  }
  return c.saidaEm ? { texto: 'Já saiu — toque para medir', badge: 'badge-warn' } : { texto: 'Descarregado — toque para medir', badge: 'badge-warn' };
}

function hora(d: Date | null): string {
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
}

const SETA_CARD = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default async function PatioHomePage() {
  const [aguardando, liberadasTodas, carretas] = await Promise.all([contarAguardando(), carregarLiberadas(), carregarCarretas()]);
  // Carga e descarga já descarregada espera o carregamento: fica numa seção própria, com um toque para carregar.
  const aguardandoCarga = liberadasTodas.filter((c) => c.cargaDescarga && c.descarregadaEm && !c.cargaCarregadaEm && !c.saidaEm);
  const liberadas = liberadasTodas.filter((c) => !aguardandoCarga.includes(c));

  const paraDescarregar = liberadas.filter((c) => !c.descarregadaEm).length;
  const faltaMedir = liberadas.filter((c) => c.descarregadaEm && !c.cargaDescarga).length;

  return (
    <main className="patio-tela mx-auto w-full max-w-md space-y-5 p-6 sm:max-w-2xl lg:max-w-none">
      <section className="patio-hero">
        <FundoTrilhos />
        <div className="patio-hero-texto">
          <p className="patio-hero-saudacao">{saudacaoCompleta()}!</p>
          <h1 className="patio-hero-titulo">O que vamos registrar?</h1>
          <p className="patio-hero-sub">
            {[
              paraDescarregar > 0 ? `${paraDescarregar} para descarregar` : null,
              faltaMedir > 0 ? `${faltaMedir} falta medir` : null,
              carretas.length > 0 ? `${carretas.length} ${carretas.length === 1 ? 'carga aguardando' : 'cargas aguardando'}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Nada pendente agora. Sem internet, o registro fica guardado e é enviado depois.'}
          </p>
        </div>
      </section>

      <AtualizarAuto segundos={20} />

      {/* Os atalhos vêm antes da lista: quem chega para lançar algo novo não precisa rolar o pátio inteiro. */}
      <div className="acoes-patio !mt-0">
        <Link href="/patio/recebimentos/novo" className="acao-patio acao-patio-principal" style={atraso(0)}>
          {ICONE_RECEBER(30)}
          <strong>Nova descarga</strong>
          <span>Caminhão chegando com trilhos para o pátio.</span>
        </Link>
        <Link href="/patio/remetidos" className="acao-patio" style={atraso(1)}>
          {aguardando > 0 && (
            <em className="acao-patio-aviso">
              {aguardando} {aguardando === 1 ? 'aguardando' : 'aguardando chegada'}
            </em>
          )}
          {ICONE_CARGA(30)}
          <strong>Cargas</strong>
          <span>Cadastrar saída e confirmar carregamentos.</span>
        </Link>
        <Link href="/patio/saidas" className="acao-patio" style={atraso(2)}>
          {ICONE_SAIDAS(30)}
          <strong>Já saíram</strong>
          <span>Cargas e descargas que a Portaria registrou como saída.</span>
        </Link>
      </div>

      {carretas.length > 0 && (
        <section aria-label="Cargas na Portaria" className="space-y-2">
          <h2 className="font-condensed text-xl font-bold uppercase tracking-wide text-warn">Cargas na Portaria (carregar)</h2>
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
          <h2 className="font-condensed text-xl font-bold uppercase tracking-wide text-warn">Aguardando carregamento</h2>
          {aguardandoCarga.map((c) => (
            <div key={c.id} className="card space-y-3 border-2 border-warn">
              <Link href={`/patio/recebimentos/novo?chegada=${c.id}`} className="patio-card-link transition hover:brightness-110">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.ordemDia ? `Caminhão nº ${c.ordemDia} — ` : ''}{c.placaCarreta || c.placaCavalo || 'Caminhão'}</span>
                  <span className="mt-1 block text-lg font-bold uppercase tracking-wide text-ink">
                    {c.destinoCarga ? <>Vai para {normalizarLocal(c.destinoCarga)}</> : <span className="text-warn">Destino não informado</span>}
                  </span>
                  <span className="block text-sm text-ink-muted">Descarregado. Esta carreta vai carregar.</span>
                </span>
                <span className="patio-card-seta">{SETA_CARD}</span>
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
          <h2 className="font-condensed text-xl font-bold uppercase tracking-wide text-ok">Caminhões na Portaria (descarregar)</h2>
          {liberadas.map((c) => (
            <div key={c.id} className={`card space-y-3 border-2 ${c.descarregadaEm ? 'border-warn' : 'border-ok'}`}>
              <Link href={`/patio/recebimentos/novo?chegada=${c.id}`} className="patio-card-link transition hover:brightness-110">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.ordemDia ? `Caminhão nº ${c.ordemDia} — ` : ''}{c.placaCarreta || c.placaCavalo || 'Caminhão'}</span>
                  <span className="mt-1 block text-lg font-bold uppercase tracking-wide text-ink">
                    {c.origem ? <>Vem de {normalizarLocal(c.origem)}</> : <span className="text-warn">Origem não informada</span>}
                  </span>
                  <span className="block text-sm text-ink-muted">
                    {[c.transportadora, c.materialPrevisto].filter(Boolean).join(' · ') || 'Toque para registrar a descarga'}
                  </span>
                  {c.observacao && <span className="mt-1 block text-sm text-warn">Portaria: {c.observacao}</span>}
                  <span className="mt-1 flex flex-wrap gap-2">
                    <span className={`badge ${situacaoPatio(c).badge}`}>{situacaoPatio(c).texto}</span>
                    {c.cargaDescarga && <span className="badge badge-warn">Carga e descarga{c.destinoCarga ? ` → ${c.destinoCarga}` : ''}</span>}
                  </span>
                </span>
                <span className="patio-card-seta">{SETA_CARD}</span>
              </Link>
              {!c.descarregadaEm && <DescarregadoBotao id={c.id} cargaDescarga={c.cargaDescarga} />}
              <div className="flex justify-end">
                <ExcluirPatioBotao nome={c.placaCarreta || c.placaCavalo || 'caminhão'} oQue="esta chegada" alvoId={c.id} aoConfirmar={excluirChegadaPatioAction} />
              </div>
            </div>
          ))}
        </section>
      )}


      <AtivarAvisos chavePublica={chavePublicaPush()} titulo="Aviso de chegada na Portaria" descricao="Receba um aviso neste tablet quando a Portaria registrar a chegada de uma carreta ou de um caminhão." ocultarQuandoLigado />
    </main>
  );
}
