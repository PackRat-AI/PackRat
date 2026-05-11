/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@packrat/web-ui', '@packrat/app'],
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
