import {
  TIPOS_ENTRADA,
  type Movimiento,
  type Pesos,
  type TipoMovimiento,
} from './tipos'

/**
 * Cálculo de saldos.
 *
 * Ninguna de estas funciones lee ni escribe en la base de datos: reciben la
 * lista de movimientos y devuelven números. Esa separación es lo que permite
 * probar la exactitud del dato financiero sin levantar nada.
 */

const ENTRADAS = new Set<string>(TIPOS_ENTRADA)

/** `+1` si el tipo suma a la billetera, `-1` si resta. */
export function signoDe(tipo: TipoMovimiento): 1 | -1 {
  return ENTRADAS.has(tipo) ? 1 : -1
}

export function esEntrada(tipo: TipoMovimiento): boolean {
  return ENTRADAS.has(tipo)
}

/** Lo que el movimiento le hace al saldo: positivo o negativo. */
export function efectoEnSaldo(movimiento: Movimiento): Pesos {
  if (movimiento.estado === 'anulado') return 0
  return signoDe(movimiento.tipo) * movimiento.monto
}

/** Los movimientos anulados siguen en el historial, pero no suman. */
export function soloVigentes(movimientos: readonly Movimiento[]): Movimiento[] {
  return movimientos.filter((m) => m.estado === 'vigente')
}

/**
 * Saldo de una billetera.
 * Recibe TODOS los movimientos históricos de esa billetera, no solo los del
 * día: el efectivo del cajón no se reinicia cada mañana, viene arrastrado
 * de ayer. Ese arrastre es justamente la base de apertura.
 */
export function saldoDe(
  movimientos: readonly Movimiento[],
  billeteraId: string,
): Pesos {
  let saldo = 0
  for (const movimiento of movimientos) {
    if (movimiento.billeteraId !== billeteraId) continue
    saldo += efectoEnSaldo(movimiento)
  }
  return saldo
}

/** Saldo de cada billetera, en un solo recorrido. */
export function saldosPorBilletera(
  movimientos: readonly Movimiento[],
): Map<string, Pesos> {
  const saldos = new Map<string, Pesos>()
  for (const movimiento of movimientos) {
    const efecto = efectoEnSaldo(movimiento)
    if (efecto === 0) continue
    saldos.set(movimiento.billeteraId, (saldos.get(movimiento.billeteraId) ?? 0) + efecto)
  }
  return saldos
}

export interface ResumenPeriodo {
  entro: Pesos
  salio: Pesos
  /** `entro - salio`. Se llama neto, nunca utilidad: no descuenta el costo. */
  neto: Pesos
  cantidad: number
}

/**
 * Entró, salió y neto de un conjunto de movimientos.
 *
 * Los traslados se excluyen a propósito: mover plata de Nequi al cajón no es
 * un ingreso ni un gasto. Contarlos infla las ventas del mes con plata que
 * ya estaba adentro.
 *
 * Los ajustes de arqueo también se excluyen: son correcciones de saldo, no
 * plata que entró o salió del negocio. Se reportan aparte, en el historial
 * de cierres, que es donde un patrón de faltantes se puede ver.
 */
export function resumirPeriodo(movimientos: readonly Movimiento[]): ResumenPeriodo {
  let entro = 0
  let salio = 0
  let cantidad = 0

  for (const movimiento of movimientos) {
    if (movimiento.estado === 'anulado') continue
    if (esTraslado(movimiento.tipo) || esAjuste(movimiento.tipo)) continue

    cantidad += 1
    if (esEntrada(movimiento.tipo)) entro += movimiento.monto
    else salio += movimiento.monto
  }

  return { entro, salio, neto: entro - salio, cantidad }
}

export function esTraslado(tipo: TipoMovimiento): boolean {
  return tipo === 'traslado_entrada' || tipo === 'traslado_salida'
}

export function esAjuste(tipo: TipoMovimiento): boolean {
  return tipo === 'ajuste_sobrante' || tipo === 'ajuste_faltante'
}

/** Total por categoría, de mayor a menor. Para «gastos por categoría». */
export function totalPorCategoria(
  movimientos: readonly Movimiento[],
  direccion: 'entrada' | 'salida',
): Array<{ categoriaId: string | null; total: Pesos; cantidad: number }> {
  const acumulado = new Map<string | null, { total: Pesos; cantidad: number }>()

  for (const movimiento of movimientos) {
    if (movimiento.estado === 'anulado') continue
    if (esTraslado(movimiento.tipo) || esAjuste(movimiento.tipo)) continue
    if (esEntrada(movimiento.tipo) !== (direccion === 'entrada')) continue

    const previo = acumulado.get(movimiento.categoriaId) ?? { total: 0, cantidad: 0 }
    acumulado.set(movimiento.categoriaId, {
      total: previo.total + movimiento.monto,
      cantidad: previo.cantidad + 1,
    })
  }

  return [...acumulado.entries()]
    .map(([categoriaId, datos]) => ({ categoriaId, ...datos }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Variación porcentual contra el periodo anterior.
 * Devuelve `null` cuando la base es cero: «subió un 100%» comparado contra
 * un día sin ventas no significa nada y solo confunde.
 */
export function variacion(actual: Pesos, anterior: Pesos): number | null {
  if (anterior === 0) return null
  return ((actual - anterior) / anterior) * 100
}
