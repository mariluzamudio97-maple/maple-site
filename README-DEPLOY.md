# Maple — Guía de despliegue

## Qué es cada archivo
- `index.html` — el sitio completo (catálogo, carrito, checkout)
- `api/create-preference.js` — función que crea el cobro en Mercado Pago
- Este README

## 1. Subir el sitio a Vercel (gratis)

1. Crea una cuenta en https://vercel.com (puedes entrar con GitHub, Google o email)
2. Sube esta carpeta completa a un repositorio de GitHub (o arrastra la carpeta
   directo en el dashboard de Vercel con "Add New… → Project → Upload")
3. Vercel detecta automáticamente que `api/create-preference.js` es una función
   serverless — no hay que configurar nada extra para eso
4. Al terminar el deploy, Vercel te da una URL tipo `maple-xyz.vercel.app`
   (después puedes conectar tu dominio propio, ej. maplehornodulce.com, desde
   Settings → Domains)

## 2. Conectar Mercado Pago (modo de pruebas)

1. En tu cuenta de Mercado Pago → **Tus integraciones** → **Credenciales**
2. Copia el **Access Token de prueba** (empieza con `TEST-`)
3. En Vercel: entra al proyecto → **Settings** → **Environment Variables**
4. Agrega una variable:
   - Nombre: `MP_ACCESS_TOKEN`
   - Valor: tu Access Token `TEST-...`
5. Dale **Redeploy** al proyecto para que la variable tome efecto

## 3. Probar un pago de prueba

Mercado Pago tiene tarjetas ficticias para probar sin dinero real:
- Tarjeta: `5031 7557 3453 0604`
- Vencimiento: cualquier fecha futura
- CVV: `123`
- Nombre: `APRO` (esto simula un pago aprobado; usa `OTHE` para simular rechazado)

Con estos datos puedes probar todo el flujo completo (agregar al carrito →
elegir fecha/zona → pagar con tarjeta → comprobante → WhatsApp) sin mover
dinero real.

## 4. Pasar a producción (cuando estén listos para cobrar de verdad)

1. En Mercado Pago, activa tu cuenta para cobros reales (verificación de
   identidad + CLABE bancaria — Mercado Pago te va a pedir esto la primera
   vez que actives credenciales de producción)
2. Copia el **Access Token de producción** (empieza con `APP_USR-`)
3. Reemplaza el valor de `MP_ACCESS_TOKEN` en Vercel por este nuevo token
4. Redeploy — el sitio automáticamente empieza a usar `init_point` (cobro
   real) en vez de `sandbox_init_point` (pruebas), sin tocar código

## 5. Antes de activar cobros reales, no olvides editar en `index.html`:

Busca el bloque `const CONFIG = {` y `const PRODUCTS = {` cerca del final del
archivo:
- Precios reales de cada producto (reemplazar los `null`)
- Precios de envío por zona en `deliveryZones`
- Datos de transferencia bancaria en `transferInfo`
- Número de WhatsApp (ya está puesto: 2288368038)
