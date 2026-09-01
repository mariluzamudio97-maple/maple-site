import crypto from "crypto";

function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a || ""));
  const bBuffer = Buffer.from(String(b || ""));

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !adminPassword) {
    throw new Error("Missing environment variables");
  }

  return { supabaseUrl, supabaseKey, adminPassword };
}

function supabaseHeaders(key) {
  return {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readAvailability(supabaseUrl, supabaseKey) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/availability_config?id=eq.main&select=*`,
    {
      method: "GET",
      headers: supabaseHeaders(supabaseKey),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase read error:", details);
    throw new Error("Could not read availability");
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

async function saveAvailability(supabaseUrl, supabaseKey, data) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/availability_config?id=eq.main`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(supabaseKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        orders_paused: Boolean(data.ordersPaused),
        pause_message:
          data.pauseMessage ||
          "Pedidos temporalmente cerrados. Gracias por tu comprensión.",
        closed_dates: Array.isArray(data.closedDates)
          ? data.closedDates
          : [],
        blocked_ranges:
          data.blockedRanges &&
          typeof data.blockedRanges === "object"
            ? data.blockedRanges
            : {},
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase update error:", details);
    throw new Error("Could not update availability");
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

function formatConfig(config) {
  return {
    ordersPaused: Boolean(config?.orders_paused),
    pauseMessage:
      config?.pause_message ||
      "Pedidos temporalmente cerrados. Gracias por tu comprensión.",
    closedDates: Array.isArray(config?.closed_dates)
      ? config.closed_dates
      : [],
    blockedRanges:
      config?.blocked_ranges &&
      typeof config.blocked_ranges === "object"
        ? config.blocked_ranges
        : {},
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { supabaseUrl, supabaseKey, adminPassword } = getConfig();

    const suppliedPassword = req.headers["x-admin-password"];

    if (!safeEqual(suppliedPassword, adminPassword)) {
      return res.status(401).json({
        error: "Contraseña incorrecta",
      });
    }

    if (req.method === "GET") {
      const config = await readAvailability(supabaseUrl, supabaseKey);

      if (!config) {
        return res.status(404).json({
          error: "Availability configuration not found",
        });
      }

      return res.status(200).json(formatConfig(config));
    }

    if (req.method === "POST") {
      const current = await readAvailability(supabaseUrl, supabaseKey);

      if (!current) {
        return res.status(404).json({
          error: "Availability configuration not found",
        });
      }

      const body = req.body || {};

      const nextConfig = {
        ordersPaused:
          typeof body.ordersPaused === "boolean"
            ? body.ordersPaused
            : Boolean(current.orders_paused),

        pauseMessage:
          typeof body.pauseMessage === "string"
            ? body.pauseMessage
            : current.pause_message,

        closedDates: Array.isArray(body.closedDates)
          ? body.closedDates
          : current.closed_dates || [],

        blockedRanges:
          body.blockedRanges &&
          typeof body.blockedRanges === "object"
            ? body.blockedRanges
            : current.blocked_ranges || {},
      };

      const saved = await saveAvailability(
        supabaseUrl,
        supabaseKey,
        nextConfig
      );

      return res.status(200).json({
        ok: true,
        ...formatConfig(saved),
      });
    }

    res.setHeader("Allow", "GET, POST");

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("Admin availability API error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
