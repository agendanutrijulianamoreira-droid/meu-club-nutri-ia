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
                // Cream — fundo principal da marca "Rainha" (sofisticado, acolhedor)
                cream: {
                    DEFAULT: '#F4EFE4',
                    50: '#FEFCF8',
                    100: '#F4EFE4',
                    200: '#EDE5D3',
                    300: '#E3D7BC',
                    400: '#D6C49F',
                    500: '#C7AF7F',
                    600: '#B39763',
                    700: '#967D4F',
                    800: '#786440',
                    900: '#5F4F35',
                },
                // Marrom escuro — textos principais e botões primários
                brown: {
                    DEFAULT: '#2B1A10',
                    50: '#F7F1EC',
                    100: '#EDE0D5',
                    200: '#D9C1AC',
                    300: '#C09D7D',
                    400: '#A17750',
                    500: '#7D5A3A',
                    600: '#5E4229',
                    700: '#47301D',
                    800: '#2B1A10',
                    900: '#1C0F09',
                },
                // Ouro — destaques, ícones, badges de gamificação
                gold: {
                    DEFAULT: '#C9A435',
                    50: '#FBF7EC',
                    100: '#F5EACB',
                    200: '#EAD595',
                    300: '#DFC066',
                    400: '#D4AF4A',
                    500: '#C9A435',
                    600: '#A98A2B',
                    700: '#866D22',
                    800: '#63511A',
                    900: '#423613',
                },
                // Verde sálvia — cor secundária da marca (usos de apoio)
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
                // Terracota clara — cor secundária de apoio (acentos quentes)
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
                'soft-gold': '0 10px 28px -8px rgb(201 164 53 / 0.28)',
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
