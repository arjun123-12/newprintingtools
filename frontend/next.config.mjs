/** @type {import('next').NextConfig} */
const nextConfig = {

  output: 'export',
  reactStrictMode: false,
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable filesystem caching in dev on Windows to prevent missing chunk race conditions
      config.cache = false;
    }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        zlib: false,
        crypto: false,
      };
    }
    return config;
  },
  images: {

    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
  },
};

export default nextConfig;
