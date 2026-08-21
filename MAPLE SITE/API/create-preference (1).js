// api/create-preference.js
//
// Esta función corre en el servidor (Vercel), nunca en el navegador del
// cliente. Su trabajo: recibir el carrito, crear un "preference" (orden de
// cobro) en Mercado Pago, y devolver el link de pago (init_point) al sitio.
//
// La llave secreta (Access Token) vive SOLO aquí, como variable de entorno
// en Vercel — nunca se escribe en el código ni se sube a GitHub.
//
// CONFIGURACIÓN NECESARIA EN VERCEL:
//   1. En el dashboard del proyecto → Settings → Environment Variables
//   2. Agrega: MP_ACCESS_TOKEN = tu Access Token de Mercado Pago
//      (empieza con TEST- mientras probamos, luego APP_USR- en producción)
//   3. Redeploy para que tome la variable nueva.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({
      error: "Falta configurar MP_ACCESS_TOKEN en las variables de entorno de Vercel."
    });
  }

  try {
    const { items, orderId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    // Construye la URL base del sitio automáticamente (funciona en
    // localhost, preview de Vercel, o el dominio final, sin tocar código).
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;

    const preference = {
      items: items.map((it) => ({
        title: String(it.title).slice(0, 200),
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price),
        currency_id: "MXN"
      })),
      external_reference: orderId || `MAPLE-${Date.now()}`,
      back_urls: {
        success: `${baseUrl}/?mp_status=approved`,
        failure: `${baseUrl}/?mp_status=failure`,
        pending: `${baseUrl}/?mp_status=pending`
      },
      auto_return: "approved",
      statement_descriptor: "MAPLE HORNO DULCE"
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(500).json({
        error: data.message || "Mercado Pago rechazó la solicitud.",
        details: data
      });
    }

    return res.status(200).json({
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      id: data.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
