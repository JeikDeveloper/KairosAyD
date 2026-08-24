import type { Billetera, ConteoArqueo, Pesos, SesionCaja } from './tipos'

/**
 * Arqueo y cierre de caja.
 *
 * La regla que sostiene todo: SE CUENTA PRIMERO, y solo después la app
 * revela cuánto debería haber. Si la pantalla muestra «deben haber $487.300»
 * antes de contar, el dueño cuenta hasta que le dé esa cifra y el arqueo
 * deja de medir nada.
 *
 * Esa regla está en los tipos, no solo en la interfaz: `revelar()` es la
 * única función que devuelve el saldo esperado, y exige recibir el conteo
 * completo para hacerlo. No hay forma de pintar el esperado antes de tener
 * los números del dueño.
 */

/**
 * Diferencia que se considera sencillo o redondeo y no vale la pena
 * investigar. Configurable por el dueño; este es el valor de arranque.
 */
export const UMBRAL_DIFERENCIA_POR_DEFECTO: Pesos = 2_000

export type Veredicto = 'cuadra' | 'diferencia_menor' | 'revisar' | 'sin_exigir'

export interface FilaArqueo {
  billeteraId: string
  esperado: Pesos
  contado: Pesos
  /** `contado - esperado`. Positivo es sobrante, negativo es faltante. */
  diferencia: Pesos
  veredicto: Veredicto
  /** `true` si hay que exigir un motivo antes de dejar cerrar. */
  exigeMotivo: boolean
}

export interface Arqueo {
  filas: FilaArqueo[]
  /** Suma de las diferencias. Puede cuadrar en total y estar mal por billetera. */
  diferenciaTotal: Pesos
  /** `true` si toda billetera con diferencia relevante ya tiene motivo. */
  listoParaCerrar: boolean
}

/**
 * Compara lo contado contra lo que dicen los saldos.
 *
 * @param saldos saldo por billetera, calculado en Postgres por la vista
 *   `saldos_por_billetera`.
 *
 *   Recibe los saldos ya sumados y NO la lista de movimientos, a propósito.
 *   Sumar aquí obligaría a traer toda la historia de la tienda en cada
 *   cierre, y la API corta en 1000 filas: a los pocos meses el arqueo
 *   calcularía el esperado con datos parciales y marcaría faltantes que no
 *   existen, sin dar ningún error. Postgres suma la columna entera sin ese
 *   límite y sin mover los datos.
 *
 *   El saldo incluye toda la historia, no solo el día: el efectivo del cajón
 *   viene arrastrado de ayer.
 */
export function revelar(
  saldos: ReadonlyMap<string, Pesos>,
  billeteras: readonly Billetera[],
  conteos: readonly ConteoArqueo[],
  umbral: Pesos = UMBRAL_DIFERENCIA_POR_DEFECTO,
): Arqueo {
  const porBilletera = new Map(conteos.map((c) => [c.billeteraId, c]))

  const filas: FilaArqueo[] = billeteras
    .filter((billetera) => billetera.activa)
    .map((billetera) => {
      const conteo = porBilletera.get(billetera.id)
      const esperado = saldos.get(billetera.id) ?? 0
      const contado = conteo?.contado ?? 0
      const diferencia = contado - esperado
      const veredicto = dictaminar(diferencia, billetera, umbral)

      return {
        billeteraId: billetera.id,
        esperado,
        contado,
        diferencia,
        veredicto,
        exigeMotivo: veredicto !== 'cuadra' && veredicto !== 'sin_exigir',
      }
    })

  const listoParaCerrar = filas.every(
    (fila) => !fila.exigeMotivo || Boolean(porBilletera.get(fila.billeteraId)?.motivo),
  )

  return {
    filas,
    diferenciaTotal: filas.reduce((suma, fila) => suma + fila.diferencia, 0),
    listoParaCerrar,
  }
}

function dictaminar(diferencia: Pesos, billetera: Billetera, umbral: Pesos): Veredicto {
  if (diferencia === 0) return 'cuadra'
  // A una cuenta compartida con el uso personal no se le puede exigir cuadre
  // exacto. Marcarla en rojo todos los días solo enseña a ignorar el rojo.
  if (billetera.mezclada) return 'sin_exigir'
  return Math.abs(diferencia) <= umbral ? 'diferencia_menor' : 'revisar'
}

/** Cómo se le presenta cada veredicto al dueño. */
export const ETIQUETA_VEREDICTO: Record<Veredicto, string> = {
  cuadra: 'Cuadra',
  diferencia_menor: 'Diferencia menor',
  revisar: 'Revisar',
  sin_exigir: 'Cuenta mezclada',
}

// ---------------------------------------------------------------------------
// Cierre
// ---------------------------------------------------------------------------

/** Un movimiento por crear, antes de tener id ni fecha. */
export interface AjustePropuesto {
  tipo: 'ajuste_sobrante' | 'ajuste_faltante'
  monto: Pesos
  billeteraId: string
  nota: string
}

/**
 * Convierte las diferencias del arqueo en movimientos de ajuste.
 *
 * La diferencia NUNCA se resuelve sobrescribiendo un saldo: se registra
 * como un movimiento visible, con su motivo, que queda para siempre en el
 * historial. Así, tres «no sé qué pasó» seguidos en la misma billetera se
 * pueden ver como el patrón que son.
 */
export function ajustesDelCierre(
  arqueo: Arqueo,
  conteos: readonly ConteoArqueo[],
): AjustePropuesto[] {
  const porBilletera = new Map(conteos.map((c) => [c.billeteraId, c]))

  return arqueo.filas
    .filter((fila) => fila.diferencia !== 0)
    .map((fila) => {
      const conteo = porBilletera.get(fila.billeteraId)
      const nota = [conteo?.motivo, conteo?.nota].filter(Boolean).join(' — ')
      return {
        tipo: fila.diferencia > 0 ? ('ajuste_sobrante' as const) : ('ajuste_faltante' as const),
        monto: Math.abs(fila.diferencia),
        billeteraId: fila.billeteraId,
        nota: nota || 'Diferencia de arqueo sin motivo registrado',
      }
    })
}

/**
 * Cuánto se retira del cajón al dejar la base de mañana.
 *
 * Este es el paso que más se olvidaría si fuera opcional, y es justo el
 * momento en que la plata sale del negocio. Si no se registra, mañana el
 * efectivo esperado va a estar inflado y el arqueo va a marcar un faltante
 * que no es tal.
 */
export function retiroPorBaseSiguiente(
  efectivoContado: Pesos,
  baseSiguiente: Pesos,
): Pesos {
  if (baseSiguiente < 0) throw new Error('La base no puede ser negativa')
  if (baseSiguiente > efectivoContado) {
    throw new Error('No puedes dejar más plata de la que contaste en el cajón')
  }
  return efectivoContado - baseSiguiente
}

// ---------------------------------------------------------------------------
// Estado de la caja
// ---------------------------------------------------------------------------

export type SituacionCaja =
  | { estado: 'cerrada'; ultimaSesion: SesionCaja | null }
  | { estado: 'abierta'; sesion: SesionCaja }
  | { estado: 'olvidada'; sesion: SesionCaja; horas: number }

/**
 * Qué le toca hacer al dueño ahora mismo.
 * `olvidada` es una sesión que lleva demasiadas horas abierta: casi siempre
 * significa que se olvidó cerrar ayer. La app nunca cierra sola en silencio,
 * pero tampoco deja abrir el día nuevo encima del viejo.
 */
export function situacionDeCaja(
  sesionAbierta: SesionCaja | null,
  ultimaCerrada: SesionCaja | null,
  horasLimite: number,
  ahora: Date = new Date(),
): SituacionCaja {
  if (!sesionAbierta) return { estado: 'cerrada', ultimaSesion: ultimaCerrada }

  const horas = (ahora.getTime() - new Date(sesionAbierta.abiertaEn).getTime()) / 3_600_000
  if (horas > horasLimite) return { estado: 'olvidada', sesion: sesionAbierta, horas }

  return { estado: 'abierta', sesion: sesionAbierta }
}
