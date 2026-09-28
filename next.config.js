/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Diretório de build configurável: permite rodar o servidor de desenvolvimento
  // e um preview separados sem que um `next build` derrube o `next dev` em execução.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "lexlicitacoes.novagente.com.br",
        "iesa.novagente.com.br",
        "licita.novagente.com.br",
        "localhost:3000",
        "localhost:3002",
      ],
    },
  },
};

module.exports = nextConfig;
