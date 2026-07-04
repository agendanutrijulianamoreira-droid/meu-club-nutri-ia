const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                // Verde sálvia — cor primária da marca (botões e ações principais)
                sage: {
                    50: '#F5F7F2',
                    100: '#E9EDE1',
                    200: '#D3DBC5',
                    300: '#B7C4A2',
                    400: '#9CAF88',
                    500: '#82986C',
                    600: '#6B8158',
                    700: '#556647',
                    800: '#45523B',
                    900: '#3A4432',
                },
                // Terracota clara — acentos e destaques quentes
                terracotta: {
                    50: '#FDF4F0',
                    100: '#FBE7DE',
                    200: '#F5C9B6',
                    300: '#EDA98C',
                    400: '#E2875F',
                    500: '#D06B42',
                    600: '#B3552F',
                    700: '#8F4325',
                    800: '#6F351F',
                    900: '#5A2C1B',
                },
                // Areia / nude — fundos secundários de cards
                sand: {
                    50: '#FDFCFA',
                    100: '#FAF7F2',
                    200: '#F3EDE3',
                    300: '#E9DFCE',
                    400: '#DCCEB0',
                    500: '#C9B490',
                    600: '#B0966F',
                    700: '#8F7757',
                    800: '#6E5B44',
                    900: '#564737',
                },
            },
            fontFamily: {
                sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
                serif: ['var(--font-serif)', 'Georgia', ...defaultTheme.fontFamily.serif],
            },
            boxShadow: {
                // Sombras difusas e suaves — nunca marcadas/duras
                'soft-sm': '0 1px 3px 0 rgb(41 37 36 / 0.04)',
                soft: '0 8px 24px -8px rgb(41 37 36 / 0.10), 0 2px 8px -4px rgb(41 37 36 / 0.05)',
                'soft-lg': '0 16px 40px -12px rgb(41 37 36 / 0.12), 0 4px 12px -4px rgb(41 37 36 / 0.06)',
                'soft-sage': '0 10px 28px -8px rgb(107 129 88 / 0.28)',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
