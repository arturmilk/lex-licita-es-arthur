/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
