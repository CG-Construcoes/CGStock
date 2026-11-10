import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Páginas HTML são por-usuário (CSP com nonce) e não podem ser cacheadas
  cacheStartUrl: false,
  dynamicStartUrl: false,
  // Fallback offline: página estática em public/offline.html (sem dados de
  // usuário; lê IndexedDB local) servida quando a navegação falha sem rede.
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ["/sw-offline-sync.js"],
    // Segurança: nunca cachear páginas HTML autenticadas nem chamadas de API
    // no precache estático do Service Worker. O controle de App Shell por sessão
    // e Background Sync é feito em /sw-offline-sync.js (limpo no logout).
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.destination === "document",
        handler: "NetworkOnly",
        // options precisa existir para que o plugin anexe o fallback offline
        // (handlerDidError -> /offline.html) a esta regra.
        options: {},
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: {},
      },
    ],
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  experimental: {
    // Builder da Hostinger: reporta dezenas de CPUs mas a RAM é compartilhada
    // — o default (1 worker/CPU) explode a memória na coleta de page data
    // (SIGABRT). Limita a poucos workers.
    cpus: 2,
  },
  // Bundle autocontido em .next/standalone para deploy Node (Hostinger):
  // sobe só o mínimo necessário, sem node_modules completo.
  output: "standalone",
  // Acesso pela rede local (celular/PWA): sem isso o Next bloqueia recursos de
  // dev (/_next/hmr etc.) por host estranho e a hidratação nunca acontece.
  allowedDevOrigins: ["172.16.1.48"],
};

export default withPWA(nextConfig);
