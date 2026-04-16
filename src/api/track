import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalize17TrackPayload(apiData, trackingCode) {
  const item = Array.isArray(apiData?.data) ? apiData.data[0] : null;
  const trackInfo = item?.track_info || {};
  const latest = Array.isArray(trackInfo?.tracking) ? trackInfo.tracking[0] : null;
  const events = Array.isArray(trackInfo?.tracking)
    ? trackInfo.tracking.map((event) => ({
        event_time: event?.time_iso || null,
        location: event?.location || "",
        description: event?.description || event?.status || "",
        status: event?.status || "",
        raw_payload: event,
      }))
    : [];

  return {
    tracking_code: trackingCode,
    provider: "17track",
    carrier_name: trackInfo?.carrier_code || "",
    status: trackInfo?.status || "",
    status_label: trackInfo?.status_description || "",
    origin_country: trackInfo?.from || "",
    destination_country: trackInfo?.to || "",
    last_event_at: latest?.time_iso || null,
    last_event_location: latest?.location || "",
    raw_payload: apiData,
    events,
  };
}

async function saveTracking(normalized) {
  const { events, ...orderPayload } = normalized;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("tracking_orders")
    .upsert(orderPayload, { onConflict: "tracking_code" })
    .select("id")
    .single();

  if (orderError) throw orderError;

  await supabaseAdmin.from("tracking_events").delete().eq("tracking_order_id", order.id);

  if (events.length > 0) {
    const payload = events.map((event) => ({
      tracking_order_id: order.id,
      event_time: event.event_time,
      location: event.location,
      description: event.description,
      status: event.status,
      raw_payload: event.raw_payload,
    }));

    const { error: eventsError } = await supabaseAdmin.from("tracking_events").insert(payload);
    if (eventsError) throw eventsError;
  }

  return order.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { trackingCode } = req.body || {};

    if (!trackingCode) {
      return res.status(400).json({ error: "Código de rastreio é obrigatório." });
    }

    const response = await fetch("https://api.17track.net/track/v2/GetTrackInfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": process.env.TRACKING_API_KEY,
      },
      body: JSON.stringify([
        {
          number: trackingCode,
        },
      ]),
    });

    const apiData = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: apiData?.message || "Erro ao consultar rastreio.",
      });
    }

    const normalized = normalize17TrackPayload(apiData, trackingCode);
    await saveTracking(normalized);

    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro interno no rastreamento.",
    });
  }
}
