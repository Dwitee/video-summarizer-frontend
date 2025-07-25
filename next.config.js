// next.config.js
const EXTERNAL_IP = "35.236.26.26";
const BASE_URL = `http://${EXTERNAL_IP}:8080`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy all /api/* calls in dev & prod to your VM
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BASE_URL}/:path*`,
      },
    ];
  },
  // Prevent bundling server-side modules like fs in the client
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;