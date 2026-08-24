/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repository lives under OneDrive while another lockfile exists in the
  // Windows user directory. Pin both resolvers to this app so Next never scans
  // C:\\Users\\micha (which also caused production build EPERM failures).
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
