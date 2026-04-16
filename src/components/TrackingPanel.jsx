import React, { useState } from "react";
import { Search, PackageCheck, Truck, Globe } from "lucide-react";

export default function TrackingPanel() {
  const [trackingCode, setTrackingCode] = useState("");
  const [tracking, setTracking] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTrack() {
    try {
      setLoading(true);
      setError("");
      setTracking(null);
      setEvents([]);

      const response = await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackingCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao rastrear");
      }

      setTracking(data);
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message || "Erro ao consultar rastreio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2 text-white text-lg font-semibold">
          <Truck className="h-5 w-5" /> Rastreamento internacional
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="Digite seu código de rastreio"
            className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none"
          />

          <button
            onClick={handleTrack}
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Consultando..." : "Rastrear"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {tracking && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2 text-white text-lg font-semibold">
              <PackageCheck className="h-5 w-5" /> Resumo
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/50">Código</div>
                <div className="mt-1 text-white">{tracking.tracking_code}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/50">Status</div>
                <div className="mt-1 text-white">{tracking.status_label || tracking.status || "Sem status"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/50">Transportadora</div>
                <div className="mt-1 text-white">{tracking.carrier_name || "Detectando..."}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/50">Origem / Destino</div>
                <div className="mt-1 text-white">
                  {tracking.origin_country || "—"} → {tracking.destination_country || "—"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/50">Última localização</div>
                <div className="mt-1 text-white">{tracking.last_event_location || "Sem localização"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2 text-white text-lg font-semibold">
              <Globe className="h-5 w-5" /> Timeline
            </div>

            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Nenhum evento encontrado ainda.
                </div>
              ) : (
                events.map((event, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs text-white/45">{event.event_time || "Sem data"}</div>
                    <div className="mt-1 text-white font-medium">{event.description || "Atualização"}</div>
                    <div className="mt-1 text-sm text-white/60">{event.location || "Sem localização"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
