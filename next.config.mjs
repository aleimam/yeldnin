/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep Prisma's engine external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Appearance logo/favicon upload goes through a Server Action; raise the body
  // limit (default 1 MB) to match the 32 MB upload policy (+ nginx 35m).
  experimental: {
    serverActions: { bodySizeLimit: "35mb" },
  },
  eslint: {
    // Lint is run separately in CI; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
