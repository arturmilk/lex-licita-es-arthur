/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["licita.novagente.com.br", "localhost:3000"],
    },
  },
};

module.exports = nextConfig;
