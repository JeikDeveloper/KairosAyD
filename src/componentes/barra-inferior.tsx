'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Cinco destinos, ni uno más.
 *
 * «Movimientos» no está aquí a propósito: nadie abre el historial en frío,
 * se abre porque una cifra no cuadra. Se llega a él tocando esa cifra, y
 * llega ya filtrado.
 */
const DESTINOS = [
  { href: '/hoy', etiqueta: 'Hoy' },
  { href: '/caja', etiqueta: 'Caja' },
  { href: '/registrar', etiqueta: 'Registrar', central: true },
  { href: '/reportes', etiqueta: 'Reportes' },
  { href: '/mas', etiqueta: 'Más' },
] as const

export function BarraInferior() {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-lg border-t
                 border-linea bg-superficie lg:max-w-5xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 items-end">
        {DESTINOS.map((destino) => {
          const activo = ruta.startsWith(destino.href)

          if ('central' in destino && destino.central) {
            return (
              <li key={destino.href} className="text-center">
                <Link
                  href={destino.href}
                  className="flex flex-col items-center pb-2.5 pt-2"
                  aria-label="Registrar un movimiento"
                >
                  <span
                    aria-hidden
                    className="-mt-3.5 flex h-11 w-11 items-center justify-center rounded-full
                               bg-verde text-2xl font-bold leading-none text-sobre-verde"
                  >
                    +
                  </span>
                  <span className="mt-1 font-mono text-[0.5625rem] tracking-wide text-tinta-3">
                    Registrar
                  </span>
                </Link>
              </li>
            )
          }

          return (
            <li key={destino.href} className="text-center">
              <Link
                href={destino.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col justify-center px-1 pb-2.5 pt-2.5
                            font-mono text-[0.5625rem] tracking-wide
                            ${activo ? 'font-semibold text-verde' : 'text-tinta-3'}`}
              >
                {destino.etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
