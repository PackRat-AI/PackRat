/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Linting is handled by Biome (repo standard) — never run ESLint during builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@packrat/web-ui'],
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
};

export default nextConfig;
