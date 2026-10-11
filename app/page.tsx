import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BotaoInstalar } from '@/components/InstalarApp';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { LogoAnimada } from '@/components/ui/LogoAnimada';

const atraso = (n: number) => ({ '--i': n }) as CSSProperties;

function IconeCaminhao() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  );
}

function IconeGrafico() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="home-entrada">
      <FundoTrilhos />
      <div className="home-conteudo">
        <LogoAnimada size={84} />
        <h1 className="home-titulo">Controle de Trilhos</h1>
        <p className="home-frase">Recebimento, remessa e conferência de trilhos.</p>

        <div className="home-cards">
          <Link href="/patio/acesso" className="entrada-card" style={atraso(0)}>
            <span className="entrada-card-icone">
              <IconeCaminhao />
            </span>
            <span className="entrada-card-texto">
              <strong>Pátio</strong>
              <small>Registrar recebimentos e remetidos</small>
            </span>
            <span className="entrada-card-seta" aria-hidden="true">→</span>
          </Link>
          <Link href="/admin/login" className="entrada-card" style={atraso(1)}>
            <span className="entrada-card-icone">
              <IconeGrafico />
            </span>
            <span className="entrada-card-texto">
              <strong>Administrativo</strong>
              <small>Conferir, relatórios e gráficos</small>
            </span>
            <span className="entrada-card-seta" aria-hidden="true">→</span>
          </Link>
        </div>

        <BotaoInstalar className="home-instalar" />
        <Link href="/privacidade" className="home-privacidade">
          Privacidade e cookies
        </Link>
      </div>
    </main>
  );
}
