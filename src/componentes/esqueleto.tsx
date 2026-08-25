/**
 * Bloques de carga.
 *
 * Nunca se muestra un `$0` mientras carga: un cero falso le hace creer al
 * dueño que perdió los datos del día, y eso asusta más que esperar. Se
 * dibuja la forma que va a tener la pantalla, en gris, y las cifras
 * aparecen cuando son reales.
 */

export function Bloque({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-superficie-2 ${className}`} />
}

/** Esqueleto genérico, para las pantallas menos visitadas. */
export function EsqueletoPagina() {
  return (
    <div className="flex flex-col gap-4 px-4 py-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Bloque className="h-6 w-40" />
      <div className="tarjeta p-3">
        <Bloque className="mb-3 h-3 w-24" />
        <div className="flex flex-col gap-2.5">
          <Bloque className="h-4 w-full" />
          <Bloque className="h-4 w-5/6" />
          <Bloque className="h-4 w-4/6" />
        </div>
      </div>
      <div className="tarjeta p-3">
        <Bloque className="mb-3 h-3 w-28" />
        <div className="flex flex-col gap-2.5">
          <Bloque className="h-4 w-full" />
          <Bloque className="h-4 w-3/6" />
        </div>
      </div>
    </div>
  )
}

/**
 * Esqueleto de «Hoy», con la misma forma que la pantalla real.
 * Que la silueta coincida evita el salto de contenido cuando llegan los
 * datos, que es lo que hace sentir lenta una app aunque cargue rápido.
 */
export function EsqueletoHoy() {
  return (
    <div className="flex flex-col gap-4 px-4 py-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el estado de la caja…</span>

      <Bloque className="-mx-4 -mt-5 mb-1 h-9 rounded-none" />

      <div>
        <Bloque className="mb-2 h-3 w-52" />
        <Bloque className="h-10 w-56" />
        <Bloque className="mt-2 h-3 w-40" />
      </div>

      <div className="tarjeta p-3">
        <Bloque className="mb-3 h-3 w-32" />
        <div className="flex flex-col gap-3">
          <Bloque className="h-4 w-full" />
          <Bloque className="h-4 w-full" />
          <Bloque className="h-4 w-full" />
          <Bloque className="h-4 w-full" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-linea bg-linea">
        <div className="bg-superficie px-2 py-3">
          <Bloque className="h-6" />
        </div>
        <div className="bg-superficie px-2 py-3">
          <Bloque className="h-6" />
        </div>
        <div className="bg-superficie px-2 py-3">
          <Bloque className="h-6" />
        </div>
      </div>

      <div className="tarjeta p-3">
        <Bloque className="mb-3 h-3 w-36" />
        <div className="flex flex-col gap-3">
          <Bloque className="h-8 w-full" />
          <Bloque className="h-8 w-full" />
          <Bloque className="h-8 w-full" />
        </div>
      </div>

      <Bloque className="h-12 w-full" />
    </div>
  )
}
