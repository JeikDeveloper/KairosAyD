import Link from 'next/link'

import { salir } from '@/app/entrar/acciones'
import { ajustesNegocio, billeteras } from '@/lib/consultas'
import { formatearPesos } from '@/dominio/dinero'

export const metadata = { title: 'Más · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaMas() {
  const [ajustes, listaBilleteras] = await Promise.all([ajustesNegocio(), billeteras()])

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">{ajustes.nombreNegocio}</h1>

      {/* El inventario vive aquí y no en la barra de abajo: se consulta dos
          o tres veces por semana, al decidir qué comprarle al proveedor, no
          veinte veces al día como la caja. Lo urgente sí sube a «Hoy». */}
      <section className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/productos"
          className="tarjeta flex min-h-[76px] flex-col justify-center p-3 active:bg-superficie-2"
        >
          <b className="text-[0.9375rem]">Productos</b>
          <small className="mt-0.5 text-xs text-tinta-2">Precios y costos</small>
        </Link>
        <Link
          href="/existencias"
          className="tarjeta flex min-h-[76px] flex-col justify-center p-3 active:bg-superficie-2"
        >
          <b className="text-[0.9375rem]">Existencias</b>
          <small className="mt-0.5 text-xs text-tinta-2">Stock y conteo</small>
        </Link>
      </section>

      <section className="tarjeta mt-4 p-3">
        <h2 className="etiqueta mb-2">Tus billeteras</h2>
        <ul className="divide-y divide-linea">
          {listaBilleteras.map((billetera) => (
            <li key={billetera.id} className="flex justify-between py-2 text-sm">
              <span>{billetera.nombre}</span>
              <span className="text-tinta-3">
                {billetera.mezclada ? 'mezclada con la personal' : billetera.clase}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tarjeta mt-4 p-3">
        <h2 className="etiqueta mb-2">Cómo está configurado el arqueo</h2>
        <dl className="divide-y divide-linea text-sm">
          <div className="flex justify-between py-2">
            <dt>Diferencia que se acepta sin alarma</dt>
            <dd className="font-mono">{formatearPesos(ajustes.umbralDiferencia)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt>Aviso de caja olvidada</dt>
            <dd className="font-mono">{ajustes.horasParaAviso} h</dd>
          </div>
        </dl>
      </section>

      <form action={salir} className="mt-8">
        <button
          type="submit"
          className="h-12 w-full rounded-lg border border-linea-fuerte bg-superficie
                     text-sm font-semibold"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}
