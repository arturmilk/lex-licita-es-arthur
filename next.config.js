/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["iesa.novagente.com.br", "licita.novagente.com.br", "localhost:3000"],
    },
  },
};

module.exports = nextConfig;
