import type { Config } from 'tailwindcss'

/**
 * Paleta del documento de diseño (docs/cuadre-diario.html).
 * Los colores viven como variables CSS en globals.css para que el tema
 * oscuro sea un cambio de tokens y no una duplicación de clases.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        papel: 'rgb(var(--papel) / <alpha-value>)',
        superficie: 'rgb(var(--superficie) / <alpha-value>)',
        'superficie-2': 'rgb(var(--superficie-2) / <alpha-value>)',
        tinta: 'rgb(var(--tinta) / <alpha-value>)',
        'tinta-2': 'rgb(var(--tinta-2) / <alpha-value>)',
        'tinta-3': 'rgb(var(--tinta-3) / <alpha-value>)',
        linea: 'rgb(var(--linea) / <alpha-value>)',
        'linea-fuerte': 'rgb(var(--linea-fuerte) / <alpha-value>)',
        verde: 'rgb(var(--verde) / <alpha-value>)',
        'verde-suave': 'rgb(var(--verde-suave) / <alpha-value>)',
        'sobre-verde': 'rgb(var(--sobre-verde) / <alpha-value>)',
        ladrillo: 'rgb(var(--ladrillo) / <alpha-value>)',
        'ladrillo-suave': 'rgb(var(--ladrillo-suave) / <alpha-value>)',
        oro: 'rgb(var(--oro) / <alpha-value>)',
        'oro-suave': 'rgb(var(--oro-suave) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--fuente-sans)', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['var(--fuente-mono)', 'ui-monospace', 'Consolas', 'monospace'],
      },
      fontSize: {
        cifra: ['2.375rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
}

export default config
