import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Redeploy attempt
  agentRules: false,
  async headers() {
    return [
      // Páginas autenticadas nunca ficam em cache (botão Voltar depois de sair não mostra dados).
      {
        source: "/(admin|portaria|patio)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), usb=(), payment=(), interest-cohort=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Content-Security-Policy is intentionally NOT set here: it requires a
          // per-request nonce (script-src 'nonce-<value>' 'strict-dynamic') to allow
          // Next.js's inline RSC flight scripts without 'unsafe-inline'. A static
          // value in next.config.ts can't carry a per-request nonce, so it's
          // generated and set in middleware.ts instead. See middleware.ts.
        ],
      },
    ];
  },
};

export default nextConfig;
