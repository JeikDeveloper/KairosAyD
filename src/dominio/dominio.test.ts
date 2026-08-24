import { describe, expect, it } from 'vitest'

import {
  ajustesDelCierre,
  retiroPorBaseSiguiente,
  revelar,
  situacionDeCaja,
  UMBRAL_DIFERENCIA_POR_DEFECTO,
} from './arqueo'
import {
  DENOMINACIONES,
  formatearConSigno,
  leerPesos,
  MontoInvalido,
  exigirMontoValido,
  sumarDenominaciones,
} from './dinero'
import { fechaEnBogota, periodoAnterior, rangoMes, rangoSemana, sumarDias } from './fecha'
import {
  resumirPeriodo,
  saldoDe,
  saldosPorBilletera,
  signoDe,
  totalPorCategoria,
  variacion,
} from './movimientos'
import type { Billetera, Movimiento, SesionCaja, TipoMovimiento } from './tipos'

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

let contador = 0

function mov(
  tipo: TipoMovimiento,
  monto: number,
  billeteraId = 'efectivo',
  extra: Partial<Movimiento> = {},
): Movimiento {
  contador += 1
  return {
    id: `m${contador}`,
    sesionId: 's1',
    tipo,
    monto,
    billeteraId,
    categoriaId: null,
    nota: null,
    estado: 'vigente',
    grupoId: null,
    corrigeA: null,
    creadoEn: '2026-08-23T15:00:00.000Z',
    anuladoEn: null,
    motivoAnulacion: null,
    ...extra,
  }
}

const billetera = (id: string, extra: Partial<Billetera> = {}): Billetera => ({
  id,
  nombre: id,
  clase: id === 'efectivo' ? 'efectivo' : 'digital',
  mezclada: false,
  activa: true,
  orden: 0,
  ...extra,
})

// ---------------------------------------------------------------------------

describe('dinero', () => {
  it('rechaza montos que no son pesos enteros positivos', () => {
    expect(() => exigirMontoValido(0)).toThrow(MontoInvalido)
    expect(() => exigirMontoValido(-500)).toThrow(MontoInvalido)
    expect(() => exigirMontoValido(12_000.5)).toThrow(MontoInvalido)
    expect(() => exigirMontoValido(Number.NaN)).toThrow(MontoInvalido)
    expect(exigirMontoValido(12_000)).toBe(12_000)
  })

  it('lee lo que el dueño escribe, en cualquier formato', () => {
    expect(leerPesos('12.000')).toBe(12_000)
    expect(leerPesos('12,000')).toBe(12_000)
    expect(leerPesos('$ 12.000')).toBe(12_000)
    expect(leerPesos('12000')).toBe(12_000)
  })

  it('devuelve null en vez de cero cuando no hay número', () => {
    // Un cero silencioso se guardaría como un movimiento de $0 sin que
    // nadie se dé cuenta.
    expect(leerPesos('')).toBeNull()
    expect(leerPesos('   ')).toBeNull()
    expect(leerPesos('abc')).toBeNull()
    expect(leerPesos('$')).toBeNull()
  })

  it('suma el conteo por denominación sin errores de coma flotante', () => {
    // 450.000 + 20.000 + 10.000 + 5.000 + 2.000 + 200 + 100
    expect(
      sumarDenominaciones({ 50_000: 9, 20_000: 1, 10_000: 1, 5_000: 1, 2_000: 1, 200: 1, 100: 1 }),
    ).toBe(487_300)
    expect(sumarDenominaciones({})).toBe(0)
  })

  it('cubre las denominaciones que circulan en Colombia', () => {
    expect(DENOMINACIONES).toContain(100_000)
    expect(DENOMINACIONES).toContain(50)
    expect([...DENOMINACIONES].sort((a, b) => b - a)).toEqual([...DENOMINACIONES])
  })

  it('no le pone signo al cero', () => {
    expect(formatearConSigno(0)).not.toContain('+')
    expect(formatearConSigno(0)).not.toContain('−')
  })
})

describe('signo de los movimientos', () => {
  it('lo define el tipo, nunca el monto', () => {
    expect(signoDe('venta')).toBe(1)
    expect(signoDe('aporte')).toBe(1)
    expect(signoDe('traslado_entrada')).toBe(1)
    expect(signoDe('ajuste_sobrante')).toBe(1)

    expect(signoDe('gasto')).toBe(-1)
    expect(signoDe('compra')).toBe(-1)
    expect(signoDe('retiro')).toBe(-1)
    expect(signoDe('traslado_salida')).toBe(-1)
    expect(signoDe('ajuste_faltante')).toBe(-1)
  })
})

describe('saldos', () => {
  it('suma y resta según el tipo', () => {
    const movimientos = [
      mov('venta', 12_000),
      mov('venta', 7_500),
      mov('compra', 96_000),
      mov('retiro', 50_000),
    ]
    expect(saldoDe(movimientos, 'efectivo')).toBe(12_000 + 7_500 - 96_000 - 50_000)
  })

  it('ignora los anulados pero no los pierde de la lista', () => {
    const movimientos = [
      mov('venta', 12_000),
      mov('venta', 99_000, 'efectivo', {
        estado: 'anulado',
        anuladoEn: '2026-08-23T16:00:00.000Z',
        motivoAnulacion: 'Monto mal escrito',
      }),
    ]
    expect(saldoDe(movimientos, 'efectivo')).toBe(12_000)
    expect(movimientos).toHaveLength(2)
  })

  it('separa las billeteras', () => {
    const movimientos = [
      mov('venta', 12_000, 'nequi'),
      mov('venta', 7_500, 'efectivo'),
      mov('gasto', 3_000, 'nequi'),
    ]
    const saldos = saldosPorBilletera(movimientos)
    expect(saldos.get('nequi')).toBe(9_000)
    expect(saldos.get('efectivo')).toBe(7_500)
  })

  it('un traslado mueve plata sin cambiar el total', () => {
    const movimientos = [
      mov('venta', 100_000, 'nequi'),
      mov('traslado_salida', 40_000, 'nequi', { grupoId: 'g1' }),
      mov('traslado_entrada', 40_000, 'efectivo', { grupoId: 'g1' }),
    ]
    const saldos = saldosPorBilletera(movimientos)
    expect(saldos.get('nequi')).toBe(60_000)
    expect(saldos.get('efectivo')).toBe(40_000)

    const total = [...saldos.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(100_000)
  })
})

describe('resumen del periodo', () => {
  it('el traslado no infla las ventas', () => {
    // Sacar plata de Nequi y meterla al cajón no es un ingreso: la plata
    // ya estaba adentro.
    const movimientos = [
      mov('venta', 100_000, 'nequi'),
      mov('traslado_salida', 40_000, 'nequi', { grupoId: 'g1' }),
      mov('traslado_entrada', 40_000, 'efectivo', { grupoId: 'g1' }),
    ]
    const resumen = resumirPeriodo(movimientos)
    expect(resumen.entro).toBe(100_000)
    expect(resumen.salio).toBe(0)
    expect(resumen.neto).toBe(100_000)
    expect(resumen.cantidad).toBe(1)
  })

  it('el ajuste de arqueo no cuenta como venta ni como gasto', () => {
    const movimientos = [mov('venta', 50_000), mov('ajuste_faltante', 3_000)]
    const resumen = resumirPeriodo(movimientos)
    expect(resumen.entro).toBe(50_000)
    expect(resumen.salio).toBe(0)
    expect(resumen.cantidad).toBe(1)
  })

  it('el neto es entró menos salió', () => {
    const resumen = resumirPeriodo([
      mov('venta', 792_300),
      mov('gasto', 32_500),
      mov('compra', 96_000),
    ])
    expect(resumen.neto).toBe(792_300 - 128_500)
  })

  it('agrupa gastos por categoría, de mayor a menor', () => {
    const movimientos = [
      mov('gasto', 30_000, 'efectivo', { categoriaId: 'servicios' }),
      mov('gasto', 80_000, 'efectivo', { categoriaId: 'arriendo' }),
      mov('gasto', 10_000, 'efectivo', { categoriaId: 'servicios' }),
      mov('venta', 99_000, 'efectivo', { categoriaId: 'bebidas' }),
    ]
    const porCategoria = totalPorCategoria(movimientos, 'salida')
    expect(porCategoria).toEqual([
      { categoriaId: 'arriendo', total: 80_000, cantidad: 1 },
      { categoriaId: 'servicios', total: 40_000, cantidad: 2 },
    ])
  })

  it('no inventa un porcentaje cuando el periodo anterior fue cero', () => {
    expect(variacion(100_000, 0)).toBeNull()
    expect(variacion(150_000, 100_000)).toBe(50)
  })
})

describe('arqueo', () => {
  const billeteras = [billetera('efectivo'), billetera('nequi')]

  it('cuadra cuando lo contado es igual a lo esperado', () => {
    const movimientos = [mov('venta', 487_300, 'efectivo'), mov('venta', 212_500, 'nequi')]
    const arqueo = revelar(saldosPorBilletera(movimientos), billeteras, [
      { billeteraId: 'efectivo', contado: 487_300, motivo: null, nota: null },
      { billeteraId: 'nequi', contado: 212_500, motivo: null, nota: null },
    ])

    expect(arqueo.filas.every((f) => f.veredicto === 'cuadra')).toBe(true)
    expect(arqueo.diferenciaTotal).toBe(0)
    expect(arqueo.listoParaCerrar).toBe(true)
  })

  it('trata una diferencia pequeña como sencillo, no como alarma', () => {
    const movimientos = [mov('venta', 487_300, 'efectivo')]
    const arqueo = revelar(saldosPorBilletera(movimientos), [billetera('efectivo')], [
      { billeteraId: 'efectivo', contado: 486_800, motivo: null, nota: null },
    ])

    expect(arqueo.filas[0]?.veredicto).toBe('diferencia_menor')
    expect(arqueo.filas[0]?.diferencia).toBe(-500)
    expect(arqueo.filas[0]?.exigeMotivo).toBe(true)
  })

  it('marca para revisar lo que pasa del umbral', () => {
    const movimientos = [mov('venta', 487_300, 'efectivo')]
    const arqueo = revelar(
      saldosPorBilletera(movimientos),
      [billetera('efectivo')],
      [{ billeteraId: 'efectivo', contado: 437_300, motivo: null, nota: null }],
      UMBRAL_DIFERENCIA_POR_DEFECTO,
    )

    expect(arqueo.filas[0]?.veredicto).toBe('revisar')
    expect(arqueo.filas[0]?.diferencia).toBe(-50_000)
  })

  it('no deja cerrar mientras una diferencia no tenga motivo', () => {
    const movimientos = [mov('venta', 487_300, 'efectivo')]
    const sinMotivo = revelar(saldosPorBilletera(movimientos), [billetera('efectivo')], [
      { billeteraId: 'efectivo', contado: 437_300, motivo: null, nota: null },
    ])
    expect(sinMotivo.listoParaCerrar).toBe(false)

    const conMotivo = revelar(saldosPorBilletera(movimientos), [billetera('efectivo')], [
      { billeteraId: 'efectivo', contado: 437_300, motivo: 'desconocido', nota: null },
    ])
    expect(conMotivo.listoParaCerrar).toBe(true)
  })

  it('detecta el error de billetera aunque el total cuadre', () => {
    // Cobró $50.000 por Nequi y lo registró como efectivo: el total del día
    // da igual, pero cada billetera está mal. Esto solo se ve arqueando
    // billetera por billetera.
    const movimientos = [mov('venta', 300_000, 'efectivo'), mov('venta', 100_000, 'nequi')]
    const arqueo = revelar(saldosPorBilletera(movimientos), billeteras, [
      { billeteraId: 'efectivo', contado: 250_000, motivo: 'monto_mal_escrito', nota: null },
      { billeteraId: 'nequi', contado: 150_000, motivo: 'monto_mal_escrito', nota: null },
    ])

    expect(arqueo.diferenciaTotal).toBe(0)
    expect(arqueo.filas.map((f) => f.veredicto)).toEqual(['revisar', 'revisar'])
  })

  it('no le exige cuadre exacto a una cuenta mezclada con la personal', () => {
    const mezclada = [billetera('nequi', { mezclada: true })]
    const arqueo = revelar(
      saldosPorBilletera([mov('venta', 212_500, 'nequi')]),
      mezclada,
      [{ billeteraId: 'nequi', contado: 890_000, motivo: null, nota: null }],
    )

    expect(arqueo.filas[0]?.veredicto).toBe('sin_exigir')
    expect(arqueo.filas[0]?.exigeMotivo).toBe(false)
    expect(arqueo.listoParaCerrar).toBe(true)
  })

  it('trabaja con saldos ya sumados, no con la lista de movimientos', () => {
    // Esta es la razón de que `revelar` reciba un mapa de saldos: sumar la
    // historia completa aquí obligaría a traerla desde la API, que corta en
    // 1000 filas. A los pocos meses el arqueo calcularía el esperado con
    // datos parciales y marcaría faltantes inventados, sin dar ningún error.
    //
    // Postgres suma la columna entera con la vista `saldos_por_billetera`,
    // sin ese límite. Aquí se comprueba que un saldo que jamás cabría en una
    // página de resultados se maneja igual de bien.
    const saldosDeAniosDeVentas = new Map([['efectivo', 91_450_800]])

    const arqueo = revelar(saldosDeAniosDeVentas, [billetera('efectivo')], [
      { billeteraId: 'efectivo', contado: 91_450_800, motivo: null, nota: null },
    ])

    expect(arqueo.filas[0]?.esperado).toBe(91_450_800)
    expect(arqueo.filas[0]?.veredicto).toBe('cuadra')
  })

  it('una billetera sin movimientos espera cero, no se cae', () => {
    const arqueo = revelar(new Map(), [billetera('efectivo'), billetera('nequi')], [
      { billeteraId: 'efectivo', contado: 0, motivo: null, nota: null },
      { billeteraId: 'nequi', contado: 0, motivo: null, nota: null },
    ])

    expect(arqueo.filas.every((f) => f.esperado === 0 && f.veredicto === 'cuadra')).toBe(true)
    expect(arqueo.listoParaCerrar).toBe(true)
  })

  it('el efectivo arrastra el saldo de ayer, no arranca en cero', () => {
    const ayer = [mov('venta', 100_000, 'efectivo', { sesionId: 's0' })]
    const hoy = [mov('venta', 50_000, 'efectivo', { sesionId: 's1' })]
    const arqueo = revelar(saldosPorBilletera([...ayer, ...hoy]), [billetera('efectivo')], [
      { billeteraId: 'efectivo', contado: 150_000, motivo: null, nota: null },
    ])

    expect(arqueo.filas[0]?.esperado).toBe(150_000)
    expect(arqueo.filas[0]?.veredicto).toBe('cuadra')
  })
})

describe('cierre', () => {
  it('convierte la diferencia en un movimiento visible, con su motivo', () => {
    const arqueo = revelar(
      saldosPorBilletera([mov('venta', 487_300, 'efectivo')]),
      [billetera('efectivo')],
      [{ billeteraId: 'efectivo', contado: 437_300, motivo: 'desconocido', nota: 'Revisar mañana' }],
    )
    const ajustes = ajustesDelCierre(arqueo, [
      { billeteraId: 'efectivo', contado: 437_300, motivo: 'desconocido', nota: 'Revisar mañana' },
    ])

    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]).toMatchObject({
      tipo: 'ajuste_faltante',
      monto: 50_000,
      billeteraId: 'efectivo',
    })
    expect(ajustes[0]?.nota).toContain('desconocido')
    expect(ajustes[0]?.nota).toContain('Revisar mañana')
  })

  it('un sobrante también deja rastro', () => {
    const conteos = [
      { billeteraId: 'efectivo', contado: 490_000, motivo: 'sobro_sencillo' as const, nota: null },
    ]
    const arqueo = revelar(saldosPorBilletera([mov('venta', 487_300, 'efectivo')]), [billetera('efectivo')], conteos)
    const ajustes = ajustesDelCierre(arqueo, conteos)

    expect(ajustes[0]?.tipo).toBe('ajuste_sobrante')
    expect(ajustes[0]?.monto).toBe(2_700)
  })

  it('el resto del efectivo sale como retiro al dejar la base', () => {
    expect(retiroPorBaseSiguiente(487_300, 100_000)).toBe(387_300)
    expect(retiroPorBaseSiguiente(100_000, 100_000)).toBe(0)
  })

  it('no deja dejar más plata de la que hay contada', () => {
    expect(() => retiroPorBaseSiguiente(100_000, 150_000)).toThrow()
    expect(() => retiroPorBaseSiguiente(100_000, -1)).toThrow()
  })
})

describe('situación de la caja', () => {
  const sesion = (extra: Partial<SesionCaja> = {}): SesionCaja => ({
    id: 's1',
    fechaOperativa: '2026-08-23',
    estado: 'abierta',
    abiertaEn: '2026-08-23T11:12:00.000Z',
    cerradaEn: null,
    conteoApertura: 100_000,
    baseSiguiente: null,
    notaCierre: null,
    ...extra,
  })

  it('cerrada cuando no hay sesión abierta', () => {
    expect(situacionDeCaja(null, null, 20).estado).toBe('cerrada')
  })

  it('abierta dentro del horario normal', () => {
    const ahora = new Date('2026-08-23T23:00:00.000Z') // ~12 horas después
    expect(situacionDeCaja(sesion(), null, 20, ahora).estado).toBe('abierta')
  })

  it('avisa cuando se olvidó cerrar ayer, sin cerrar sola', () => {
    const ahora = new Date('2026-08-24T14:00:00.000Z') // ~27 horas después
    const situacion = situacionDeCaja(sesion(), null, 20, ahora)

    expect(situacion.estado).toBe('olvidada')
    if (situacion.estado === 'olvidada') {
      expect(situacion.horas).toBeGreaterThan(20)
      expect(situacion.sesion.estado).toBe('abierta')
    }
  })
})

describe('fechas del negocio', () => {
  it('una venta de la noche sigue siendo del mismo día en Bogotá', () => {
    // 2026-08-23 8:00 p.m. Bogotá = 2026-08-24 01:00 UTC.
    // Agrupar por fecha UTC mandaría las ventas de la noche al día siguiente
    // y ningún total cuadraría contra el cierre de caja.
    const instante = new Date('2026-08-24T01:00:00.000Z')
    expect(fechaEnBogota(instante)).toBe('2026-08-23')
    expect(instante.toISOString().slice(0, 10)).toBe('2026-08-24')
  })

  it('la semana va de lunes a domingo', () => {
    // 2026-08-23 es domingo.
    expect(rangoSemana('2026-08-23')).toEqual({ desde: '2026-08-17', hasta: '2026-08-23' })
    expect(rangoSemana('2026-08-17')).toEqual({ desde: '2026-08-17', hasta: '2026-08-23' })
  })

  it('el mes llega hasta su último día real', () => {
    expect(rangoMes('2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoMes('2024-02-10')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' })
    expect(rangoMes('2026-08-23')).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
  })

  it('el periodo anterior tiene el mismo largo', () => {
    expect(periodoAnterior({ desde: '2026-08-17', hasta: '2026-08-23' })).toEqual({
      desde: '2026-08-10',
      hasta: '2026-08-16',
    })
  })

  it('suma días cruzando el fin de mes', () => {
    expect(sumarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
  })
})
