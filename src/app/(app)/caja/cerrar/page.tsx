import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AsistenteCierre } from './asistente'
import { diaLargo } from '@/dominio/fecha'
import { billeteras, sesionAbierta } from '@/lib/consultas'

export const metadata = { title: 'Cerrar caja · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaCerrar() {
  const [sesion, listaBilleteras] = await Promise.all([sesionAbierta(), billeteras()])
  if (!sesion) redirect('/hoy')

  return (
    <div className="px-4 py-6">
      <Link href="/hoy" className="text-sm text-tinta-2 underline underline-offset-4">
        ← Volver sin cerrar
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Cerrar el día</h1>
      <p className="mt-1 text-sm text-tinta-2">{diaLargo(sesion.fechaOperativa)}</p>

      {/*
        Nota importante para quien mantenga esto: en esta página NO se pasa
        ningún saldo esperado al cliente. El esperado solo llega después del
        conteo, por `revelarDiferencias`. Si algún día alguien lo pasa aquí
        "para evitar un viaje al servidor", el arqueo deja de servir: el dueño
        contaría hasta que le diera esa cifra.
      */}
      <AsistenteCierre billeteras={listaBilleteras} />
    </div>
  )
}
