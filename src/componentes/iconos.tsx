/**
 * Iconos de la barra de navegación.
 *
 * Dibujados a mano en SVG, sin librería: son cinco, pesan unos bytes y
 * cualquier paquete de iconos costaría más que todo el resto del JavaScript
 * de la página.
 *
 * `activo` los rellena en vez de solo delinearlos. Con un usuario de nivel
 * técnico bajo, el color no basta para decir en qué pestaña está: el relleno
 * se distingue incluso a contraluz en la calle o con daltonismo.
 */

interface PropsIcono {
  activo?: boolean
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconoHoy({ activo, className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 10.5 12 3l9 7.5"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.18 : 0}
      />
      <path
        d="M5.5 9.5V20h13V9.5"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.18 : 0}
      />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  )
}

/** Un cajón de dinero: es la metáfora que el dueño ya tiene en la cabeza. */
export function IconoCaja({ activo, className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="2"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.18 : 0}
      />
      <path d="M3 11h18" />
      <path d="M9.5 15.5h5" />
      <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V7" />
    </svg>
  )
}

export function IconoReportes({ activo, className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 20h17" />
      <rect
        x="5.5"
        y="12"
        width="3.5"
        height="6"
        rx="0.75"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.28 : 0}
      />
      <rect
        x="10.5"
        y="8"
        width="3.5"
        height="10"
        rx="0.75"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.28 : 0}
      />
      <rect
        x="15.5"
        y="4.5"
        width="3.5"
        height="13.5"
        rx="0.75"
        fill={activo ? 'currentColor' : 'none'}
        fillOpacity={activo ? 0.28 : 0}
      />
    </svg>
  )
}

export function IconoMas({ activo, className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
      {activo ? <circle cx="19" cy="17" r="1.5" fill="currentColor" stroke="none" /> : null}
    </svg>
  )
}
