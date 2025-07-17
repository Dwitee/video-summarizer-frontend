// next.config.js
const EXTERNAL_IP = "35.236.106.128";
const BASE_URL = `http://${EXTERNAL_IP}:8080`;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
      // Proxy all /api/* calls in dev & prod to your VM
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${BASE_URL}/:path*`  // ← your VM IP:port
            }
        ];
    },
    async headers() {
      return [
        {
          source: '/',
          headers: [
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
          ],
        },
      ];
    },
  };
  
  module.exports = nextConfig;