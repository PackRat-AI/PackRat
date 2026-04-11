import webpack from 'next/dist/compiled/webpack/webpack-lib.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Next.js 15.4.x regression: static export resolves React to the
  // react-server build (no hooks) for server chunks, causing
  // useContext/useState to be null during pre-rendering.
  // Replace react.react-server.js → index.js at the module level.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/react\.react-server\.js$/, (resource) => {
          resource.request = resource.request.replace('react.react-server.js', 'index.js');
        }),
        new webpack.NormalModuleReplacementPlugin(/jsx-runtime\.react-server\.js$/, (resource) => {
          resource.request = resource.request.replace(
            'jsx-runtime.react-server.js',
            'jsx-runtime.js',
          );
        }),
        new webpack.NormalModuleReplacementPlugin(
          /jsx-dev-runtime\.react-server\.js$/,
          (resource) => {
            resource.request = resource.request.replace(
              'jsx-dev-runtime.react-server.js',
              'jsx-dev-runtime.js',
            );
          },
        ),
      );
    }
    return config;
  },
};

export default nextConfig;
