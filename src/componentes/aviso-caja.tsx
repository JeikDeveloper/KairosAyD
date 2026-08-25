import Link from 'next/link'

import type { SituacionCaja } from '@/dominio/arqueo'
import { diaCorto, horaEnBogota } from '@/dominio/fecha'

/**
 * La franja de estado de la caja: el primer elemento de la pantalla «Hoy».
 *
 * Con la caja cerrada se convierte en el botón «Abrir caja» y bloquea el
 * resto: no se registra nada sin caja abierta. Esa regla también vive en la
 * base de datos, pero aquí es donde el dueño la entiende.
 */
export function AvisoCaja({ situacion }: { situacion: SituacionCaja }) {
  if (situacion.estado === 'abierta') {
    return (
      <p className="-mx-4 -mt-5 mb-1 flex items-center gap-2 bg-verde-suave px-4 py-2.5 text-xs font-semibold text-verde">
        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-verde" />
        Caja abierta desde las {horaEnBogota(situacion.sesion.abiertaEn)}
      </p>
    )
  }

  if (situacion.estado === 'olvidada') {
    // Nunca cierra sola en silencio, y no deja abrir el día nuevo encima
    // del viejo: eso mezclaría dos días de movimientos en un solo arqueo.
    return (
      <div className="rounded-lg border border-oro bg-oro-suave p-4">
        <h2 className="text-sm font-bold text-oro">
          La caja del {diaCorto(situacion.sesion.fechaOperativa)} quedó abierta
        </h2>
        <p className="mt-1.5 text-sm text-tinta-2">
          Lleva {Math.round(situacion.horas)} horas sin cerrar. Ciérrala antes de seguir
          registrando; si no, las ventas de hoy se van a mezclar con las de ese día y el
          arqueo no va a servir.
        </p>
        <Link
          href="/caja/cerrar"
          className="boton-principal mt-3 bg-oro text-papel shadow-none"
        >
          Cerrar la caja del {diaCorto(situacion.sesion.fechaOperativa)}
        </Link>
      </div>
    )
  }

  const ultima = situacion.ultimaSesion

  return (
    <div className="rounded-lg border border-linea-fuerte bg-superficie p-4">
      <h2 className="text-base font-bold">La caja está cerrada</h2>
      <p className="mt-1.5 text-sm text-tinta-2">
        {ultima
          ? `El último cierre fue el ${diaCorto(ultima.fechaOperativa)}. Abre la caja para poder registrar ventas y gastos.`
          : 'Abre la caja para empezar a registrar ventas y gastos.'}
      </p>
      <Link
        href="/caja/abrir"
        className="boton-principal mt-3"
      >
        Abrir caja
      </Link>
    </div>
  )
}
