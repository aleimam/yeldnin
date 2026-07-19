/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep Prisma's engine external to the server bundle.
  // `ssh2` (via ssh2-sftp-client, the backup SFTP transport) MUST be external
  // too: it ships an optional native `sshcrypto.node`, and webpack has no loader
  // for a binary — bundling it fails the build outright. NOTE this only
  // reproduces where the native addon actually got built: on a dev machine whose
  // npm blocks install scripts the file is absent and the build passes, so this
  // must never be dropped on the strength of a green local build.
  serverExternalPackages: ["@prisma/client", "prisma", "ssh2", "ssh2-sftp-client"],
  // Appearance logo/favicon upload goes through a Server Action; raise the body
  // limit (default 1 MB) to match the 32 MB upload policy (+ nginx 35m).
  experimental: {
    serverActions: { bodySizeLimit: "35mb" },
  },
  eslint: {
    // Lint is run separately in CI; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
  // Baseline security headers on every response. (A full script-src CSP needs
  // per-request nonces for Next's inline bootstrap; deferred — `frame-ancestors`
  // here already blocks clickjacking alongside X-Frame-Options.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // SAMEORIGIN (not DENY) so the app can embed its own assets — e.g. the
          // inline PDF preview iframe on a document page. Cross-origin framing
          // (the actual clickjacking threat) is still blocked.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
