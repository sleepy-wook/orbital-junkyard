"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import { fetchTableData, formatNumber } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import type { ConstellationGrowth, DecayTracker, TableExport } from "@/lib/types";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const ConstellationBarChart = dynamic(
  () => import("@/components/charts/ConstellationChart").then((m) => m.ConstellationBarChart),
  { ssr: false, loading: () => <Spinner /> }
);

const PAGE_SIZE = 20;

export default function ConstellationsPage() {
  const { t } = useTranslation();
  const [constellations, setConstellations] = useState<ConstellationGrowth[]>([]);
  const [decayList, setDecayList] = useState<DecayTracker[]>([]);
  const [loadingConst, setLoadingConst] = useState(true);
  const [loadingDecay, setLoadingDecay] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchTableData<ConstellationGrowth>("constellation_growth")
      .then((r: TableExport<ConstellationGrowth>) => setConstellations(r.data))
      .catch(() => {})
      .finally(() => setLoadingConst(false));
    fetchTableData<DecayTracker>("decay_tracker")
      .then((r: TableExport<DecayTracker>) => setDecayList(r.data))
      .catch(() => {})
      .finally(() => setLoadingDecay(false));
  }, []);

  const totalPages = Math.ceil(decayList.length / PAGE_SIZE);
  const pagedDecay = useMemo(
    () => decayList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [decayList, page]
  );

  return (
    <main className="pt-14 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 py-6 md:px-4 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-1">{t("const.title")}</h1>
        <p className="text-foreground/50 text-sm mb-6 md:mb-8">{t("const.desc")}</p>

        <div className="grid md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          {loadingConst ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg p-6 min-h-[104px]">
                <div className="w-20 h-4 bg-foreground/10 rounded animate-pulse mb-3" />
                <div className="w-28 h-9 bg-foreground/10 rounded animate-pulse mb-2" />
                <div className="w-32 h-3 bg-foreground/10 rounded animate-pulse" />
              </div>
            ))
          ) : (
            constellations.slice(0, 3).map((c) => (
              <div key={c.constellation} className="bg-card border border-card-border rounded-lg p-6 min-h-[104px]">
                <p className="text-xs text-foreground/50 uppercase tracking-wider">{c.constellation}</p>
                <p className="text-3xl font-bold mt-2 text-accent tabular-nums">{formatNumber(c.total_objects)}</p>
                <p className="text-xs text-foreground/40 mt-1">
                  {c.active_count} {t("const.active")} &middot; {Math.round(c.avg_altitude_km)} {t("const.avg_alt")}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4 md:p-6 mb-8 md:mb-12 min-h-[240px] md:min-h-[284px]">
          <h2 className="text-sm font-semibold mb-4">{t("const.comparison")}</h2>
          {loadingConst ? <Spinner /> : <ConstellationBarChart data={constellations} />}
        </div>

        <h2 className="text-xl md:text-2xl font-bold mb-1">{t("const.decay_title")}</h2>
        <p className="text-foreground/50 text-sm mb-6 md:mb-8">{t("const.decay_desc")}</p>

        <div className="bg-card border border-card-border rounded-lg p-4 md:p-6 min-h-[820px]">
          {loadingDecay ? <Spinner /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left py-2 px-3 text-foreground/50">{t("const.name")}</th>
                      <th className="text-left py-2 px-3 text-foreground/50">{t("const.type")}</th>
                      <th className="text-left py-2 px-3 text-foreground/50">{t("const.country")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("const.perigee")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("const.apogee")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("const.risk")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDecay.map((obj) => (
                      <tr key={obj.norad_cat_id} className="border-b border-card-border/50 hover:bg-card-border/20">
                        <td className="py-2 px-3 font-medium">{obj.object_name}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            obj.object_type === "PAYLOAD" ? "bg-green-500/20 text-green-400"
                            : obj.object_type === "DEBRIS" ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                          }`}>{obj.object_type}</span>
                        </td>
                        <td className="py-2 px-3 text-foreground/60">{obj.country}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <span className={obj.perigee_km < 300 ? "text-red-400" : ""}>{obj.perigee_km} km</span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{obj.apogee_km} km</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            obj.decay_risk === "imminent" ? "bg-red-500/20 text-red-400"
                            : obj.decay_risk === "high" ? "bg-orange-500/20 text-orange-400"
                            : "bg-yellow-500/20 text-yellow-400"
                          }`}>{obj.decay_risk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-foreground/40">
                    {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, decayList.length)} / {formatNumber(decayList.length)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-xs rounded border border-card-border hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >{t("page.prev")}</button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded border border-card-border hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >{t("page.next")}</button>
                  </div>
                </div>
              )}

              <p className="text-xs text-foreground/40 mt-4">{t("const.decay_note")}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
