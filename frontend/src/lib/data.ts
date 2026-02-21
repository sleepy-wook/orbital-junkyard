import { useState, useEffect } from "react";
import type { TableExport } from "./types";

const API_BASE = "/api/data";

export async function fetchTableData<T>(tableName: string): Promise<TableExport<T>> {
  const res = await fetch(`${API_BASE}/${tableName}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${tableName}: ${res.statusText}`);
  }
  return res.json();
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function getObjectColor(objectType: string): string {
  switch (objectType?.toUpperCase()) {
    case "PAYLOAD":
      return "#22c55e"; // green
    case "DEBRIS":
      return "#ef4444"; // red
    case "ROCKET BODY":
      return "#eab308"; // yellow
    default:
      return "#94a3b8"; // gray
  }
}

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

export function getRegimeLabel(regime: string): string {
  switch (regime) {
    case "LEO":
      return "Low Earth Orbit";
    case "MEO":
      return "Medium Earth Orbit";
    case "GEO":
      return "Geostationary Orbit";
    case "HEO":
      return "Highly Elliptical Orbit";
    default:
      return regime;
  }
}
