/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@packrat/web-ui', '@packrat/overpass'],
};

export default nextConfig;
