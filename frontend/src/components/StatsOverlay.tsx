"use client";

import { formatNumber } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";

interface StatsOverlayProps {
  totalObjects: number;
  payloads: number;
  debris: number;
  rocketBodies: number;
  lastUpdated: string;
  loading?: boolean;
}

export default function StatsOverlay({
  totalObjects,
  payloads,
  debris,
  rocketBodies,
  lastUpdated,
  loading,
}: StatsOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute top-16 left-3 md:top-20 md:left-8 flex flex-col gap-3 md:gap-4 w-52 md:w-72">
      <div className="bg-card/90 backdrop-blur-md border border-card-border rounded-xl p-4 md:p-6">
        <p className="text-xs md:text-sm text-foreground/50 uppercase tracking-wider mb-1 md:mb-2">
          {t("stats.tracked_objects")}
        </p>
        <p className="text-3xl md:text-5xl font-bold tabular-nums text-foreground min-h-[40px] md:min-h-[60px]">
          {loading ? (
            <span className="inline-block w-32 md:w-40 h-9 md:h-12 bg-foreground/10 rounded animate-pulse" />
          ) : (
            formatNumber(totalObjects)
          )}
        </p>
        <p className="text-xs md:text-sm text-foreground/40 mt-1 md:mt-2">{t("stats.orbiting")}</p>
      </div>

      <div className="bg-card/90 backdrop-blur-md border border-card-border rounded-xl p-4 md:p-6 space-y-3 md:space-y-4">
        <p className="text-xs text-foreground/40 uppercase tracking-wider font-medium">
          {t("stats.breakdown")}
        </p>
        {[
          { label: t("stats.payloads"), value: payloads, dotClass: "bg-green-500", textClass: "text-green-400" },
          { label: t("stats.debris"), value: debris, dotClass: "bg-red-500", textClass: "text-red-400" },
          { label: t("stats.rocket_bodies"), value: rocketBodies, dotClass: "bg-yellow-500", textClass: "text-yellow-400" },
        ].map(({ label, value, dotClass, textClass }) => (
          <div key={label} className="flex justify-between items-center">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-2.5 md:w-3 h-2.5 md:h-3 rounded-full ${dotClass}`} />
              <span className="text-xs md:text-sm text-foreground/70">{label}</span>
            </div>
            <span className={`text-sm md:text-lg font-semibold tabular-nums min-h-[24px] md:min-h-[28px] inline-flex items-center ${textClass}`}>
              {loading ? (
                <span className="inline-block w-12 md:w-16 h-4 md:h-5 bg-foreground/10 rounded animate-pulse" />
              ) : (
                formatNumber(value)
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card/90 backdrop-blur-md border border-card-border rounded-xl px-4 md:px-5 py-2 md:py-3">
        <p className="text-xs md:text-sm text-foreground/40">
          {loading ? t("stats.loading") : `${t("stats.updated")}: ${lastUpdated.slice(0, 10)}`}
        </p>
      </div>
    </div>
  );
}
