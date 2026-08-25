import { describe, expect, it } from 'vitest'

import {
  cuadrarVenta,
  estadoDeStock,
  formatearCantidad,
  gananciaReal,
  leerCantidad,
  margenUnitario,
  porReponer,
  redondearCantidad,
  revelarConteoInventario,
  signoInventario,
  totalDeLineas,
  valorDeLaMerma,
  valorDelInventario,
  type Existencia,
} from './inventario'

const existencia = (extra: Partial<Existencia> = {}): Existencia => ({
  productoId: 'p1',
  nombre: 'Gaseosa',
  unidad: 'unidad',
  precioVenta: 3_000,
  costoActual: 2_200,
  controlaStock: true,
  stockMinimo: 0,
  favorito: false,
  cantidad: 10,
  valorAlCosto: 22_000,
  ...extra,
})

describe('signo del inventario', () => {
  it('lo define el tipo, igual que en la plata', () => {
    expect(signoInventario('compra')).toBe(1)
    expect(signoInventario('inventario_inicial')).toBe(1)
    expect(signoInventario('devolucion_cliente')).toBe(1)
    expect(signoInventario('ajuste_sobrante')).toBe(1)

    expect(signoInventario('venta')).toBe(-1)
    expect(signoInventario('devolucion_proveedor')).toBe(-1)
    expect(signoInventario('ajuste_faltante')).toBe(-1)
    expect(signoInventario('merma')).toBe(-1)
  })
})

describe('cantidades', () => {
  it('acepta coma y punto decimal', () => {
    // En Colombia se escribe «0,5» pero el teclado del celular manda «0.5».
    expect(leerCantidad('0,5')).toBe(0.5)
    expect(leerCantidad('0.5')).toBe(0.5)
    expect(leerCantidad('2')).toBe(2)
    expect(leerCantidad('1,25 lb')).toBe(1.25)
  })

  it('devuelve null en vez de cero cuando no hay número', () => {
    expect(leerCantidad('')).toBeNull()
    expect(leerCantidad('abc')).toBeNull()
    expect(leerCantidad('0')).toBeNull()
    expect(leerCantidad('-3')).toBe(3) // el signo lo pone el tipo, no el texto
  })

  it('redondea a tres decimales para no acumular residuos', () => {
    expect(redondearCantidad(0.1 + 0.2)).toBe(0.3)
    let acumulado = 0
    for (let i = 0; i < 100; i += 1) acumulado = redondearCantidad(acumulado + 0.5)
    expect(acumulado).toBe(50)
  })

  it('muestra la cantidad con su unidad y sin decimales de más', () => {
    expect(formatearCantidad(3, 'unidad')).toBe('3 und')
    expect(formatearCantidad(0.5, 'libra')).toBe('0,5 lb')
    expect(formatearCantidad(2.5, 'kilo')).toBe('2,5 kg')
  })
})

describe('venta con productos', () => {
  it('redondea cada línea antes de sumar, no el total', () => {
    // Media libra a $4.500 son $2.250. Si se sumara con decimales y se
    // redondeara al final, el total no coincidiría con lo que dice cada
    // línea y el dueño vería un peso que no puede explicar.
    const lineas = [
      { productoId: 'p1', cantidad: 0.5, valorUnitario: 4_500 },
      { productoId: 'p2', cantidad: 0.5, valorUnitario: 4_500 },
    ]
    expect(totalDeLineas(lineas)).toBe(4_500)
  })

  it('calcula el total de una venta normal', () => {
    const lineas = [
      { productoId: 'gaseosa', cantidad: 2, valorUnitario: 3_000 },
      { productoId: 'pan', cantidad: 4, valorUnitario: 500 },
    ]
    expect(totalDeLineas(lineas)).toBe(8_000)
  })

  it('avisa cuando lo cobrado no coincide con los productos', () => {
    const lineas = [{ productoId: 'gaseosa', cantidad: 2, valorUnitario: 3_000 }]

    const exacto = cuadrarVenta(lineas, 6_000)
    expect(exacto.coincide).toBe(true)
    expect(exacto.diferencia).toBe(0)

    // Le rebajó $500 al cliente: es válido, pero tiene que verse.
    const rebajado = cuadrarVenta(lineas, 5_500)
    expect(rebajado.coincide).toBe(false)
    expect(rebajado.diferencia).toBe(-500)
    expect(rebajado.totalProductos).toBe(6_000)
  })
})

describe('estado de las existencias', () => {
  it('distingue el stock negativo de estar agotado', () => {
    // Negativo significa que se vendió más de lo que la app cree que había:
    // falta registrar una compra. Es un faltante, no un cero.
    expect(estadoDeStock(existencia({ cantidad: -3 }))).toBe('negativo')
    expect(estadoDeStock(existencia({ cantidad: 0 }))).toBe('agotado')
  })

  it('avisa cuando queda poco', () => {
    expect(estadoDeStock(existencia({ cantidad: 2, stockMinimo: 5 }))).toBe('bajo')
    expect(estadoDeStock(existencia({ cantidad: 5, stockMinimo: 5 }))).toBe('bajo')
    expect(estadoDeStock(existencia({ cantidad: 6, stockMinimo: 5 }))).toBe('normal')
  })

  it('no opina sobre lo que no se controla', () => {
    expect(estadoDeStock(existencia({ cantidad: -99, controlaStock: false }))).toBe('sin_control')
  })

  it('ordena la reposición por urgencia', () => {
    const lista = [
      existencia({ productoId: 'bajo', cantidad: 2, stockMinimo: 5 }),
      existencia({ productoId: 'ok', cantidad: 50 }),
      existencia({ productoId: 'negativo', cantidad: -1 }),
      existencia({ productoId: 'agotado', cantidad: 0 }),
    ]
    expect(porReponer(lista).map((e) => e.productoId)).toEqual([
      'negativo',
      'agotado',
      'bajo',
    ])
  })

  it('valora la estantería al último costo, sin contar lo negativo', () => {
    const lista = [
      existencia({ productoId: 'a', cantidad: 10, costoActual: 2_200 }),
      existencia({ productoId: 'b', cantidad: 0.5, costoActual: 4_500 }),
      existencia({ productoId: 'c', cantidad: -5, costoActual: 1_000 }),
      existencia({ productoId: 'd', cantidad: 99, costoActual: 500, controlaStock: false }),
    ]
    expect(valorDelInventario(lista)).toBe(22_000 + 2_250)
  })
})

describe('margen', () => {
  it('no inventa un margen sin costo registrado', () => {
    // Con costo cero el margen daría 100%, que es justo la mentira que hace
    // que un tendero se gaste la plata de reponer la mercancía.
    expect(margenUnitario({ precioVenta: 3_000, costoActual: 0 })).toBeNull()
  })

  it('calcula pesos y porcentaje sobre el costo', () => {
    const margen = margenUnitario({ precioVenta: 3_000, costoActual: 2_000 })
    expect(margen?.pesos).toBe(1_000)
    expect(margen?.porcentaje).toBe(50)
  })
})

describe('ganancia real', () => {
  it('descuenta el costo de la mercancía vendida', () => {
    const resultado = gananciaReal(
      [
        { cantidad: 10, precioUnitario: 3_000, costoUnitario: 2_200 },
        { cantidad: 5, precioUnitario: 1_000, costoUnitario: 700 },
      ],
      35_000,
    )
    expect(resultado.ventaTotal).toBe(35_000)
    expect(resultado.costoTotal).toBe(25_500)
    expect(resultado.ganancia).toBe(9_500)
    expect(resultado.cobertura).toBe(100)
  })

  it('reporta la cobertura para que la cifra no se lea sola', () => {
    // «Ganaste $800» es engañoso si solo el 20% de las ventas está
    // itemizado. Con la cobertura al lado, se sabe cuánto confiar.
    const resultado = gananciaReal(
      [{ cantidad: 1, precioUnitario: 3_000, costoUnitario: 2_200 }],
      15_000,
    )
    expect(resultado.ganancia).toBe(800)
    expect(Math.round(resultado.cobertura)).toBe(20)
  })

  it('ignora las líneas sin costo conocido', () => {
    const resultado = gananciaReal(
      [
        { cantidad: 1, precioUnitario: 3_000, costoUnitario: 0 },
        { cantidad: 1, precioUnitario: 3_000, costoUnitario: 2_000 },
      ],
      6_000,
    )
    expect(resultado.ventaTotal).toBe(3_000)
    expect(resultado.ganancia).toBe(1_000)
    expect(Math.round(resultado.cobertura)).toBe(50)
  })
})

describe('conteo físico', () => {
  it('revela la diferencia y lo que vale', () => {
    const existencias = [
      existencia({ productoId: 'p1', nombre: 'Gaseosa', cantidad: 12, costoActual: 2_200 }),
    ]
    const filas = revelarConteoInventario(existencias, new Map([['p1', 9]]))

    expect(filas[0]?.esperado).toBe(12)
    expect(filas[0]?.contado).toBe(9)
    expect(filas[0]?.diferencia).toBe(-3)
    expect(filas[0]?.valorDiferencia).toBe(-6_600)
  })

  it('solo cuenta lo que se controla y lo que se contó', () => {
    const existencias = [
      existencia({ productoId: 'p1', cantidad: 10 }),
      existencia({ productoId: 'p2', cantidad: 10, controlaStock: false }),
      existencia({ productoId: 'p3', cantidad: 10 }),
    ]
    const filas = revelarConteoInventario(existencias, new Map([['p1', 8], ['p2', 3]]))

    expect(filas).toHaveLength(1)
    expect(filas[0]?.productoId).toBe('p1')
  })

  it('suma la merma del conteo completo', () => {
    const existencias = [
      existencia({ productoId: 'p1', cantidad: 12, costoActual: 2_000 }),
      existencia({ productoId: 'p2', cantidad: 5, costoActual: 1_000 }),
    ]
    const filas = revelarConteoInventario(
      existencias,
      new Map([['p1', 10], ['p2', 6]]),
    )

    // Faltaron 2 a $2.000 y sobró 1 a $1.000.
    expect(valorDeLaMerma(filas)).toBe(-3_000)
  })

  it('maneja medias libras sin residuos de coma flotante', () => {
    const existencias = [
      existencia({ productoId: 'queso', unidad: 'libra', cantidad: 3.3, costoActual: 9_000 }),
    ]
    const filas = revelarConteoInventario(existencias, new Map([['queso', 3.1]]))

    expect(filas[0]?.diferencia).toBe(-0.2)
    expect(filas[0]?.valorDiferencia).toBe(-1_800)
  })
})
