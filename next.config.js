/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal, self-contained server build for the Docker image
  // (see Dockerfile) instead of requiring the full node_modules tree.
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // tesseract.js resolves its worker script relative to its own package
  // directory at runtime (worker_threads), which breaks if webpack bundles
  // it into the .next server chunks — keep it (and its wasm core package)
  // unbundled so Node resolves them straight from node_modules.
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core'],
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
