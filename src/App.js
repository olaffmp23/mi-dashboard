import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ─── HELPERS ────────────────────────────────────────────────────────────────
const parseCSV = (text) => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] ?? ""; return obj; }, {});
  });
};

const num = (v) => parseFloat((v ?? "").toString().replace(/[^0-9.-]/g, "")) || 0;
const fmt = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString("es-MX", { maximumFractionDigits: d }) : "—";
const fmtMoney = (v) => "$" + fmt(v, 2);
const fmtPct = (v) => fmt(v, 2) + "%";

// Try to auto-detect column names
const detect = (row, ...candidates) => {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return null;
};

// ─── STYLE ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #080c14; }

  .dash {
    min-height: 100vh;
    background: #080c14;
    color: #e2e8f0;
    font-family: 'Syne', sans-serif;
    padding: 0;
  }

  /* ── HEADER ── */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 28px;
    background: rgba(12,16,28,0.95);
    border-bottom: 1px solid rgba(99,179,237,0.12);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
  }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #06b6d4);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 800;
  }
  .logo-text { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
  .logo-text span { color: #3b82f6; }

  .header-right { display: flex; align-items: center; gap: 12px; }
  .badge {
    padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
    font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;
  }
  .badge-live { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .badge-warn { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .badge-err  { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }

  /* ── SETUP PANEL ── */
  .setup {
    max-width: 640px; margin: 80px auto; padding: 40px;
    background: rgba(15,20,35,0.8);
    border: 1px solid rgba(99,179,237,0.15);
    border-radius: 16px;
    box-shadow: 0 0 60px rgba(59,130,246,0.06);
  }
  .setup h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
  .setup p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
  .setup ol { color: #94a3b8; font-size: 13px; line-height: 2; margin-bottom: 24px; padding-left: 20px; }
  .setup ol li strong { color: #cbd5e1; }
  .input-row { display: flex; gap: 10px; }
  .url-input {
    flex: 1; padding: 11px 14px;
    background: rgba(30,41,59,0.8);
    border: 1px solid rgba(99,179,237,0.2);
    border-radius: 10px; color: #e2e8f0;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    outline: none; transition: border 0.2s;
  }
  .url-input:focus { border-color: rgba(59,130,246,0.6); }
  .url-input::placeholder { color: #475569; }
  .btn {
    padding: 11px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
    transition: all 0.2s;
  }
  .btn-primary {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 4px 14px rgba(59,130,246,0.35);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(59,130,246,0.45); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-sm {
    padding: 7px 14px; font-size: 12px; background: rgba(30,41,59,0.8);
    color: #94a3b8; border: 1px solid rgba(99,179,237,0.15);
  }
  .btn-sm:hover { color: #e2e8f0; border-color: rgba(99,179,237,0.35); }
  .error-msg { color: #f87171; font-size: 12px; margin-top: 10px; }

  /* ── MAIN ── */
  .main { padding: 24px 28px; }
  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: #475569; margin-bottom: 14px;
  }

  /* ── KPI CARDS ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
  @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .kpi-grid { grid-template-columns: 1fr; } }

  .kpi-card {
    background: rgba(15,20,35,0.7);
    border: 1px solid rgba(99,179,237,0.1);
    border-radius: 14px; padding: 18px 20px 14px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.2s;
  }
  .kpi-card:hover { border-color: rgba(99,179,237,0.3); transform: translateY(-2px); }
  .kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: var(--accent);
  }
  .kpi-icon { font-size: 18px; margin-bottom: 10px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 6px; }
  .kpi-value { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: #f1f5f9; }
  .kpi-sub { font-size: 11px; color: #64748b; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
  .kpi-chart { margin-top: 12px; height: 38px; }

  /* ── CHARTS SECTION ── */
  .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 28px; }
  @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }

  .chart-card {
    background: rgba(15,20,35,0.7);
    border: 1px solid rgba(99,179,237,0.1);
    border-radius: 14px; padding: 20px;
  }
  .chart-title { font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 16px; }

  /* ── TABLE ── */
  .table-card {
    background: rgba(15,20,35,0.7);
    border: 1px solid rgba(99,179,237,0.1);
    border-radius: 14px; overflow: hidden; margin-bottom: 28px;
  }
  .table-header { padding: 16px 20px; border-bottom: 1px solid rgba(99,179,237,0.08); }
  .table-header h3 { font-size: 13px; font-weight: 700; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
    color: #475569; padding: 10px 20px; text-align: left;
    border-bottom: 1px solid rgba(99,179,237,0.08);
  }
  td {
    padding: 12px 20px; font-size: 13px; color: #94a3b8;
    border-bottom: 1px solid rgba(99,179,237,0.05);
    font-family: 'JetBrains Mono', monospace;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(59,130,246,0.04); color: #cbd5e1; }
  td:first-child { color: #e2e8f0; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; }

  .pill {
    display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600;
    font-family: 'Syne', sans-serif; letter-spacing: 0.3px;
  }
  .pill-green { background: rgba(34,197,94,0.12); color: #22c55e; }
  .pill-blue  { background: rgba(59,130,246,0.12); color: #60a5fa; }
  .pill-amber { background: rgba(245,158,11,0.12); color: #f59e0b; }
  .pill-red   { background: rgba(239,68,68,0.12); color: #f87171; }

  /* ── TOOLTIP ── */
  .custom-tooltip {
    background: rgba(12,16,28,0.96); border: 1px solid rgba(99,179,237,0.2);
    border-radius: 8px; padding: 10px 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px;
  }
  .custom-tooltip p { color: #94a3b8; margin-bottom: 4px; font-size: 11px; }
  .custom-tooltip span { color: #e2e8f0; font-weight: 700; }

  /* ── LOADING ── */
  .loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px; gap: 16px; color: #475569;
  }
  .spinner {
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid rgba(59,130,246,0.15);
    border-top-color: #3b82f6;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── COLUMNS MAP ── */
  .col-map {
    background: rgba(15,20,35,0.7); border: 1px solid rgba(245,158,11,0.2);
    border-radius: 12px; padding: 20px; margin-bottom: 24px;
  }
  .col-map h3 { font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 14px; }
  .col-map p { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
  .col-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 700px) { .col-grid { grid-template-columns: 1fr 1fr; } }
  .col-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; display: block; margin-bottom: 4px; }
  select {
    width: 100%; padding: 7px 10px;
    background: rgba(30,41,59,0.8);
    border: 1px solid rgba(99,179,237,0.2);
    border-radius: 8px; color: #e2e8f0;
    font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none;
  }
  select:focus { border-color: rgba(59,130,246,0.5); }

  .filters { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
  .filter-label { font-size: 11px; color: #64748b; }
  .filter-select {
    padding: 7px 12px;
    background: rgba(15,20,35,0.8);
    border: 1px solid rgba(99,179,237,0.15);
    border-radius: 8px; color: #e2e8f0;
    font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; cursor: pointer;
  }
  .filter-select:focus { border-color: rgba(59,130,246,0.4); }
`;

// ─── CUSTOM TOOLTIP ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p>{label}</p>
      {payload.map((p, i) => (
        <div key={i}><span style={{ color: p.color }}>{p.name}: </span><span>{typeof p.value === "number" ? fmt(p.value, 2) : p.value}</span></div>
      ))}
    </div>
  );
};

// ─── KPI CARD ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon, accent, data, dataKey }) => (
  <div className="kpi-card" style={{ "--accent": accent }}>
    <div className="kpi-icon">{icon}</div>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
    {data?.length > 1 && (
      <div className="kpi-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accent} stopOpacity={0.25} />
                <stop offset="95%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={dataKey} stroke={accent} strokeWidth={1.5} fill={`url(#g-${label})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

// ─── SETUP ───────────────────────────────────────────────────────────────────
const DEMO_DATA = [
  { campaign: "Campaña Ventas Q1", impressions: "45200", clicks: "1820", spend: "3200", reach: "38000", ctr: "4.03", cpc: "1.76", conversions: "142", date: "2024-01" },
  { campaign: "Remarketing Web", impressions: "18900", clicks: "940", spend: "1100", reach: "15600", ctr: "4.97", cpc: "1.17", conversions: "78", date: "2024-01" },
  { campaign: "Brand Awareness", impressions: "102000", clicks: "1200", spend: "2400", reach: "89000", ctr: "1.18", cpc: "2.00", conversions: "22", date: "2024-01" },
  { campaign: "Lead Generation", impressions: "32000", clicks: "2100", spend: "4100", reach: "28000", ctr: "6.56", cpc: "1.95", conversions: "205", date: "2024-02" },
  { campaign: "Campaña Ventas Q1", impressions: "51000", clicks: "2200", spend: "3800", reach: "42000", ctr: "4.31", cpc: "1.73", conversions: "168", date: "2024-02" },
  { campaign: "Remarketing Web", impressions: "21000", clicks: "1050", spend: "1250", reach: "17800", ctr: "5.00", cpc: "1.19", conversions: "90", date: "2024-02" },
  { campaign: "Lead Generation", impressions: "38000", clicks: "2600", spend: "4900", reach: "33000", ctr: "6.84", cpc: "1.88", conversions: "248", date: "2024-03" },
  { campaign: "Campaña Ventas Q1", impressions: "58000", clicks: "2500", spend: "4200", reach: "48000", ctr: "4.31", cpc: "1.68", conversions: "196", date: "2024-03" },
];

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function FbAdsDashboard() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | live | demo
  const [colMap, setColMap] = useState({});
  const [filter, setFilter] = useState("all");

  // Detect columns after data loads
  useEffect(() => {
    if (!rawData?.length) return;
    const r = rawData[0];
    setColMap({
      campaign:    detect(r, "campaign", "campaña", "nombre", "name", "adset", "ad set") || Object.keys(r)[0],
      impressions: detect(r, "impression", "impresion", "alcance") || null,
      reach:       detect(r, "reach", "alcance") || null,
      clicks:      detect(r, "click", "clic") || null,
      spend:       detect(r, "spend", "gasto", "costo", "cost", "amount spent") || null,
      ctr:         detect(r, "ctr") || null,
      cpc:         detect(r, "cpc", "cost per click") || null,
      conversions: detect(r, "conversion", "result", "leads") || null,
      date:        detect(r, "date", "fecha", "periodo") || null,
    });
  }, [rawData]);

  const csvUrlFromSheet = (url) => {
    // Handle sharing URL → export CSV
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const id = match[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  };

  const loadSheet = useCallback(async () => {
    const csvUrl = csvUrlFromSheet(sheetUrl);
    if (!csvUrl) { setError("URL inválida. Asegúrate de usar el link de tu Google Sheet."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("El sheet está vacío o no tiene datos.");
      setRawData(rows);
      setStatus("live");
    } catch (e) {
      setError(`No se pudo cargar el sheet: ${e.message}. ¿Publicaste el sheet como CSV?`);
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]);

  const loadDemo = () => { setRawData(DEMO_DATA); setStatus("demo"); };
  const reset = () => { setRawData(null); setStatus("idle"); setError(""); setSheetUrl(""); };

  // ── DERIVED DATA ─────────────────────────────────────────────────────────
  const cols = Object.keys(rawData?.[0] || {});
  const campaigns = rawData ? [...new Set(rawData.map(r => r[colMap.campaign] || "—"))] : [];

  const filtered = rawData
    ? (filter === "all" ? rawData : rawData.filter(r => r[colMap.campaign] === filter))
    : [];

  const total = (key) => filtered.reduce((s, r) => s + num(r[colMap[key]]), 0);

  const totalImp    = total("impressions");
  const totalReach  = total("reach");
  const totalClicks = total("clicks");
  const totalSpend  = total("spend");
  const totalConv   = total("conversions");
  const avgCTR      = totalImp > 0 ? (totalClicks / totalImp * 100) : 0;
  const avgCPC      = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
  const cpa         = totalConv > 0 ? (totalSpend / totalConv) : 0;

  // Chart: aggregate by campaign
  const byDate = colMap.date
    ? Object.entries(
        filtered.reduce((acc, r) => {
          const k = r[colMap.date] || "Sin fecha";
          if (!acc[k]) acc[k] = { date: k, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
          acc[k].impressions += num(r[colMap.impressions]);
          acc[k].clicks      += num(r[colMap.clicks]);
          acc[k].spend       += num(r[colMap.spend]);
          acc[k].conversions += num(r[colMap.conversions]);
          return acc;
        }, {})
      ).map(([, v]) => v).sort((a, b) => a.date > b.date ? 1 : -1)
    : [];

  const byCampaign = Object.entries(
    filtered.reduce((acc, r) => {
      const k = r[colMap.campaign] || "—";
      if (!acc[k]) acc[k] = { name: k.length > 20 ? k.slice(0, 18) + "…" : k, spend: 0, conversions: 0, clicks: 0 };
      acc[k].spend       += num(r[colMap.spend]);
      acc[k].conversions += num(r[colMap.conversions]);
      acc[k].clicks      += num(r[colMap.clicks]);
      return acc;
    }, {})
  ).map(([, v]) => v);

  // KPI sparklines
  const sparkData = byDate.length ? byDate : byCampaign.map((c, i) => ({ x: i, ...c }));

  const kpis = rawData ? [
    { label: "Impresiones",  value: fmt(totalImp),    sub: "Total",        icon: "👁", accent: "#3b82f6",  key: "impressions" },
    { label: "Alcance",      value: fmt(totalReach),  sub: "Personas únicas", icon: "📡", accent: "#8b5cf6", key: "reach" },
    { label: "Clics",        value: fmt(totalClicks), sub: "Link Clicks",  icon: "🖱", accent: "#06b6d4",  key: "clicks" },
    { label: "CTR",          value: fmtPct(avgCTR),   sub: "Click-Through Rate", icon: "📊", accent: "#10b981", key: "ctr" },
    { label: "Gasto",        value: fmtMoney(totalSpend), sub: "Total invertido", icon: "💰", accent: "#f59e0b", key: "spend" },
    { label: "CPC",          value: fmtMoney(avgCPC), sub: "Costo por clic", icon: "🎯", accent: "#ec4899", key: "cpc" },
    { label: "Conversiones", value: fmt(totalConv),   sub: "Resultados",   icon: "✅", accent: "#22c55e",  key: "conversions" },
    { label: "CPA",          value: fmtMoney(cpa),    sub: "Costo por resultado", icon: "💡", accent: "#f97316", key: null },
  ] : [];

  // Table rows by campaign
  const tableRows = byCampaign.map(r => {
    const rows = filtered.filter(d => (d[colMap.campaign] || "—").slice(0, 18) === r.name.replace("…", "").slice(0, 18) || r.name.endsWith("…"));
    const imp = rows.reduce((s, d) => s + num(d[colMap.impressions]), 0);
    const clk = rows.reduce((s, d) => s + num(d[colMap.clicks]), 0);
    const spd = rows.reduce((s, d) => s + num(d[colMap.spend]), 0);
    const cnv = rows.reduce((s, d) => s + num(d[colMap.conversions]), 0);
    const ctr = imp > 0 ? clk / imp * 100 : 0;
    const cpc = clk > 0 ? spd / clk : 0;
    return { name: r.name, imp, clk, spd, cnv, ctr, cpc, rows: rows.length };
  });

  // Status badge
  const badgeCls = status === "live" ? "badge-live" : status === "demo" ? "badge-warn" : "badge-err";
  const badgeTxt = status === "live" ? "● LIVE" : status === "demo" ? "● DEMO" : "● SIN DATOS";

  return (
    <>
      <style>{css}</style>
      <div className="dash">
        {/* HEADER */}
        <div className="header">
          <div className="logo">
            <div className="logo-icon">A</div>
            <div className="logo-text">Ads<span>Analytics</span></div>
          </div>
          <div className="header-right">
            {rawData && <span className={`badge ${badgeCls}`}>{badgeTxt}</span>}
            {rawData && <button className="btn btn-sm" onClick={reset}>← Cambiar Sheet</button>}
          </div>
        </div>

        {/* SETUP */}
        {!rawData && (
          <div className="setup">
            <h2>Conecta tu Google Sheet 📊</h2>
            <p>Ingresa la URL de tu Google Sheet con los datos de tus campañas de Facebook Ads. El sheet debe estar publicado para que sea visible.</p>
            <ol>
              <li>Abre tu Google Sheet</li>
              <li><strong>Archivo → Compartir → Publicar en la web</strong></li>
              <li>Selecciona <strong>Hoja 1</strong> y formato <strong>CSV</strong>, luego haz clic en <strong>Publicar</strong></li>
              <li>Copia la URL de tu sheet (la URL normal del navegador también funciona)</li>
            </ol>
            <div className="input-row">
              <input
                className="url-input"
                placeholder="https://docs.google.com/spreadsheets/d/TU_ID/..."
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadSheet()}
              />
              <button className="btn btn-primary" onClick={loadSheet} disabled={loading || !sheetUrl.trim()}>
                {loading ? "Cargando…" : "Conectar"}
              </button>
            </div>
            {error && <div className="error-msg">⚠ {error}</div>}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(99,179,237,0.1)" }}>
              <button className="btn btn-sm" onClick={loadDemo} style={{ fontSize: 12 }}>
                Ver demo con datos de ejemplo →
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {rawData && (
          <div className="main">
            {/* COLUMN MAPPING */}
            {Object.values(colMap).some(v => !v) && (
              <div className="col-map">
                <h3>⚙ Mapear columnas</h3>
                <p>Algunos campos no se detectaron automáticamente. Selecciona la columna correspondiente:</p>
                <div className="col-grid">
                  {Object.entries(colMap).map(([field, val]) => !val && (
                    <div className="col-item" key={field}>
                      <label>{field}</label>
                      <select value={val || ""} onChange={e => setColMap(prev => ({ ...prev, [field]: e.target.value || null }))}>
                        <option value="">— Ignorar —</option>
                        {cols.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILTERS */}
            <div className="filters">
              <span className="filter-label">Filtrar por campaña:</span>
              <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">Todas las campañas</option>
                {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* KPI ROW 1 */}
            <div className="section-label">Métricas principales</div>
            <div className="kpi-grid">
              {kpis.slice(0, 4).map(k => (
                <KpiCard key={k.label} {...k}
                  data={sparkData}
                  dataKey={k.key && sparkData.length && k.key in sparkData[0] ? k.key : undefined}
                />
              ))}
            </div>

            {/* KPI ROW 2 */}
            <div className="section-label">Rendimiento financiero</div>
            <div className="kpi-grid">
              {kpis.slice(4).map(k => (
                <KpiCard key={k.label} {...k}
                  data={sparkData}
                  dataKey={k.key && sparkData.length && k.key in sparkData[0] ? k.key : undefined}
                />
              ))}
            </div>

            {/* CHARTS */}
            {byDate.length > 1 && (
              <>
                <div className="section-label">Tendencia en el tiempo</div>
                <div className="charts-grid">
                  <div className="chart-card">
                    <div className="chart-title">Impresiones & Clics por período</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={byDate}>
                        <defs>
                          <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="impressions" name="Impresiones" stroke="#3b82f6" fill="url(#gi)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="clicks" name="Clics" stroke="#06b6d4" fill="url(#gc)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-card">
                    <div className="chart-title">Gasto por período</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={byDate}>
                        <XAxis dataKey="date" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="spend" name="Gasto ($)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {/* BY CAMPAIGN CHART */}
            {byCampaign.length > 1 && (
              <>
                <div className="section-label">Por campaña</div>
                <div className="chart-card" style={{ marginBottom: 28 }}>
                  <div className="chart-title">Gasto vs Conversiones por campaña</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byCampaign} layout="vertical">
                      <XAxis type="number" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={140} stroke="#334155" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="spend" name="Gasto ($)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="conversions" name="Conversiones" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* TABLE */}
            <div className="section-label">Detalle por campaña</div>
            <div className="table-card">
              <div className="table-header"><h3>Resumen de campañas — {filtered.length} registros</h3></div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Campaña</th>
                      <th>Impresiones</th>
                      <th>Clics</th>
                      <th>CTR</th>
                      <th>Gasto</th>
                      <th>CPC</th>
                      <th>Conversiones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{fmt(r.imp)}</td>
                        <td>{fmt(r.clk)}</td>
                        <td>
                          <span className={`pill ${r.ctr >= 5 ? "pill-green" : r.ctr >= 2 ? "pill-blue" : r.ctr >= 1 ? "pill-amber" : "pill-red"}`}>
                            {fmtPct(r.ctr)}
                          </span>
                        </td>
                        <td>{fmtMoney(r.spd)}</td>
                        <td>{fmtMoney(r.cpc)}</td>
                        <td>
                          <span className="pill pill-green">{fmt(r.cnv)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}