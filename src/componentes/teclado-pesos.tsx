'use client'

import { formatearPesos } from '@/dominio/dinero'

/**
 * Entrada de monto.
 *
 * Usa `inputMode="numeric"` en vez de `type="number"`: en móvil abre el
 * teclado numérico igual, pero no acepta `e`, `+` ni `-` ni deja que la
 * rueda del mouse cambie el monto sin querer — que en una app de plata es
 * un error silencioso y caro.
 *
 * El texto va a 16px o más porque por debajo de eso iOS hace zoom al enfocar
 * y el dueño pierde de vista el resto del formulario.
 */
export function TecladoPesos({
  valor,
  alCambiar,
  etiqueta,
  autoFoco = false,
  nombre,
}: {
  valor: string
  alCambiar: (nuevo: string) => void
  etiqueta: string
  autoFoco?: boolean
  nombre?: string
}) {
  const digitos = valor.replace(/[^\d]/g, '')
  const monto = digitos === '' ? null : Number.parseInt(digitos, 10)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold" htmlFor={`monto-${nombre ?? 'principal'}`}>
        {etiqueta}
      </label>

      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2
                     font-mono text-2xl text-tinta-3"
        >
          $
        </span>
        <input
          id={`monto-${nombre ?? 'principal'}`}
          name={nombre}
          inputMode="numeric"
          pattern="[0-9.]*"
          autoComplete="off"
          autoFocus={autoFoco}
          value={digitos === '' ? '' : new Intl.NumberFormat('es-CO').format(monto ?? 0)}
          onChange={(evento) => alCambiar(evento.target.value)}
          placeholder="0"
          className="h-16 w-full rounded-lg border border-linea bg-superficie pl-10 pr-4
                     text-right font-mono text-2xl font-bold tabular-nums
                     placeholder:text-tinta-3 focus:border-verde"
        />
      </div>

      {/* Repite el monto en palabras del formato local: es la última
          oportunidad de ver un cero de más antes de guardar. */}
      <p aria-live="polite" className="min-h-[1.25rem] text-right text-xs text-tinta-2">
        {monto && monto > 0 ? formatearPesos(monto) : ' '}
      </p>
    </div>
  )
}
