/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // File uploads (bill photos, cheque photos, product images) are streamed
  // through the /api/uploads route rather than server actions, so we keep
  // the default body size limit tight and enforce real limits in code
  // (see src/lib/providers/storage.ts) instead of relying on this alone.
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
