"use client";

import React, { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import { useToastStore } from "../../store/toastStore";
import { Upload, Satellite, Layers, AlertTriangle, RefreshCw } from "lucide-react";

// First NDVI computation for a new boundary reads ~40 Sentinel-2 scenes (~45 s); later calls hit the cache.
const LONG_TIMEOUT_MS = 150000;

interface Props {
  farmId: number;
  hasBoundary: boolean;
  onBoundarySaved: () => void;
}

export default function FieldRealDataPanel({ farmId, hasBoundary, onBoundarySaved }: Props) {
  const { showToast } = useToastStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [veg, setVeg] = useState<any>(null);
  const [soil, setSoil] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVeg(null); setSoil(null); setAlerts(null); setUploadResult(null); setError(null);
  }, [farmId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post(`/api/v1/farms/${farmId}/boundary`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResult(res.data);
      showToast(`Boundary saved: ${res.data.area.hectares.toFixed(2)} ha (${res.data.saved_geometry_type})`, "success");
      onBoundarySaved();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Upload failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      showToast("Boundary import failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const loadRealData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, s, a] = await Promise.all([
        api.get(`/api/v1/farms/${farmId}/vegetation`, { timeout: LONG_TIMEOUT_MS }),
        api.get(`/api/v1/farms/${farmId}/soil-estimate`, { timeout: 60000 }).catch((e) => ({ data: { error: e.response?.data?.detail } })),
        api.get(`/api/v1/farms/${farmId}/alerts`, { timeout: LONG_TIMEOUT_MS }).catch(() => ({ data: null })),
      ]);
      setVeg(v.data);
      setSoil(s.data);
      setAlerts(a.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to load satellite data";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const obs: any[] = veg?.observations || [];
  const latest = veg?.latest;
  const est = soil?.estimate;

  return (
    <div className="clean-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <Satellite className="h-4 w-4 text-emerald-600" /> Field boundary &amp; real satellite / soil data
        </span>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".kml,.kmz,.geojson,.json" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
          >
            {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import KML / KMZ / GeoJSON
          </button>
          <button
            onClick={loadRealData}
            disabled={loading || !(hasBoundary || uploadResult)}
            title={hasBoundary || uploadResult ? "" : "Import a boundary first"}
            className="bg-emerald-600 disabled:bg-slate-300 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            {loading ? "Reading Sentinel-2 scenes…" : "Load real field data"}
          </button>
        </div>
      </div>

      {!hasBoundary && !uploadResult && (
        <p className="text-xs text-slate-500">No boundary yet. Import a KML/KMZ (e.g. from Google Earth) or GeoJSON file to enable real NDVI, weather and soil data.</p>
      )}
      {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      {uploadResult && (
        <div className="text-xs text-slate-600 space-y-1">
          <div>Saved {uploadResult.saved_geometry_type}: <b>{uploadResult.area.hectares.toFixed(2)} ha</b> measured (you entered {uploadResult.entered_area.value} {uploadResult.entered_area.unit}).</div>
          {uploadResult.skipped?.length > 0 && (
            <div className="text-amber-700">Skipped: {uploadResult.skipped.map((s: any) => `${s.name} (${s.reason})`).join("; ")}</div>
          )}
        </div>
      )}

      {veg && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Sentinel-2 NDVI ({veg.status})</div>
          {latest ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="block text-[10px] text-slate-400 uppercase">Latest NDVI mean</span><b>{latest.ndvi.mean}</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">p10 / p90</span><b>{latest.ndvi.p10} / {latest.ndvi.p90}</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">Valid pixels</span><b>{latest.valid_pixel_pct}%</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">Scene cloud</span><b>{latest.scene_cloud_pct}%</b></div>
              </div>
              <div className="flex items-end gap-0.5 h-16" aria-label="NDVI time series">
                {obs.map((o, i) => (
                  <div key={i} title={`${o.date}: NDVI ${o.ndvi.mean} (valid ${o.valid_pixel_pct}%)`}
                    className="flex-1 bg-emerald-500/70 rounded-t"
                    style={{ height: `${Math.max(2, Math.round(Math.max(0, o.ndvi.mean) * 100))}%` }} />
                ))}
              </div>
              <div className="text-[10px] text-slate-400">
                {obs.length} clear scenes, {veg.scenes_rejected_low_valid} rejected (&lt;{veg.thresholds.min_valid_pixel_pct}% valid pixels) · latest {latest.scene_id} ({latest.date}) · {latest.source}
              </div>
            </>
          ) : (
            <div className="text-xs text-amber-700">No usable Sentinel-2 scene. {veg.notes?.join(" ")}</div>
          )}
        </div>
      )}

      {soil && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Soil estimate (SoilGrids)</div>
          {est?.status === "estimated" ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="block text-[10px] text-slate-400 uppercase">pH (H2O)</span><b>{est.topsoil_0_30cm.ph_h2o}</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">Organic C</span><b>{est.topsoil_0_30cm.soc_g_kg} g/kg</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">Clay / Sand / Silt</span><b>{est.topsoil_0_30cm.clay_pct} / {est.topsoil_0_30cm.sand_pct} / {est.topsoil_0_30cm.silt_pct} %</b></div>
                <div><span className="block text-[10px] text-slate-400 uppercase">Texture (USDA)</span><b>{est.texture_class_usda}</b></div>
              </div>
              <div className="text-[10px] text-amber-700">{est.label}, 0-30 cm. Your lab/entered N-P-K and pH are kept and take precedence.</div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Soil estimate unavailable: {est?.reason || soil.error}</div>
          )}
        </div>
      )}

      {alerts && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Field alerts ({alerts.alerts?.length ?? 0})
          </div>
          {(alerts.alerts || []).map((a: any, i: number) => (
            <div key={i} className="text-xs p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-1">
              <div className="font-bold text-amber-800">{a.title} · confidence {a.confidence}</div>
              <div className="text-slate-700">{a.evidence_text}</div>
              <div className="text-slate-600">Action: {a.recommended_action}</div>
            </div>
          ))}
          {(alerts.suppressed || []).length > 0 && (
            <div className="text-[10px] text-slate-400">Suppressed: {alerts.suppressed.map((s: any) => s.reason).join("; ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
