import Link from 'next/link'

import { AvisoCaja } from '@/componentes/aviso-caja'
import { ListaMovimientos } from '@/componentes/lista-movimientos'
import { formatearNumero, formatearPesos } from '@/dominio/dinero'
import { diaLargo, horaEnBogota } from '@/dominio/fecha'
import type { Billetera, Pesos } from '@/dominio/tipos'
import { estadoHoy } from '@/lib/consultas'

export const metadata = { title: 'Hoy · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaHoy() {
  const { situacion, billeteras, saldos, resumen, ultimos } = await estadoHoy()

  // Caja cerrada: la pantalla no muestra cifras del día porque no hay día.
  // Abrir la caja es la única acción posible.
  if (situacion.estado === 'cerrada') {
    return (
      <div className="px-4 py-5">
        <AvisoCaja situacion={situacion} />
        <SaldosApagados billeteras={billeteras} saldos={saldos} />
      </div>
    )
  }

  const sesion = situacion.sesion
  const efectivo = billeteras.find((b) => b.clase === 'efectivo')
  const efectivoEsperado = efectivo ? (saldos.get(efectivo.id) ?? 0) : 0
  const total = billeteras.reduce((suma, b) => suma + (saldos.get(b.id) ?? 0), 0)

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <AvisoCaja situacion={situacion} />

      {/* 1 · El dato principal: lo único verificable a mano ahora mismo. */}
      <section aria-labelledby="titulo-efectivo">
        <h1 id="titulo-efectivo" className="etiqueta mb-1.5">
          Efectivo que debe haber en el cajón
        </h1>
        <p className="cifra text-cifra">{formatearPesos(efectivoEsperado)}</p>
        <p className="mt-1.5 text-[0.6875rem] text-tinta-3">
          {diaLargo(sesion.fechaOperativa)} · abriste a las {horaEnBogota(sesion.abiertaEn)}
        </p>
      </section>

      {/* 2 · Dónde está la plata. El total solo no responde esta pregunta. */}
      <section className="tarjeta p-3" aria-labelledby="titulo-billeteras">
        <h2 id="titulo-billeteras" className="etiqueta mb-2">
          Dónde está la plata
        </h2>
        <ul>
          {billeteras.map((billetera) => (
            <FilaBilletera
              key={billetera.id}
              nombre={billetera.nombre}
              monto={saldos.get(billetera.id) ?? 0}
              mezclada={billetera.mezclada}
            />
          ))}
          <li className="mt-1 flex items-baseline justify-between border-t border-linea-fuerte pt-2 text-sm font-bold">
            <span>Total</span>
            <span className="cifra font-mono">{formatearPesos(total)}</span>
          </li>
        </ul>
      </section>

      {/* 3 · Movimiento del día. «Neto», nunca «utilidad». */}
      <section
        className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-linea bg-linea"
        aria-label="Movimiento del día"
      >
        <Casilla titulo="Entró" monto={resumen.entro} />
        <Casilla titulo="Salió" monto={resumen.salio} />
        <Casilla titulo="Neto" monto={resumen.neto} conSigno />
      </section>

      {/* 4 · Últimos movimientos: para cazar el error reciente. */}
      <section className="tarjeta p-3" aria-labelledby="titulo-ultimos">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="titulo-ultimos" className="etiqueta">
            Últimos movimientos
          </h2>
          {resumen.cantidad > 0 ? (
            <Link
              href={`/movimientos?sesion=${sesion.id}`}
              className="text-[0.6875rem] font-semibold text-verde underline underline-offset-2"
            >
              Ver todos ({resumen.cantidad})
            </Link>
          ) : null}
        </div>

        {ultimos.length > 0 ? (
          <ListaMovimientos movimientos={ultimos} billeteras={billeteras} />
        ) : (
          // Estado vacío: nunca una pantalla en blanco, siempre qué hacer.
          <p className="py-4 text-center text-sm text-tinta-2">
            Todavía no has registrado nada hoy.
            <br />
            <span className="text-tinta-3">Usa el botón + para tu primera venta.</span>
          </p>
        )}
      </section>

      <Link
        href="/caja/cerrar"
        className="boton-principal"
      >
        Cerrar caja del día
      </Link>
    </div>
  )
}

function FilaBilletera({
  nombre,
  monto,
  mezclada,
}: {
  nombre: string
  monto: Pesos
  mezclada: boolean
}) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-linea py-1.5 text-[0.8125rem] last:border-b-0">
      <span>
        {nombre}
        {mezclada ? (
          <span className="ml-1.5 text-[0.625rem] text-tinta-3">(mezclada)</span>
        ) : null}
      </span>
      <span className="cifra font-mono font-semibold">{formatearPesos(monto)}</span>
    </li>
  )
}

function Casilla({
  titulo,
  monto,
  conSigno = false,
}: {
  titulo: string
  monto: Pesos
  conSigno?: boolean
}) {
  const signo = conSigno && monto > 0 ? '+' : ''
  return (
    <div className="bg-superficie px-2 py-2.5">
      <span className="etiqueta mb-0.5 block text-[0.5625rem]">{titulo}</span>
      <b className="cifra block font-mono text-[0.8125rem] font-semibold">
        {signo}
        {formatearNumero(monto)}
      </b>
    </div>
  )
}

/** Con la caja cerrada los saldos se ven, pero apagados: son de ayer. */
function SaldosApagados({
  billeteras,
  saldos,
}: {
  billeteras: Billetera[]
  saldos: Map<string, Pesos>
}) {
  return (
    <section className="tarjeta mt-4 p-3 opacity-60" aria-label="Saldos al último cierre">
      <h2 className="etiqueta mb-2">Como quedó en el último cierre</h2>
      <ul>
        {billeteras.map((billetera) => (
          <FilaBilletera
            key={billetera.id}
            nombre={billetera.nombre}
            monto={saldos.get(billetera.id) ?? 0}
            mezclada={billetera.mezclada}
          />
        ))}
      </ul>
    </section>
  )
}
