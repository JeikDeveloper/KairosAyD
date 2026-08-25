import type { Pesos } from './tipos'

/**
 * Inventario.
 *
 * Es un segundo libro con las mismas reglas que el de la plata, y eso es
 * deliberado: un movimiento por registro, la cantidad siempre positiva, el
 * signo lo pone el tipo, y las existencias se calculan sumando en vez de
 * guardarse. Todo lo que ya sabemos del arqueo de caja aplica igual al
 * conteo de mercancía.
 */

/** Cantidad de producto. A diferencia del dinero, admite fracción. */
export type Cantidad = number

export const TIPOS_ENTRADA_INVENTARIO = [
  'compra',
  'inventario_inicial',
  'devolucion_cliente',
  'ajuste_sobrante',
] as const

export const TIPOS_SALIDA_INVENTARIO = [
  'venta',
  'devolucion_proveedor',
  'ajuste_faltante',
  'merma',
] as const

export type TipoEntradaInventario = (typeof TIPOS_ENTRADA_INVENTARIO)[number]
export type TipoSalidaInventario = (typeof TIPOS_SALIDA_INVENTARIO)[number]
export type TipoMovimientoInventario = TipoEntradaInventario | TipoSalidaInventario

export type Unidad = 'unidad' | 'libra' | 'kilo' | 'litro' | 'paquete'

export const ETIQUETA_UNIDAD: Record<Unidad, { corta: string; larga: string }> = {
  unidad: { corta: 'und', larga: 'unidades' },
  libra: { corta: 'lb', larga: 'libras' },
  kilo: { corta: 'kg', larga: 'kilos' },
  litro: { corta: 'L', larga: 'litros' },
  paquete: { corta: 'paq', larga: 'paquetes' },
}

export const ETIQUETA_TIPO_INVENTARIO: Record<TipoMovimientoInventario, string> = {
  compra: 'Compra',
  inventario_inicial: 'Inventario inicial',
  devolucion_cliente: 'Devolución de cliente',
  ajuste_sobrante: 'Sobrante de conteo',
  venta: 'Venta',
  devolucion_proveedor: 'Devolución a proveedor',
  ajuste_faltante: 'Faltante de conteo',
  merma: 'Merma',
}

export interface Producto {
  id: string
  nombre: string
  codigo: string | null
  unidad: Unidad
  precioVenta: Pesos
  costoActual: Pesos
  controlaStock: boolean
  stockMinimo: Cantidad
  favorito: boolean
  activo: boolean
}

export interface Existencia {
  productoId: string
  nombre: string
  unidad: Unidad
  precioVenta: Pesos
  costoActual: Pesos
  controlaStock: boolean
  stockMinimo: Cantidad
  favorito: boolean
  cantidad: Cantidad
  valorAlCosto: Pesos
}

/** Una línea de venta o de compra: qué producto y cuánto. */
export interface LineaProducto {
  productoId: string
  cantidad: Cantidad
  /** Precio o costo unitario en el momento. Se congela con el movimiento. */
  valorUnitario: Pesos
}

const ENTRADAS = new Set<string>(TIPOS_ENTRADA_INVENTARIO)

export function signoInventario(tipo: TipoMovimientoInventario): 1 | -1 {
  return ENTRADAS.has(tipo) ? 1 : -1
}

export function esEntradaInventario(tipo: TipoMovimientoInventario): boolean {
  return ENTRADAS.has(tipo)
}

// ---------------------------------------------------------------------------
// Cantidades
// ---------------------------------------------------------------------------

/**
 * Las cantidades se guardan con tres decimales. Redondear en cada operación
 * evita que media libra vendida cien veces deje un residuo de coma flotante
 * que después nadie sabe explicar en el conteo.
 */
export function redondearCantidad(cantidad: Cantidad): Cantidad {
  return Math.round(cantidad * 1000) / 1000
}

export function formatearCantidad(cantidad: Cantidad, unidad: Unidad): string {
  const redondeada = redondearCantidad(cantidad)
  const texto = Number.isInteger(redondeada)
    ? String(redondeada)
    : redondeada.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${texto.replace('.', ',')} ${ETIQUETA_UNIDAD[unidad].corta}`
}

/**
 * Lee lo que el dueño escribió como cantidad. Acepta coma o punto decimal:
 * en Colombia se escribe «0,5» pero el teclado del celular manda «0.5».
 * Devuelve `null` si no hay número, nunca cero en silencio.
 */
export function leerCantidad(texto: string): Cantidad | null {
  const limpio = texto.replace(/[^\d.,]/g, '').replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const valor = Number.parseFloat(limpio)
  if (!Number.isFinite(valor) || valor <= 0) return null
  return redondearCantidad(valor)
}

// ---------------------------------------------------------------------------
// Totales de una venta o compra con productos
// ---------------------------------------------------------------------------

/**
 * Suma las líneas de productos.
 *
 * Cada línea se redondea a peso entero ANTES de sumar, no después. Si se
 * sumara con decimales y se redondeara el total, la venta cobrada no
 * coincidiría con la suma de lo que dice cada línea, y el dueño vería un
 * peso de diferencia que no puede explicarle a nadie.
 */
export function totalDeLineas(lineas: readonly LineaProducto[]): Pesos {
  return lineas.reduce(
    (suma, linea) => suma + Math.round(linea.cantidad * linea.valorUnitario),
    0,
  )
}

/**
 * Compara el total de los productos con el monto que se va a cobrar.
 *
 * No se obliga a que coincidan: en una tienda se regatea, se redondea el
 * sencillo y se regala el ñapa. Pero la diferencia tiene que verse, porque
 * si nadie la mira, un producto mal tecleado se cobra mal para siempre.
 */
export interface CuadreDeVenta {
  totalProductos: Pesos
  montoCobrado: Pesos
  diferencia: Pesos
  coincide: boolean
}

export function cuadrarVenta(
  lineas: readonly LineaProducto[],
  montoCobrado: Pesos,
): CuadreDeVenta {
  const totalProductos = totalDeLineas(lineas)
  const diferencia = montoCobrado - totalProductos
  return { totalProductos, montoCobrado, diferencia, coincide: diferencia === 0 }
}

// ---------------------------------------------------------------------------
// Estado de las existencias
// ---------------------------------------------------------------------------

export type EstadoStock = 'sin_control' | 'agotado' | 'bajo' | 'negativo' | 'normal'

/**
 * En qué estado está un producto.
 *
 * `negativo` merece su propia categoría y no se disfraza de «agotado»:
 * significa que se vendió más de lo que la app cree que había, o sea que
 * falta registrar una compra. Es el equivalente a un faltante de caja y hay
 * que verlo, no redondearlo a cero.
 */
export function estadoDeStock(existencia: Existencia): EstadoStock {
  if (!existencia.controlaStock) return 'sin_control'
  if (existencia.cantidad < 0) return 'negativo'
  if (existencia.cantidad === 0) return 'agotado'
  if (existencia.stockMinimo > 0 && existencia.cantidad <= existencia.stockMinimo) return 'bajo'
  return 'normal'
}

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  sin_control: 'Sin control',
  agotado: 'Agotado',
  bajo: 'Queda poco',
  negativo: 'Revisar',
  normal: 'Bien',
}

/** Lo que hay que reponer, primero lo más urgente. */
export function porReponer(existencias: readonly Existencia[]): Existencia[] {
  const orden: Record<EstadoStock, number> = {
    negativo: 0,
    agotado: 1,
    bajo: 2,
    normal: 3,
    sin_control: 4,
  }
  return existencias
    .filter((e) => ['negativo', 'agotado', 'bajo'].includes(estadoDeStock(e)))
    .sort((a, b) => orden[estadoDeStock(a)] - orden[estadoDeStock(b)])
}

/** Plata parada en la estantería, al último costo pagado. */
export function valorDelInventario(existencias: readonly Existencia[]): Pesos {
  return existencias
    .filter((e) => e.controlaStock && e.cantidad > 0)
    .reduce((suma, e) => suma + Math.round(e.cantidad * e.costoActual), 0)
}

// ---------------------------------------------------------------------------
// Margen
// ---------------------------------------------------------------------------

/**
 * Margen de un producto: cuánto queda por unidad después del costo.
 *
 * Devuelve `null` si no hay costo registrado. Un margen calculado contra un
 * costo de cero diría que se gana el 100%, que es exactamente la mentira
 * que hace que un tendero se gaste la plata de reponer la mercancía.
 */
export function margenUnitario(producto: {
  precioVenta: Pesos
  costoActual: Pesos
}): { pesos: Pesos; porcentaje: number } | null {
  if (producto.costoActual <= 0) return null
  const pesos = producto.precioVenta - producto.costoActual
  return { pesos, porcentaje: (pesos / producto.costoActual) * 100 }
}

/**
 * Ganancia real de un periodo: lo vendido menos lo que costó esa mercancía.
 *
 * Solo cuenta las ventas que pasaron por productos y que tenían costo
 * registrado. Devuelve también la cobertura para que la cifra nunca se
 * presente sola: «ganaste $180.000» es engañoso si solo el 30% de las
 * ventas estaba itemizado. Con la cobertura al lado, el dueño sabe cuánto
 * confiar en el número.
 */
export interface GananciaReal {
  ventaTotal: Pesos
  costoTotal: Pesos
  ganancia: Pesos
  /** Porcentaje del total vendido que sí tiene costo conocido. */
  cobertura: number
}

export function gananciaReal(
  lineasVendidas: readonly { cantidad: Cantidad; precioUnitario: Pesos; costoUnitario: Pesos }[],
  ventaTotalDelPeriodo: Pesos,
): GananciaReal {
  let ventaTotal = 0
  let costoTotal = 0

  for (const linea of lineasVendidas) {
    if (linea.costoUnitario <= 0) continue
    ventaTotal += Math.round(linea.cantidad * linea.precioUnitario)
    costoTotal += Math.round(linea.cantidad * linea.costoUnitario)
  }

  return {
    ventaTotal,
    costoTotal,
    ganancia: ventaTotal - costoTotal,
    cobertura: ventaTotalDelPeriodo > 0 ? (ventaTotal / ventaTotalDelPeriodo) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// Conteo físico
// ---------------------------------------------------------------------------

export interface FilaConteoInventario {
  productoId: string
  nombre: string
  unidad: Unidad
  esperado: Cantidad
  contado: Cantidad
  diferencia: Cantidad
  /** Lo que vale la diferencia, al costo. La merma es plata perdida. */
  valorDiferencia: Pesos
}

/**
 * Conteo físico de mercancía.
 *
 * Mismo principio que el arqueo de caja y por la misma razón: se cuenta
 * primero y la app revela el esperado después. Si la pantalla dijera
 * «deberían quedar 12» antes de contar, el dueño escribiría 12 sin contar y
 * la merma se volvería invisible.
 */
export function revelarConteoInventario(
  existencias: readonly Existencia[],
  contados: ReadonlyMap<string, Cantidad>,
): FilaConteoInventario[] {
  return existencias
    .filter((e) => e.controlaStock && contados.has(e.productoId))
    .map((existencia) => {
      const contado = contados.get(existencia.productoId) ?? 0
      const diferencia = redondearCantidad(contado - existencia.cantidad)
      return {
        productoId: existencia.productoId,
        nombre: existencia.nombre,
        unidad: existencia.unidad,
        esperado: existencia.cantidad,
        contado,
        diferencia,
        valorDiferencia: Math.round(diferencia * existencia.costoActual),
      }
    })
}

/** Cuánta plata se perdió en el conteo. Negativo es pérdida. */
export function valorDeLaMerma(filas: readonly FilaConteoInventario[]): Pesos {
  return filas.reduce((suma, fila) => suma + fila.valorDiferencia, 0)
}
