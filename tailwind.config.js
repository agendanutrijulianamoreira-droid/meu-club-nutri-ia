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
                    foreground: 'hsl(var(--foreground))',
                },
                // Paleta do Clube da Paciente — verde sálvia + tons terrosos,
                // substitui azul/verde vibrante por algo mais acolhedor e sofisticado
                sage: {
                    50: '#f5f7f1',
                    100: '#e7ecdf',
                    200: '#d2ddc1',
                    300: '#b5c69b',
                    400: '#96ac78',
                    500: '#79915d',
                    600: '#5f7549',
                    700: '#4c5d3b',
                    800: '#3e4b31',
                    900: '#343f2a',
                },
                clay: {
                    50: '#fdf6f0',
                    100: '#faeadd',
                    200: '#f2d3b7',
                    300: '#e8b489',
                    400: '#dc9564',
                    500: '#c97a46',
                    600: '#ab6035',
                    700: '#894c2d',
                    800: '#6f3e28',
                    900: '#5c3423',
                },
                sand: {
                    50: '#fdfcfa',
                    100: '#faf6ef',
                    200: '#f2ead9',
                    300: '#e6d8bc',
                    400: '#d5c095',
                    500: '#c1a672',
                },
            },
            fontFamily: {
                // Fontes do Clube da Paciente: serifada elegante para títulos
                // (font-display) + sans-serif limpa para texto/números (font-body)
                display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
                body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
