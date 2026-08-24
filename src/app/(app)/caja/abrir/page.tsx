import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FormularioApertura } from './formulario'
import { diaLargo, fechaEnBogota } from '@/dominio/fecha'
import { sesionAbierta } from '@/lib/consultas'

export const metadata = { title: 'Abrir caja · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaAbrir() {
  const abierta = await sesionAbierta()
  if (abierta) redirect('/hoy')

  return (
    <div className="px-4 py-6">
      <Link href="/hoy" className="text-sm text-tinta-2 underline underline-offset-4">
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Abrir la caja</h1>
      <p className="mt-1 text-sm text-tinta-2">{diaLargo(fechaEnBogota())}</p>

      <FormularioApertura />
    </div>
  )
}
