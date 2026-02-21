"use client";

import { formatNumber, useIsMobile } from "@/lib/data";
import { useTranslation } from "@/lib/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface ConstellationRow {
  constellation: string;
  total_objects: number;
}

export function ConstellationBarChart({ data }: { data: ConstellationRow[] }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 160 : 200}>
      <BarChart data={data}>
        <XAxis dataKey="constellation" tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: mobile ? 10 : 12 }} axisLine={{ stroke: "#374151" }} width={mobile ? 40 : 60} />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "12px" }}
          formatter={(value) => formatNumber(value as number)}
        />
        <Bar dataKey="total_objects" name={t("const.satellites")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
