"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import { fetchTableData, formatNumber } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import type { CountryLeaderboard, TableExport } from "@/lib/types";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const CountryBarChart = dynamic(
  () => import("@/components/charts/CountryChart").then((m) => m.CountryBarChart),
  { ssr: false, loading: () => <Spinner /> }
);

const PAGE_SIZE = 20;

export default function CountriesPage() {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<CountryLeaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchTableData<CountryLeaderboard>("country_leaderboard")
      .then((r: TableExport<CountryLeaderboard>) => setCountries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => [...countries].sort((a, b) => b.total_objects - a.total_objects), [countries]);
  const top15 = useMemo(() => sorted.slice(0, 15), [sorted]);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pagedData = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  return (
    <main className="pt-14 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">{t("country.title")}</h1>
        <p className="text-foreground/50 text-sm mb-8">{t("country.desc")}</p>

        <div className="bg-card border border-card-border rounded-lg p-6 mb-8 min-h-[484px]">
          <h2 className="text-sm font-semibold mb-4">{t("country.top15")}</h2>
          {loading ? <Spinner /> : <CountryBarChart data={top15} />}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6 min-h-[840px]">
          <h2 className="text-sm font-semibold mb-4">{t("country.detail")}</h2>
          {loading ? <Spinner /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left py-2 px-3 text-foreground/50">#</th>
                      <th className="text-left py-2 px-3 text-foreground/50">{t("country.country")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("country.total")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("country.payloads")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("country.debris")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("country.rb")}</th>
                      <th className="text-right py-2 px-3 text-foreground/50">{t("country.debris_pct")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedData.map((row, i) => (
                      <tr key={row.country} className="border-b border-card-border/50 hover:bg-card-border/20">
                        <td className="py-2 px-3 text-foreground/40">{page * PAGE_SIZE + i + 1}</td>
                        <td className="py-2 px-3 font-medium">{row.country}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{formatNumber(row.total_objects)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-green-400">{formatNumber(row.payload_count)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{formatNumber(row.debris_count)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-yellow-400">{formatNumber(row.rocket_body_count)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          <span className={row.debris_ratio > 0.6 ? "text-red-400" : row.debris_ratio > 0.3 ? "text-yellow-400" : "text-green-400"}>
                            {(row.debris_ratio * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-foreground/40">
                    {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} / {sorted.length}
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

              <p className="text-xs text-foreground/40 mt-4">{t("country.note")}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
