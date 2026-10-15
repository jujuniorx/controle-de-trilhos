import Link from 'next/link';
import type { CSSProperties } from 'react';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { saudacao } from '@/lib/saudacao';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { AtivarAvisos } from '@/components/patio/AtivarAvisos';
import { listarChegadasLiberadas } from '@/lib/services/chegada';
import { chavePublicaPush } from '@/lib/services/push';

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

export default async function PatioHomePage() {
  const [aguardando, liberadas] = await Promise.all([contarAguardando(), carregarLiberadas()]);

  return (
    <main className="mx-auto max-w-md space-y-5 p-6 sm:max-w-2xl lg:max-w-3xl">
      <section className="patio-hero">
        <FundoTrilhos />
        <div className="patio-hero-texto">
          <p className="patio-hero-saudacao">{saudacao()}!</p>
          <h1 className="patio-hero-titulo">O que vamos registrar?</h1>
          <p className="patio-hero-sub">Escolha uma opção. Sem internet, o registro fica guardado e é enviado depois.</p>
        </div>
      </section>

      <AtualizarAuto segundos={20} />

      {liberadas.length > 0 && (
        <section aria-label="Caminhões liberados para descarregar" className="space-y-2">
          <h2 className="font-condensed text-base font-bold uppercase tracking-wide text-ok">Liberados para descarregar</h2>
          {liberadas.map((c) => (
            <Link key={c.id} href={`/patio/recebimentos/novo?chegada=${c.id}`} className="card block border-2 border-ok transition hover:brightness-110">
              <p className="font-medium text-ink">{c.placaCarreta || c.placaCavalo || 'Caminhão'}{c.origem ? ` — ${c.origem}` : ''}</p>
              <p className="text-sm text-ink-muted">
                {[c.transportadora, c.materialPrevisto].filter(Boolean).join(' · ') || 'Toque para registrar o recebimento'}
              </p>
              {c.observacao && <p className="mt-1 text-sm text-warn">Portaria: {c.observacao}</p>}
              <span className="badge badge-ok mt-1">Pode descarregar — toque para iniciar</span>
            </Link>
          ))}
        </section>
      )}

      <div className="acoes-patio">
        <Link href="/patio/recebimentos/novo" className="acao-patio acao-patio-principal" style={atraso(0)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
          <strong>Novo recebimento</strong>
          <span>Caminhão chegando com trilhos para o pátio.</span>
        </Link>
        <Link href="/patio/remetidos" className="acao-patio" style={atraso(1)}>
          {aguardando > 0 && (
            <em className="acao-patio-aviso">
              {aguardando} {aguardando === 1 ? 'aguardando' : 'aguardando chegada'}
            </em>
          )}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 17H10V8h11zM10 11H6l-3 3v3h7" /><circle cx="6" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
          <strong>Remetidos</strong>
          <span>Cadastrar saída (aguardando chegada ou lançar agora) e confirmar carregamentos.</span>
        </Link>
      </div>

      <AtivarAvisos chavePublica={chavePublicaPush()} />
    </main>
  );
}
