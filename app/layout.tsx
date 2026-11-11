import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import { AberturaApp } from "@/components/AberturaApp";
import { COR_APP, TEMA_COOKIE, TEMA_PADRAO, iconesDoTema, temaValido } from "@/lib/tema/tema";
import "./globals.css";
// Camada final dos temas (referencias visuais): precisa vir depois do globals.css.
import "./temas.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-cond",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadados lidos por requisição: o ícone da aba, o ícone do iPhone e o manifesto do
// app instalado seguem o tema escolhido (cookie ct_tema).
export async function generateMetadata(): Promise<Metadata> {
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value) ?? TEMA_PADRAO;
  const icones = iconesDoTema(tema);
  return {
    // Esta é a página precarregada como app shell da PWA, então é este título que
    // aparece na aba e na tela inicial de um tablet com o app instalado.
    title: "Controle de Trilhos",
    description: "Sistema de controle de trilhos ferroviários",
    manifest: "/manifest.webmanifest",
    // iPhone/iPad: ao "Adicionar à Tela de Início" abre em tela cheia, com ícone e nome próprios.
    icons: {
      icon: [{ url: icones.favicon, sizes: "48x48", type: "image/png" }],
      apple: [{ url: icones.apple, sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: "Controle de Trilhos", statusBarStyle: "black-translucent" },
  };
}

// Sem isso, o Next.js não injeta NENHUMA tag <meta name="viewport">: o
// celular renderiza como se fosse desktop (~980px) e dá zoom-out pra caber,
// o que também é a causa raiz do zoom indevido ao tocar um campo no iOS.
// maximum-scale/user-scalable NÃO são setados de propósito — bloquear o
// zoom manual prejudica acessibilidade (Bloco 4.1).
export async function generateViewport(): Promise<Viewport> {
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value) ?? TEMA_PADRAO;
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: COR_APP[tema],
  };
}

// Força renderização dinâmica (por requisição) em toda a árvore de rotas.
// Necessário para o CSP com nonce por requisição (ver middleware.ts): o
// Next.js só consegue carimbar o nonce nos scripts inline que ele injeta
// (payload de RSC) durante uma renderização dinâmica — uma página estática,
// pré-renderizada em build time, não tem acesso ao nonce da requisição e
// ficaria com os scripts sem nonce, quebrando a hidratação sob o CSP
// estrito. Sem isso, /patio/acesso e /admin/login (que hoje são estáticas)
// continuariam quebradas mesmo com o middleware corrigido.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema escolhido pelo usuário; sem escolha, o padrão para todos é o Azul-marinho.
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value) ?? TEMA_PADRAO;

  return (
    <html
      lang="pt-BR"
      data-tema={tema}
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
        <AberturaApp />
      </body>
    </html>
  );
}
