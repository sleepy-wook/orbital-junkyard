"use client";

import { formatNumber, useIsMobile } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface CountryRow {
  country: string;
  total_objects: number;
  payload_count: number;
  debris_count: number;
  rocket_body_count: number;
}

export function CountryBarChart({ data }: { data: CountryRow[] }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 280 : 400}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} />
        <YAxis type="category" dataKey="country" width={mobile ? 40 : 50} tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "12px" }}
          formatter={(value) => formatNumber(value as number)}
        />
        <Bar dataKey="payload_count" name={t("country.payloads")} fill="#22c55e" stackId="a" />
        <Bar dataKey="debris_count" name={t("country.debris")} fill="#ef4444" stackId="a" />
        <Bar dataKey="rocket_body_count" name={t("country.rb")} fill="#eab308" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
