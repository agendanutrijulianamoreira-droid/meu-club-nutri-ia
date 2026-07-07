/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },
    eslint: {
        // O eslint.config.mjs antigo (formato do ESLint 9) era incompatível com o eslint@8
        // instalado, então o Next sempre pulava o lint no build sem avisar. Ao trocar para
        // .eslintrc.json (formato compatível), o lint passou a ser detectado de verdade e o
        // build passou a falhar nos ~975 problemas pré-existentes (majoritariamente
        // no-explicit-any). Mantendo ignoreDuringBuilds para preservar o comportamento de
        // deploy que já existia — ver Fase 12, item 6 de docs/ROADMAP_EVOLUCAO_PLATAFORMA.md
        // para o plano de limpeza gradual. `npx eslint .` continua funcionando normalmente
        // para uso manual/dev-time.
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
