"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import StatsOverlay from "@/components/StatsOverlay";
import { fetchTableData } from "@/lib/data";
import type { OrbitalCensus, TableExport } from "@/lib/types";

const Globe3D = dynamic(() => import("@/components/Globe3D"), { ssr: false });

function generateSampleObjects(count: number) {
  const countries = ["US", "CIS", "PRC", "JPN", "IND", "FR", "UK", "DE"];

  const leoTypes = ["PAYLOAD", "DEBRIS", "DEBRIS", "ROCKET BODY", "DEBRIS"];
  const leoNames = ["STARLINK", "COSMOS DEB", "FENGYUN DEB", "IRIDIUM", "SL-16 R/B", "CZ-6A DEB"];
  const meoNames = ["GPS", "GLONASS", "GALILEO", "BEIDOU"];
  const geoNames = ["INTELSAT", "SES", "ECHOSTAR", "EUTELSAT", "JCSAT"];

  return Array.from({ length: count }, (_, i) => {
    const roll = Math.random();
    let type: string, alt: number, lat: number, name: string;

    if (roll < 0.75) {
      // LEO: 200-2,000km (75%)
      type = leoTypes[i % leoTypes.length];
      alt = type === "PAYLOAD" ? 400 + Math.random() * 1200
        : type === "DEBRIS" ? 500 + Math.random() * 1000
        : 300 + Math.random() * 1500;
      lat = (Math.random() - 0.5) * 160;
      name = `${leoNames[i % leoNames.length]}-${i}`;
    } else if (roll < 0.88) {
      // MEO: 2,000-25,000km (13%)
      type = Math.random() < 0.8 ? "PAYLOAD" : "ROCKET BODY";
      alt = 19000 + Math.random() * 3000;
      lat = (Math.random() - 0.5) * 110;
      name = `${meoNames[i % meoNames.length]}-${i}`;
    } else {
      // GEO: ~35,786km (12%)
      type = Math.random() < 0.7 ? "PAYLOAD" : "DEBRIS";
      alt = 35500 + Math.random() * 600;
      lat = (Math.random() - 0.5) * 6; // GEO는 적도 근처
      name = `${geoNames[i % geoNames.length]}-${i}`;
    }

    return {
      norad_cat_id: 10000 + i,
      object_name: name,
      object_type: type,
      country: countries[i % countries.length],
      lat,
      lng: (Math.random() - 0.5) * 360,
      alt,
    };
  });
}

export default function HomePage() {
  const [censusData, setCensusData] = useState<OrbitalCensus[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [sampleObjects] = useState(() => generateSampleObjects(5000));

  useEffect(() => {
    fetchTableData<OrbitalCensus>("orbital_census")
      .then((result: TableExport<OrbitalCensus>) => {
        setCensusData(result.data);
        setLastUpdated(result.exported_at);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { totalObjects, payloads, debris, rocketBodies } = useMemo(() => {
    let total = 0, pay = 0, deb = 0, rb = 0;
    for (const row of censusData) {
      total += row.object_count;
      if (row.object_type === "PAYLOAD") pay += row.object_count;
      else if (row.object_type === "DEBRIS") deb += row.object_count;
      else if (row.object_type === "ROCKET BODY") rb += row.object_count;
    }
    return { totalObjects: total, payloads: pay, debris: deb, rocketBodies: rb };
  }, [censusData]);

  return (
    <main>
      <Globe3D objects={sampleObjects} />
      <StatsOverlay
        totalObjects={totalObjects}
        payloads={payloads}
        debris={debris}
        rocketBodies={rocketBodies}
        lastUpdated={lastUpdated}
        loading={loading}
      />
    </main>
  );
}
