'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IconoCaja, IconoHoy, IconoMas, IconoReportes } from './iconos'

/**
 * Cinco destinos, ni uno más.
 *
 * «Movimientos» no está aquí a propósito: nadie abre el historial en frío,
 * se abre porque una cifra no cuadra. Se llega a él tocando esa cifra, y
 * llega ya filtrado.
 */
const DESTINOS = [
  { href: '/hoy', etiqueta: 'Hoy', Icono: IconoHoy },
  { href: '/caja', etiqueta: 'Caja', Icono: IconoCaja },
  { href: '/reportes', etiqueta: 'Reportes', Icono: IconoReportes },
  { href: '/mas', etiqueta: 'Más', Icono: IconoMas },
] as const

export function BarraInferior() {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-lg border-t
                 border-linea bg-superficie shadow-[0_-1px_16px_-6px_rgba(0,0,0,0.18)]
                 lg:max-w-5xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 items-stretch">
        <Pestana destino={DESTINOS[0]} ruta={ruta} />
        <Pestana destino={DESTINOS[1]} ruta={ruta} />

        {/* El botón de registrar va al centro y elevado: es lo que se toca
            veinte veces al día, y en un celular el centro-abajo es lo que
            alcanza el pulgar sin mover la mano. */}
        <li className="flex justify-center">
          <Link
            href="/registrar"
            aria-label="Registrar un movimiento"
            className="group flex flex-col items-center pt-1"
          >
            <span
              aria-hidden
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full
                         bg-verde text-3xl font-bold leading-none text-sobre-verde
                         shadow-[0_4px_14px_-2px_rgba(15,107,79,0.5)]
                         ring-4 ring-superficie transition-transform duration-100
                         group-active:scale-90"
            >
              +
            </span>
            <span className="mt-1 pb-2 text-[0.6875rem] font-semibold text-tinta-2">
              Registrar
            </span>
          </Link>
        </li>

        <Pestana destino={DESTINOS[2]} ruta={ruta} />
        <Pestana destino={DESTINOS[3]} ruta={ruta} />
      </ul>
    </nav>
  )
}

function Pestana({
  destino,
  ruta,
}: {
  destino: (typeof DESTINOS)[number]
  ruta: string
}) {
  const activo = ruta.startsWith(destino.href)
  const { Icono } = destino

  return (
    <li>
      <Link
        href={destino.href}
        aria-current={activo ? 'page' : undefined}
        className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2
                    transition-colors duration-100 active:bg-superficie-2
                    ${activo ? 'text-verde' : 'text-tinta-2'}`}
      >
        <Icono activo={activo} className="h-[22px] w-[22px]" />
        <span className={`text-[0.6875rem] leading-none ${activo ? 'font-bold' : 'font-medium'}`}>
          {destino.etiqueta}
        </span>
        {/* Subrayado corto bajo la pestaña activa: el color por sí solo no
            sirve para quien no distingue el verde del gris. */}
        <span
          aria-hidden
          className={`h-[2px] w-5 rounded-full ${activo ? 'bg-verde' : 'bg-transparent'}`}
        />
      </Link>
    </li>
  )
}
