import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Código é obrigatório." });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("tracking_orders")
      .select("*")
      .eq("tracking_code", code)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: "Rastreio não encontrado." });
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("tracking_events")
      .select("*")
      .eq("tracking_order_id", order.id)
      .order("event_time", { ascending: false });

    if (eventsError) throw eventsError;

    return res.status(200).json({ order, events: events || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro ao buscar histórico." });
  }
}
