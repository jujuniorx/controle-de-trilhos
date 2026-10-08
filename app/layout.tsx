import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed, Geist_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Alinhado com public/manifest.json (name / description): esta é a página
  // precarregada como app shell da PWA, então é este título que aparece na aba e
  // na tela inicial de um tablet com o app instalado.
  title: "Controle de Trilhos",
  description: "Sistema de controle de trilhos ferroviários",
  manifest: "/manifest.json",
};

// Sem isso, o Next.js não injeta NENHUMA tag <meta name="viewport">: o
// celular renderiza como se fosse desktop (~980px) e dá zoom-out pra caber,
// o que também é a causa raiz do zoom indevido ao tocar um campo no iOS.
// maximum-scale/user-scalable NÃO são setados de propósito — bloquear o
// zoom manual prejudica acessibilidade (Bloco 4.1).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Força renderização dinâmica (por requisição) em toda a árvore de rotas.
// Necessário para o CSP com nonce por requisição (ver middleware.ts): o
// Next.js só consegue carimbar o nonce nos scripts inline que ele injeta
// (payload de RSC) durante uma renderização dinâmica — uma página estática,
// pré-renderizada em build time, não tem acesso ao nonce da requisição e
// ficaria com os scripts sem nonce, quebrando a hidratação sob o CSP
// estrito. Sem isso, /patio/acesso e /admin/login (que hoje são estáticas)
// continuariam quebradas mesmo com o middleware corrigido.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
