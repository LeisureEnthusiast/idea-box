/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy',
          value: "frame-ancestors https://teams.microsoft.com https://*.teams.microsoft.com https://*.sharepoint.com 'self';" }
      ],
    }]
  },
}
module.exports = nextConfig
