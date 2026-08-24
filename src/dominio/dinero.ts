import type { Pesos } from './tipos'

/**
 * Dinero. Todo en pesos enteros.
 *
 * Nunca se usan decimales ni `float` para plata: 0.1 + 0.2 no da 0.3 en
 * coma flotante, y un error de un peso repetido mil veces es un descuadre
 * que nadie va a poder explicar en el arqueo.
 */

/** Máximo aceptado en un solo movimiento: mil millones. */
export const MONTO_MAXIMO: Pesos = 1_000_000_000

export class MontoInvalido extends Error {
  constructor(razon: string) {
    super(razon)
    this.name = 'MontoInvalido'
  }
}

/** Valida un monto antes de guardarlo. Lanza si no sirve. */
export function exigirMontoValido(monto: number): Pesos {
  if (!Number.isFinite(monto)) throw new MontoInvalido('El monto no es un número')
  if (!Number.isInteger(monto)) throw new MontoInvalido('El monto debe ser en pesos enteros')
  if (monto <= 0) throw new MontoInvalido('El monto debe ser mayor que cero')
  if (monto > MONTO_MAXIMO) throw new MontoInvalido('El monto es demasiado grande')
  return monto
}

/** `true` si el monto sirve para guardarse. No lanza. */
export function esMontoValido(monto: number): boolean {
  try {
    exigirMontoValido(monto)
    return true
  } catch {
    return false
  }
}

const FORMATO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const FORMATO_LLANO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** `487300` → `"$ 487.300"` */
export function formatearPesos(monto: Pesos): string {
  return FORMATO_COP.format(monto)
}

/** `487300` → `"487.300"`, para cuando el `$` ya está en la etiqueta. */
export function formatearNumero(monto: Pesos): string {
  return FORMATO_LLANO.format(monto)
}

/**
 * Con signo explícito, para listas de movimientos y diferencias de arqueo.
 * El cero se muestra sin signo: «$ 0» y no «+$ 0».
 */
export function formatearConSigno(monto: Pesos): string {
  if (monto === 0) return formatearPesos(0)
  const signo = monto > 0 ? '+' : '−'
  return `${signo}${formatearPesos(Math.abs(monto))}`
}

/**
 * Lee lo que el dueño escribió en el teclado numérico.
 * Acepta «12.000», «12000», «$ 12.000», «12,000». Devuelve `null` si no
 * hay un número usable — nunca un cero silencioso, que se guardaría como
 * un movimiento de $0 sin que nadie se dé cuenta.
 */
export function leerPesos(texto: string): Pesos | null {
  const limpio = texto.replace(/[^\d]/g, '')
  if (limpio === '') return null
  const valor = Number.parseInt(limpio, 10)
  return Number.isSafeInteger(valor) ? valor : null
}

/** Denominaciones en circulación en Colombia, de mayor a menor. */
export const DENOMINACIONES: readonly Pesos[] = [
  100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50,
] as const

export type ConteoDenominaciones = Partial<Record<number, number>>

/**
 * Suma un conteo por denominación.
 * Contar por denominación reduce el error de conteo y, cuando falta plata,
 * dice *qué* falta: un billete de $50.000 y veinte monedas de $500 cuentan
 * historias muy distintas.
 */
export function sumarDenominaciones(conteo: ConteoDenominaciones): Pesos {
  let total = 0
  for (const denominacion of DENOMINACIONES) {
    const cantidad = conteo[denominacion] ?? 0
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      throw new MontoInvalido(`Cantidad inválida para la denominación ${denominacion}`)
    }
    total += denominacion * cantidad
  }
  return total
}
