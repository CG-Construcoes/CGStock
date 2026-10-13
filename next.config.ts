import type { NextConfig } from "next";
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
    // Segurança: nunca cachear páginas HTML autenticadas nem chamadas de API
    // no Service Worker. A entrada é avaliada antes das regras padrão do plugin.
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === "document",
        handler: "NetworkOnly",
        // options precisa existir para que o plugin anexe o fallback offline
        // (handlerDidError -> /offline.html) a esta regra.
        options: {},
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: {},
      },
    ],
  }
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
