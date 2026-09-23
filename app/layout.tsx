import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
