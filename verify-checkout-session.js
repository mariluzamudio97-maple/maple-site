// api/verify-checkout-session.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({
      error: "Falta configurar STRIPE_SECRET_KEY en Vercel."
    });
  }

  try {
    const { sessionId, orderId } = req.body || {};

    if (
      typeof sessionId !== "string" ||
      !sessionId.startsWith("cs_") ||
      sessionId.length > 255
    ) {
      return res.status(400).json({
        error: "Session ID inválido."
      });
    }

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`
        }
      }
    );

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(stripeRes.status).json({
        error:
          (session.error && session.error.message) ||
          "No se pudo verificar la sesión con Stripe."
      });
    }

    // Comprueba que el pago corresponda al mismo pedido.
    if (
      orderId &&
      session.client_reference_id &&
      session.client_reference_id !== orderId
    ) {
      return res.status(400).json({
        paid: false,
        error: "La referencia del pago no corresponde a este pedido."
      });
    }

    // Solo consideramos confirmado un pago realmente completado.
    const paid =
      session.payment_status === "paid" &&
      session.status === "complete";

    return res.status(200).json({
      paid,
      session_id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      client_reference_id: session.client_reference_id || null
    });

  } catch (err) {
    return res.status(500).json({
      error:
        err && err.message
          ? err.message
          : "Error al verificar el pago."
    });
  }
}
