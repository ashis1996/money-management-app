/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We keep cross-origin headers tight so the (future) shareable
  // dashboard / weekly-summary deep links can't be embedded into a
  // hostile parent. Adjust per-route via headers() if a public
  // marketing page ever needs to break out.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
