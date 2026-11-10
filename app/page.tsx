import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BotaoInstalar } from '@/components/InstalarApp';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { LogoAnimada } from '@/components/ui/LogoAnimada';
import { AlternarTema } from '@/components/ui/AlternarTema';

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

function IconePortaria() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V9l9-5 9 5v12M3 21h18" />
      <path d="M8 21v-6h8v6M8 15h8M12 15v6" />
    </svg>
  );
}

function IconeProducao() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 17h8.5M13.5 17H22" />
      <path d="M2 20h20" strokeWidth="1.2" />
      <path d="M6 20v1.5M18 20v1.5" strokeWidth="1.2" />
      <path d="M11.2 17l.8-4.2.8 4.2" />
      <path d="M12 6v2.2M8.8 7.2l1.3 1.3M15.2 7.2l-1.3 1.3M6.5 10.5h1.6M15.9 10.5h1.6" strokeWidth="1.4" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="home-entrada">
      <FundoTrilhos />
      <AlternarTema padrao="escuro" className="home-tema" />
      <div className="home-conteudo">
        <LogoAnimada size={84} />
        <h1 className="home-titulo">Controle de Trilhos</h1>
        <p className="home-frase">Recebimento, remessa e conferência de trilhos.</p>

        <nav className="home-grade" aria-label="Setores">
          <Link href="/patio/acesso" className="setor-tile" style={atraso(0)} aria-label="Pátio: registrar recebimentos e remetidos">
            <span className="setor-tile-icone"><IconeCaminhao /></span>
            <span className="setor-tile-nome">Pátio</span>
          </Link>
          <Link href="/portaria/login" className="setor-tile" style={atraso(1)} aria-label="Portaria: dados do motorista e liberar carretas">
            <span className="setor-tile-icone"><IconePortaria /></span>
            <span className="setor-tile-nome">Portaria</span>
          </Link>
          <Link href="/producao/login" className="setor-tile" style={atraso(3)} aria-label="Produção: registrar as soldas do turno">
            <span className="setor-tile-icone"><IconeProducao /></span>
            <span className="setor-tile-nome">Produção</span>
          </Link>
          <Link href="/admin/login" className="setor-tile" style={atraso(2)} aria-label="Administrativo: conferir, relatórios e gráficos">
            <span className="setor-tile-icone"><IconeGrafico /></span>
            <span className="setor-tile-nome">Administrativo</span>
          </Link>
        </nav>

        <BotaoInstalar className="home-instalar" />
        <Link href="/privacidade" className="home-privacidade">
          Privacidade e cookies
        </Link>
      </div>
    </main>
  );
}
