export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are not configured",
    });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/availability_config?id=eq.main&select=orders_paused,pause_message,closed_dates,blocked_ranges`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Supabase error:", details);

      return res.status(500).json({
        error: "Could not load availability",
      });
    }

    const rows = await response.json();
    const config = rows?.[0];

    if (!config) {
      return res.status(404).json({
        error: "Availability configuration not found",
      });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ordersPaused: Boolean(config.orders_paused),

      pauseMessage:
        config.pause_message ||
        "Pedidos temporalmente cerrados. Gracias por tu comprensión.",

      closedDates: Array.isArray(config.closed_dates)
        ? config.closed_dates
        : [],

      blockedRanges:
        config.blocked_ranges &&
        typeof config.blocked_ranges === "object"
          ? config.blocked_ranges
          : {},
    });
  } catch (error) {
    console.error("Availability API error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
