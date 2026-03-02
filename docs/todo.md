# Orbital Junkyard — 개선 TODO

## 1. 데이터 소스 정리 — ✅ 완료

- CelesTrak GP 파이프라인 전체 제거 (`collect_celestrak.py`, Bronze `celestrak_gp_raw`)
- Silver `space_objects` 조인 소스를 `spacetrack_gp_raw`로 변경
- 최종 데이터 소스: **Space-Track SATCAT** (메타) + **Space-Track GP** (궤도)

---

## 2. NOAA 우주날씨 파이프라인 제거 — ✅ 완료

- `collect_noaa.py` 삭제
- Bronze 3개 (`noaa_solar_wind_raw`, `noaa_kp_index_raw`, `noaa_xray_flux_raw`) 제거
- Silver 4개 (`solar_wind_cleaned`, `kp_index_cleaned`, `xray_flux_cleaned`, `solar_weather`) 제거
- Gold `storm_impact` 제거
- Export/Frontend에서 storm_impact 관련 코드 전체 제거

### 향후
- GP_History 수집 후 "Kp 급등 구간에서 저궤도 객체의 BSTAR 변화" 같은 진짜 impact 분석을 할 때 다시 도입 검토

---

## 3. 3D 글로브 — 실제 데이터 연동 — ✅ 완료

- `generateSampleObjects()` (Math.random 가짜 데이터) 제거
- Gold `globe_data` 테이블 추가: TLE 데이터 포함 층화 샘플 ~5,000개
- `satellite.js`로 TLE → 실시간 위치(lat/lng/alt) 계산
- 30초 간격 자동 위치 업데이트 (위성 이동 반영)

---

## 4. 파이프라인 추가 작업 (미착수)

- [ ] GP_History 대용량 백필 (1.38억+ 레코드) — Databricks에서 별도 수행

---

## 현재 파이프라인 구조 (개선 후)

```
Bronze (2개):  spacetrack_satcat_raw, spacetrack_gp_raw
Silver (2개):  space_objects, fragmentation_events
Gold   (6개):  orbital_census, congestion_metrics, country_leaderboard,
               constellation_growth, decay_tracker, globe_data
─────────────
총 10개 DLT 테이블 (기존 18개에서 축소)
```
