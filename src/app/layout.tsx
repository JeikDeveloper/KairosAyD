import type { Metadata, Viewport } from 'next'
import { Archivo, JetBrains_Mono } from 'next/font/google'

import './globals.css'

/*
 * Las fuentes se sirven desde el mismo dominio, no desde Google.
 * En un celular con datos flojos, un <link> a fonts.googleapis.com bloquea
 * el render hasta que resuelva; con `next/font` el archivo viaja con la
 * página y `display: swap` deja leer las cifras aunque la fuente no llegue.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--fuente-sans',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--fuente-mono',
})

export const metadata: Metadata = {
  title: 'Cuadre Diario',
  description: 'El libro de caja de la tienda, sin descuadres al cerrar',
  // La app maneja plata: no debe aparecer en resultados de búsqueda.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: bloquear el zoom rompe la accesibilidad para quien
  // no ve bien de cerca, que es justo parte del público de esta app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#101310' },
  ],
}

/**
 * Aplica el tema antes de que React hidrate, para que no haya un
 * parpadeo blanco al abrir la app de noche.
 */
const TEMA_SIN_PARPADEO = `
try {
  var guardado = localStorage.getItem('tema')
  var oscuro = guardado
    ? guardado === 'oscuro'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (oscuro) document.documentElement.classList.add('dark')
} catch (e) {}
`

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-CO"
      className={`${archivo.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SIN_PARPADEO }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
