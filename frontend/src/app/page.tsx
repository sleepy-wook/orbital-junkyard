"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import StatsOverlay from "@/components/StatsOverlay";
import { fetchTableData } from "@/lib/data";
import type { OrbitalCensus, GlobeObject, TableExport } from "@/lib/types";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLong,
  degreesLat,
} from "satellite.js";

const Globe3D = dynamic(() => import("@/components/Globe3D"), { ssr: false });

interface SpaceObjectPoint {
  norad_cat_id: number;
  object_name: string;
  object_type: string;
  country: string;
  lat: number;
  lng: number;
  alt: number;
}

function computePositions(objects: GlobeObject[], date: Date): SpaceObjectPoint[] {
  const gmst = gstime(date);
  const results: SpaceObjectPoint[] = [];

  for (const obj of objects) {
    try {
      const satrec = twoline2satrec(obj.tle_line1, obj.tle_line2);
      const posVel = propagate(satrec, date);
      if (!posVel || typeof posVel.position === "boolean" || !posVel.position) continue;

      const pos = posVel.position;
      const posGd = eciToGeodetic(pos, gmst);
      const lat = degreesLat(posGd.latitude);
      const lng = degreesLong(posGd.longitude);
      const alt = posGd.height;

      if (!isFinite(lat) || !isFinite(lng) || !isFinite(alt)) continue;

      results.push({
        norad_cat_id: obj.norad_cat_id,
        object_name: obj.object_name,
        object_type: obj.object_type,
        country: obj.country,
        lat,
        lng,
        alt,
      });
    } catch {
      // TLE 파싱/전파 실패 시 건너뛰기
    }
  }

  return results;
}

export default function HomePage() {
  const [censusData, setCensusData] = useState<OrbitalCensus[]>([]);
  const [globeObjects, setGlobeObjects] = useState<GlobeObject[]>([]);
  const [positions, setPositions] = useState<SpaceObjectPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const globeObjectsRef = useRef<GlobeObject[]>([]);

  // 데이터 fetch
  useEffect(() => {
    fetchTableData<OrbitalCensus>("orbital_census")
      .then((result: TableExport<OrbitalCensus>) => {
        setCensusData(result.data);
        setLastUpdated(result.exported_at);
      })
      .catch(() => {});

    fetchTableData<GlobeObject>("globe_data")
      .then((result: TableExport<GlobeObject>) => {
        setGlobeObjects(result.data);
        globeObjectsRef.current = result.data;
        // 최초 위치 계산
        setPositions(computePositions(result.data, new Date()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 30초마다 위치 업데이트 (위성 이동 반영)
  useEffect(() => {
    if (globeObjects.length === 0) return;

    const interval = setInterval(() => {
      setPositions(computePositions(globeObjectsRef.current, new Date()));
    }, 30000);

    return () => clearInterval(interval);
  }, [globeObjects.length]);

  const updatePositions = useCallback(() => {
    if (globeObjectsRef.current.length > 0) {
      setPositions(computePositions(globeObjectsRef.current, new Date()));
    }
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
      <Globe3D objects={positions} />
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
