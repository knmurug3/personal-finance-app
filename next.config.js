/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // LOW-01: Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer privacy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for a year (Content-Security-Policy is set per request in proxy.ts)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Permissions policy (restrict camera/mic/location)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
