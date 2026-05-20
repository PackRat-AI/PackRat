/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
  webpack: (config, { isServer }) => {
    // Leaflet is loaded from CDN at runtime (see layout.tsx). Tell webpack to
    // skip bundling leaflet in both the server and client passes so the build
    // succeeds even when `leaflet` is absent from node_modules. The trail-map
    // component uses `{ ssr: false }` so leaflet is never executed server-side.
    if (isServer) {
      const prev = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [...prev, 'leaflet'];
    } else {
      config.externals = { leaflet: 'L' };
    }
    return config;
  },
};

export default nextConfig;
