"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type Language = "en" | "ko";

const translations: Record<string, { en: string; ko: string }> = {
  // Navbar
  "nav.globe": { en: "Globe", ko: "3D 지구" },
  "nav.dashboard": { en: "Dashboard", ko: "대시보드" },
  "nav.countries": { en: "Countries", ko: "국가별" },
  "nav.constellations": { en: "Constellations", ko: "위성군" },

  // StatsOverlay
  "stats.tracked_objects": { en: "Tracked Objects", ko: "추적 물체 수" },
  "stats.orbiting": { en: "orbiting Earth right now", ko: "지구 궤도를 돌고 있는 물체" },
  "stats.breakdown": { en: "Breakdown", ko: "유형별 현황" },
  "stats.payloads": { en: "Payloads", ko: "위성(활성)" },
  "stats.debris": { en: "Debris", ko: "잔해" },
  "stats.rocket_bodies": { en: "Rocket Bodies", ko: "로켓 잔해" },
  "stats.loading": { en: "Loading...", ko: "불러오는 중..." },
  "stats.updated": { en: "Updated", ko: "최종 업데이트" },

  // Globe3D
  "globe.loading": { en: "Loading 3D Globe...", ko: "3D 지구 불러오는 중..." },
  "globe.object_types": { en: "Object Types", ko: "물체 유형" },
  "globe.payload_active": { en: "Payload (Active)", ko: "위성 (활성)" },
  "globe.debris": { en: "Debris", ko: "잔해" },
  "globe.rocket_body": { en: "Rocket Body", ko: "로켓 잔해" },
  "globe.unknown": { en: "Unknown", ko: "미확인" },
  "globe.norad_id": { en: "NORAD ID:", ko: "NORAD ID:" },
  "globe.type": { en: "Type:", ko: "유형:" },
  "globe.country": { en: "Country:", ko: "국가:" },
  "globe.altitude": { en: "Altitude:", ko: "고도:" },
  "globe.orbital_bands": { en: "Orbital Bands", ko: "궤도 영역" },

  // Dashboard
  "dash.title": { en: "Orbital Census", ko: "궤도 현황" },
  "dash.desc": { en: "Overview of all tracked objects orbiting Earth", ko: "지구 궤도 추적 물체 종합 현황" },
  "dash.total": { en: "Total Objects", ko: "전체" },
  "dash.payloads": { en: "Payloads", ko: "위성" },
  "dash.debris": { en: "Debris", ko: "잔해" },
  "dash.rocket_bodies": { en: "Rocket Bodies", ko: "로켓 잔해" },
  "dash.by_type": { en: "By Object Type", ko: "유형별 분포" },
  "dash.by_regime": { en: "By Orbital Regime", ko: "궤도별 분포" },
  "dash.congestion": { en: "Altitude Congestion (objects per band)", ko: "고도별 혼잡도" },
  "dash.altitude_km": { en: "Altitude (km)", ko: "고도 (km)" },
  "dash.congestion_note": { en: "The 600-800 km band is the most congested zone, dominated by debris from ASAT tests and collisions.", ko: "600-800km 구간이 가장 혼잡하며, 대부분 ASAT 실험 및 충돌 잔해입니다." },
  "dash.storm": { en: "Solar Storm Impact", ko: "태양 폭풍 영향" },
  "dash.storm_level": { en: "Storm Level", ko: "등급" },
  "dash.hours": { en: "Hours", ko: "시간" },
  "dash.avg_wind": { en: "Avg Wind Speed", ko: "평균 태양풍" },
  "dash.max_wind": { en: "Max Wind Speed", ko: "최대 태양풍" },
  "dash.active": { en: "Active", ko: "활성" },
  "dash.payload": { en: "Payload", ko: "위성" },
  "dash.rocket_body": { en: "Rocket Body", ko: "로켓 잔해" },

  // Countries
  "country.title": { en: "Country Leaderboard", ko: "국가별 순위" },
  "country.desc": { en: "Which nations contribute most to orbital congestion?", ko: "궤도 혼잡에 가장 큰 영향을 미치는 국가는?" },
  "country.top15": { en: "Top 15 Countries by Object Count", ko: "물체 수 상위 15개국" },
  "country.detail": { en: "Detailed Breakdown", ko: "전체 목록" },
  "country.country": { en: "Country", ko: "국가" },
  "country.total": { en: "Total", ko: "합계" },
  "country.payloads": { en: "Payloads", ko: "위성" },
  "country.debris": { en: "Debris", ko: "잔해" },
  "country.rb": { en: "R/B", ko: "R/B" },
  "country.debris_pct": { en: "Debris %", ko: "잔해 비율" },
  "country.note": { en: "Debris Ratio = Debris / Total Objects. Higher ratios indicate more historical space waste relative to current active assets.", ko: "잔해 비율이 높을수록 활성 위성 대비 우주 쓰레기가 많다는 뜻입니다." },

  // Constellations
  "const.title": { en: "Mega-Constellations", ko: "대형 위성군" },
  "const.desc": { en: "Tracking the growth of Starlink, OneWeb, and Kuiper", ko: "Starlink, OneWeb, Kuiper 성장 현황" },
  "const.active": { en: "active", ko: "활성" },
  "const.avg_alt": { en: "km avg alt", ko: "km 평균고도" },
  "const.comparison": { en: "Constellation Size Comparison", ko: "위성군 규모 비교" },
  "const.satellites": { en: "Satellites", ko: "위성 수" },
  "const.decay_title": { en: "Decay Tracker", ko: "재진입 예상 물체" },
  "const.decay_desc": { en: "Objects with low perigee that may re-enter Earth's atmosphere", ko: "근지점이 낮아 대기권 재진입이 예상되는 물체 목록" },
  "const.name": { en: "Name", ko: "이름" },
  "const.type": { en: "Type", ko: "유형" },
  "const.country": { en: "Country", ko: "국가" },
  "const.perigee": { en: "Perigee", ko: "근지점" },
  "const.apogee": { en: "Apogee", ko: "원지점" },
  "const.risk": { en: "Risk", ko: "위험도" },
  "const.decay_note": { en: "Objects with perigee below 300 km (highlighted in red) are at higher risk of atmospheric re-entry.", ko: "근지점 300km 미만 물체(빨간색)는 재진입 위험이 높습니다." },

  // Pagination
  "page.prev": { en: "Prev", ko: "이전" },
  "page.next": { en: "Next", ko: "다음" },
  "page.of": { en: "of", ko: "/" },
  "page.showing": { en: "Showing", ko: "" },
  "page.total_suffix": { en: "", ko: "개 중" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Language | null;
    if (saved === "en" || saved === "ko") setLang(saved);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem("lang", lang);
  }, []);

  const t = useCallback(
    (key: string): string => translations[key]?.[language] ?? key,
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
