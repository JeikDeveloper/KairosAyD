import type { FechaOperativa, Instante } from './tipos'

/**
 * Fechas y horas.
 *
 * El día del negocio no es el día del reloj UTC. Una venta a las 8 p.m. en
 * Bogotá ya es «mañana» en UTC, y si los reportes se agrupan por fecha UTC,
 * las ventas de la noche se van al día siguiente y ningún total va a cuadrar
 * contra el cierre de caja.
 *
 * Además, el día operativo lo define la sesión de caja, no el calendario:
 * una tienda que cierra a las 12:30 a.m. sigue en el día anterior hasta que
 * el dueño cierre la caja.
 */

export const ZONA = 'America/Bogota'

const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const FORMATO_DIA_LARGO = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const FORMATO_DIA_CORTO = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Fecha calendario en Bogotá: `"2026-08-23"`. */
export function fechaEnBogota(instante: Date | Instante = new Date()): FechaOperativa {
  const fecha = typeof instante === 'string' ? new Date(instante) : instante
  return FORMATO_FECHA.format(fecha)
}

/** `"4:12 p. m."` */
export function horaEnBogota(instante: Date | Instante): string {
  const fecha = typeof instante === 'string' ? new Date(instante) : instante
  return FORMATO_HORA.format(fecha)
}

/** `"sábado, 23 de agosto"` — para encabezados. */
export function diaLargo(fecha: FechaOperativa): string {
  return FORMATO_DIA_LARGO.format(desdeFechaOperativa(fecha))
}

/** `"23/08/2026"` — para tablas y listas. */
export function diaCorto(fecha: FechaOperativa): string {
  return FORMATO_DIA_CORTO.format(desdeFechaOperativa(fecha))
}

/**
 * Convierte `"2026-08-23"` a un instante al mediodía de Bogotá.
 * El mediodía y no la medianoche: así ningún desfase de zona horaria puede
 * empujar la fecha al día anterior o al siguiente al formatearla.
 */
export function desdeFechaOperativa(fecha: FechaOperativa): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1, 17, 0, 0))
}

/** Suma (o resta, con negativo) días a una fecha operativa. */
export function sumarDias(fecha: FechaOperativa, dias: number): FechaOperativa {
  const base = desdeFechaOperativa(fecha)
  base.setUTCDate(base.getUTCDate() + dias)
  return FORMATO_FECHA.format(base)
}

/** Rango `[desde, hasta]` inclusivo, en fechas operativas. */
export interface RangoFechas {
  desde: FechaOperativa
  hasta: FechaOperativa
}

export function rangoDia(fecha: FechaOperativa): RangoFechas {
  return { desde: fecha, hasta: fecha }
}

/** Semana de lunes a domingo que contiene `fecha`. */
export function rangoSemana(fecha: FechaOperativa): RangoFechas {
  const base = desdeFechaOperativa(fecha)
  // getUTCDay(): 0 = domingo. Se corre para que la semana empiece el lunes.
  const diaSemana = (base.getUTCDay() + 6) % 7
  return {
    desde: sumarDias(fecha, -diaSemana),
    hasta: sumarDias(fecha, 6 - diaSemana),
  }
}

export function rangoMes(fecha: FechaOperativa): RangoFechas {
  const [anio, mes] = fecha.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(anio ?? 1970, mes ?? 1, 0)).getUTCDate()
  const mm = String(mes).padStart(2, '0')
  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

/** El periodo inmediatamente anterior, del mismo largo. Para comparativos. */
export function periodoAnterior(rango: RangoFechas): RangoFechas {
  const dias = diasEntre(rango.desde, rango.hasta) + 1
  return {
    desde: sumarDias(rango.desde, -dias),
    hasta: sumarDias(rango.hasta, -dias),
  }
}

export function diasEntre(desde: FechaOperativa, hasta: FechaOperativa): number {
  const ms = desdeFechaOperativa(hasta).getTime() - desdeFechaOperativa(desde).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * Cuántas horas lleva abierta la caja. Sirve para el aviso de caja olvidada:
 * más de 20 horas abierta casi siempre significa que se olvidó cerrar ayer.
 */
export function horasAbierta(abiertaEn: Instante, ahora: Date = new Date()): number {
  return (ahora.getTime() - new Date(abiertaEn).getTime()) / 3_600_000
}

export const HORAS_PARA_SOSPECHAR_OLVIDO = 20
