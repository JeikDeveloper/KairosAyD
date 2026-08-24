import { FormularioEntrar } from './formulario'

export const metadata = { title: 'Entrar · Cuadre Diario' }

export default function PaginaEntrar({
  searchParams,
}: {
  searchParams: { volver?: string; nuevo?: string }
}) {
  const volver = searchParams.volver?.startsWith('/') ? searchParams.volver : '/hoy'

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-8">
          <p className="etiqueta mb-3">Tu tienda</p>
          <h1 className="text-3xl font-extrabold leading-none tracking-tight">
            Cuadre Diario
          </h1>
          <p className="mt-3 text-sm text-tinta-2">
            Entra para ver los movimientos y el estado de la caja.
          </p>
        </header>

        <FormularioEntrar volver={volver} modoInicial={searchParams.nuevo ? 'crear' : 'entrar'} />
      </div>
    </main>
  )
}
