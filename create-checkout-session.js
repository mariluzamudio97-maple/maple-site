// api/create-checkout-session.js
//
// Esta función corre en el servidor (Vercel), nunca en el navegador del
// cliente. Su trabajo: recibir el carrito, crear una "Checkout Session"
// en Stripe, y devolver la URL de pago al sitio.
//
// La llave secreta (Secret Key) vive SOLO aquí, como variable de entorno
// en Vercel — nunca se escribe en el código ni se sube a GitHub.
//
// CONFIGURACIÓN NECESARIA EN VERCEL:
//   1. En el dashboard del proyecto → Settings → Environment Variables
//   2. Agrega: STRIPE_SECRET_KEY = tu Secret Key de Stripe
//      (empieza con sk_test_ mientras probamos, luego sk_live_ en producción)
//   3. Redeploy para que tome la variable nueva.
//
// No necesitas instalar el SDK de Stripe: esta función llama directo a su
// API REST con fetch, así que no requiere configurar dependencias en Vercel.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      error: "Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Vercel."
    });
  }

  try {
    const { items, orderId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;

    // Stripe espera datos como application/x-www-form-urlencoded con
    // notación de arreglo (line_items[0][...]), así que construimos el
    // body manualmente en vez de mandar JSON.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${baseUrl}/?stripe_status=approved&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${baseUrl}/?stripe_status=cancelled`);
    params.append("client_reference_id", orderId || `MAPLE-${Date.now()}`);

    items.forEach((it, i) => {
      const pesos = Number(it.unit_price);
      const centavos = Math.round(pesos * 100); // Stripe cobra en centavos
      params.append(`line_items[${i}][price_data][currency]`, "mxn");
      params.append(`line_items[${i}][price_data][product_data][name]`, String(it.title).slice(0, 200));
      params.append(`line_items[${i}][price_data][unit_amount]`, String(centavos));
      params.append(`line_items[${i}][quantity]`, String(Number(it.quantity) || 1));
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(500).json({
        error: (data.error && data.error.message) || "Stripe rechazó la solicitud.",
        details: data
      });
    }

    return res.status(200).json({
      checkout_url: data.url,
      session_id: data.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
