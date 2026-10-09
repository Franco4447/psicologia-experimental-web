/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs usa módulos de Node: se carga desde node_modules en vez de empaquetarse.
  experimental: {
    serverComponentsExternalPackages: ['exceljs'],
  },
};

export default nextConfig;
