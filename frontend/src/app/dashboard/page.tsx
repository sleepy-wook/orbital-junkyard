"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import { fetchTableData, formatNumber } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import type { OrbitalCensus, CongestionMetric, TableExport } from "@/lib/types";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const TypePieChart = dynamic(
  () => import("@/components/charts/DashboardCharts").then((m) => m.TypePieChart),
  { ssr: false, loading: () => <Spinner /> }
);
const RegimeBarChart = dynamic(
  () => import("@/components/charts/DashboardCharts").then((m) => m.RegimeBarChart),
  { ssr: false, loading: () => <Spinner /> }
);
const CongestionBarChart = dynamic(
  () => import("@/components/charts/DashboardCharts").then((m) => m.CongestionBarChart),
  { ssr: false, loading: () => <Spinner /> }
);

function StatCard({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-3 md:p-4">
      <p className="text-xs text-foreground/50 uppercase tracking-wider">{label}</p>
      <p className={`text-xl md:text-2xl font-bold mt-1 tabular-nums min-h-[32px] md:min-h-[36px] ${color}`}>
        {loading ? <span className="inline-block w-20 h-7 bg-foreground/10 rounded animate-pulse" /> : formatNumber(value)}
      </p>
    </div>
  );
}

const BAND_SIZE = 200;

export default function DashboardPage() {
  const { t } = useTranslation();
  const [census, setCensus] = useState<OrbitalCensus[]>([]);
  const [congestion, setCongestion] = useState<CongestionMetric[]>([]);
  const [loadingCensus, setLoadingCensus] = useState(true);
  const [loadingCongestion, setLoadingCongestion] = useState(true);

  useEffect(() => {
    fetchTableData<OrbitalCensus>("orbital_census")
      .then((r: TableExport<OrbitalCensus>) => setCensus(r.data))
      .catch(() => {})
      .finally(() => setLoadingCensus(false));
    fetchTableData<CongestionMetric>("congestion_metrics")
      .then((r: TableExport<CongestionMetric>) => setCongestion(r.data))
      .catch(() => {})
      .finally(() => setLoadingCongestion(false));
  }, []);

  const byType = useMemo(() =>
    census.reduce((acc, row) => {
      acc[row.object_type] = (acc[row.object_type] || 0) + row.object_count;
      return acc;
    }, {} as Record<string, number>), [census]);

  const pieData = useMemo(() =>
    Object.entries(byType).map(([name, value]) => ({ name, value })), [byType]);

  const regimeData = useMemo(() => {
    const m: Record<string, { regime: string; payload: number; debris: number; rocket_body: number }> = {};
    for (const row of census) {
      if (!m[row.orbital_regime]) m[row.orbital_regime] = { regime: row.orbital_regime, payload: 0, debris: 0, rocket_body: 0 };
      if (row.object_type === "PAYLOAD") m[row.orbital_regime].payload += row.object_count;
      else if (row.object_type === "DEBRIS") m[row.orbital_regime].debris += row.object_count;
      else m[row.orbital_regime].rocket_body += row.object_count;
    }
    return Object.values(m);
  }, [census]);

  const total = useMemo(() => Object.values(byType).reduce((s, v) => s + v, 0), [byType]);

  const aggregatedCongestion = useMemo(() => {
    const bandMap = new Map<number, { altitude_band_km: number; active_count: number; debris_count: number }>();
    for (const row of congestion) {
      const key = Math.floor(row.altitude_band_km / BAND_SIZE) * BAND_SIZE;
      const e = bandMap.get(key);
      if (e) { e.active_count += row.active_count; e.debris_count += row.debris_count; }
      else bandMap.set(key, { altitude_band_km: key, active_count: row.active_count, debris_count: row.debris_count });
    }
    return Array.from(bandMap.values()).sort((a, b) => a.altitude_band_km - b.altitude_band_km);
  }, [congestion]);

  return (
    <main className="pt-14 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 py-6 md:px-4 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-1">{t("dash.title")}</h1>
        <p className="text-foreground/50 text-sm mb-6 md:mb-8">{t("dash.desc")}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard label={t("dash.total")} value={total} color="text-accent" loading={loadingCensus} />
          <StatCard label={t("dash.payloads")} value={byType["PAYLOAD"] || 0} color="text-green-400" loading={loadingCensus} />
          <StatCard label={t("dash.debris")} value={byType["DEBRIS"] || 0} color="text-red-400" loading={loadingCensus} />
          <StatCard label={t("dash.rocket_bodies")} value={byType["ROCKET BODY"] || 0} color="text-yellow-400" loading={loadingCensus} />
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-card border border-card-border rounded-lg p-4 md:p-6 min-h-[300px] md:min-h-[364px]">
            <h2 className="text-sm font-semibold mb-4">{t("dash.by_type")}</h2>
            {loadingCensus ? <Spinner /> : <TypePieChart data={pieData} />}
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 md:p-6 min-h-[300px] md:min-h-[364px]">
            <h2 className="text-sm font-semibold mb-4">{t("dash.by_regime")}</h2>
            {loadingCensus ? <Spinner /> : <RegimeBarChart data={regimeData} />}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4 md:p-6 mb-6 md:mb-8 min-h-[350px] md:min-h-[408px]">
          <h2 className="text-sm font-semibold mb-4">{t("dash.congestion")}</h2>
          {loadingCongestion ? <Spinner /> : (
            <>
              <CongestionBarChart data={aggregatedCongestion} altLabel={t("dash.altitude_km")} />
              <p className="text-xs text-foreground/40 mt-2">{t("dash.congestion_note")}</p>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
