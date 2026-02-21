"use client";

import { formatNumber, getObjectColor, useIsMobile } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const TOOLTIP_STYLE = { backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "12px" };

export function TypePieChart({ data }: { data: { name: string; value: number }[] }) {
  const mobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          cx="50%" cy="50%" innerRadius={mobile ? 40 : 60} outerRadius={mobile ? 75 : 100} paddingAngle={2}
          label={mobile ? false : ({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={getObjectColor(entry.name)} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatNumber(value as number)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RegimeBarChart({ data }: { data: { regime: string; payload: number; debris: number; rocket_body: number }[] }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <BarChart data={data}>
        <XAxis dataKey="regime" tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} width={mobile ? 40 : 60} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatNumber(value as number)} />
        <Bar dataKey="payload" name={t("dash.payload")} fill="#22c55e" stackId="a" />
        <Bar dataKey="debris" name={t("dash.debris")} fill="#ef4444" stackId="a" />
        <Bar dataKey="rocket_body" name={t("dash.rocket_body")} fill="#eab308" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CongestionBarChart({ data, altLabel }: { data: { altitude_band_km: number; active_count: number; debris_count: number }[]; altLabel: string }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 240 : 300}>
      <BarChart data={data}>
        <XAxis
          dataKey="altitude_band_km"
          tick={{ fill: "#9ca3af", fontSize: mobile ? 9 : 11 }}
          axisLine={{ stroke: "#374151" }}
          label={mobile ? undefined : { value: altLabel, position: "insideBottom", offset: -5, style: { fill: "#6b7280", fontSize: 11 } }}
        />
        <YAxis tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} width={mobile ? 35 : 60} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatNumber(value as number)} />
        <Bar dataKey="active_count" name={t("dash.active")} fill="#22c55e" stackId="a" />
        <Bar dataKey="debris_count" name={t("dash.debris")} fill="#ef4444" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
