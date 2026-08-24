# Cuadre Diario

Libro de caja para una tienda de barrio: movimientos, arqueo y cierre diario,
en pesos colombianos y con los medios de pago locales.

El diseño completo (navegación, tablero, flujo de cierre y controles contra el
descuadre) está en [docs/cuadre-diario.html](docs/cuadre-diario.html).

## Stack

| Pieza | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) · React 18 |
| Lenguaje | TypeScript (`strict`, `noUncheckedIndexedAccess`) |
| Estilos | Tailwind CSS (`darkMode: 'class'`) |
| Datos y sesión | Supabase (Postgres + Auth + RLS) |
| Validación | Zod |
| Pruebas | Vitest |

## Puesta en marcha

### 1 · Crear el proyecto en Supabase

En [supabase.com](https://supabase.com), proyecto nuevo (el plan gratuito
alcanza de sobra). Región recomendada: `us-east-1`, la más cercana a Colombia.

### 2 · Cargar el esquema

En el panel de Supabase, **SQL Editor → New query**, pega el contenido de
[supabase/migrations/0001_esquema_inicial.sql](supabase/migrations/0001_esquema_inicial.sql)
y ejecútalo. Crea las tablas, las políticas de RLS, los disparadores de
integridad y la semilla de billeteras y categorías.

### 3 · Configurar el entorno

```bash
cp .env.example .env.local
```

Pon en `.env.local` la URL y la clave `anon` que aparecen en
**Project Settings → API**.

> La clave `anon` es pública a propósito: quien protege los datos es RLS, no
> el secreto de la clave. La clave `service_role` **no** va en este proyecto:
> se salta RLS por completo.

### 4 · Arrancar

```bash
pnpm install
pnpm dev
```

En `http://localhost:3000` te manda a `/entrar`. Usa **«Es la primera vez:
crear mi cuenta»**. Al crearse el usuario, el disparador `sembrar_negocio()`
deja listas las cuatro billeteras y las categorías.

### 5 · Cerrar el registro

Con la cuenta ya creada, en Supabase ve a **Authentication → Providers →
Email** y desactiva **Enable sign ups**.

Si no lo haces, cualquiera con el enlace puede crearse una cuenta. No vería
tus datos (RLS lo impide), pero sí consumiría tu proyecto.

## Comandos

```bash
pnpm dev          # servidor de desarrollo
pnpm build        # compilación de producción
pnpm test         # pruebas del dominio
pnpm type-check   # tipos
pnpm lint
```

## Cómo está organizado

```
src/
├── dominio/          Reglas del negocio. Puro TypeScript, sin React ni Supabase.
│   ├── tipos.ts        Movimiento, billetera, sesión de caja
│   ├── dinero.ts       Pesos enteros, formato COP, conteo por denominación
│   ├── fecha.ts        Día operativo en zona América/Bogotá
│   ├── movimientos.ts  Signos, saldos, resúmenes por periodo
│   └── arqueo.ts       Diferencias, veredictos y cierre
├── lib/
│   ├── consultas.ts    Lectura para Server Components
│   └── supabase/       Clientes de navegador y servidor
├── componentes/      Piezas compartidas de interfaz
├── app/
│   ├── entrar/         Login
│   └── (app)/          Pantallas con sesión: hoy, caja, registrar, reportes…
└── middleware.ts     Refresco de sesión y bloqueo de rutas
```

El dominio no importa nada de Next ni de Supabase. Por eso la exactitud del
dato financiero se puede probar sin levantar la app: `pnpm test` corre 35
pruebas en un segundo.

## Las reglas que sostienen el modelo

1. **Solo existe un tipo de registro: el movimiento.** Cada uno afecta
   exactamente una billetera.
2. **El signo lo define el tipo, nunca el monto.** Los montos siempre son
   positivos.
3. **Los saldos no se guardan, se calculan.** No hay ningún campo «saldo»
   editable: un saldo equivocado siempre tiene detrás un movimiento
   equivocado, y así se puede encontrar.
4. **Nada se borra.** Un movimiento se anula, con motivo y hora, y sigue
   visible en el historial.
5. **Sin caja abierta no hay movimiento.** Lo impone la base de datos, no
   solo la interfaz.
6. **Un día cerrado queda cerrado.** Las correcciones se hacen con un ajuste
   en la caja de hoy.
7. **Se cuenta primero, el esperado se revela después.** El servidor no
   entrega el saldo esperado hasta recibir el conteo completo.

La séptima es la que sostiene todo el arqueo. Si la pantalla mostrara
«deben haber $487.300» antes de contar, el dueño contaría hasta que le diera
esa cifra y el arqueo dejaría de medir nada. Por eso el saldo esperado no se
pasa a la página de cierre: sale únicamente por `revelarDiferencias()`, que
exige el conteo para responder.

## Dinero

Todo en **pesos enteros**. Nunca `float`: `0.1 + 0.2` no da `0.3` en coma
flotante, y un error de un peso repetido mil veces es un descuadre que nadie
va a poder explicar en el arqueo.

## Zona horaria

El día del negocio se calcula en `America/Bogota`. Una venta a las 8 p.m. en
Bogotá ya es del día siguiente en UTC; agrupar por fecha UTC mandaría las
ventas de la noche al día equivocado y ningún total cuadraría contra el
cierre.

Además, el día operativo lo define la sesión de caja y no el calendario: una
tienda que cierra a las 12:30 a.m. sigue en el día anterior hasta que el
dueño cierre la caja.
