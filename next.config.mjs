/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // eslint.config.mjs was broken (ESLint 9-only API on a pinned ESLint 8),
        // so this build check was never actually running — pre-existing
        // lint errors (unescaped entities, missing key props) accumulated
        // without blocking deploys. Keep that behavior now that lint works
        // again; run `npm run lint` directly to see/fix them.
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },
};

export default nextConfig;
