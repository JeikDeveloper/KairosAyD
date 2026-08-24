import { formatearPesos } from '@/dominio/dinero'
import { horaEnBogota } from '@/dominio/fecha'
import { esEntrada } from '@/dominio/movimientos'
import { ETIQUETA_TIPO, type Billetera, type Movimiento } from '@/dominio/tipos'

/**
 * Lista de movimientos.
 *
 * Cada línea lleva hora y billetera porque el error más común es el de
 * billetera: cobró por Nequi y lo registró como efectivo. Sin ver la
 * billetera al lado del monto, ese error es invisible.
 */
export function ListaMovimientos({
  movimientos,
  billeteras,
}: {
  movimientos: readonly Movimiento[]
  billeteras: readonly Billetera[]
}) {
  const nombreDe = new Map(billeteras.map((b) => [b.id, b.nombre]))

  return (
    <ul>
      {movimientos.map((movimiento) => {
        const entrada = esEntrada(movimiento.tipo)
        const anulado = movimiento.estado === 'anulado'

        return (
          <li
            key={movimiento.id}
            className="flex items-start justify-between gap-3 border-b border-linea py-1.5
                       text-[0.8125rem] last:border-b-0"
          >
            <span className={anulado ? 'text-tinta-3 line-through' : ''}>
              {movimiento.nota?.trim() || ETIQUETA_TIPO[movimiento.tipo]}
              <small className="mt-0.5 block font-mono text-[0.625rem] not-italic text-tinta-3 no-underline">
                {nombreDe.get(movimiento.billeteraId) ?? 'Billetera'} ·{' '}
                {horaEnBogota(movimiento.creadoEn)}
                {anulado ? ' · anulado' : ''}
              </small>
            </span>

            <b
              className={`cifra whitespace-nowrap font-mono font-semibold
                          ${anulado ? 'text-tinta-3 line-through' : ''}`}
            >
              {entrada ? '+' : '−'}
              {formatearPesos(movimiento.monto)}
            </b>
          </li>
        )
      })}
    </ul>
  )
}
