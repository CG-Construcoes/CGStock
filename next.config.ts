import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Páginas HTML são por-usuário (CSP com nonce) e não podem ser cacheadas
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    disableDevLogs: true,
    // Segurança: nunca cachear páginas HTML autenticadas nem chamadas de API
    // no Service Worker. A entrada é avaliada antes das regras padrão do plugin.
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === "document",
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  }
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
