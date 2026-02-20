# Orbital Junkyard — Project Summary

> Space Debris Intelligence Platform powered by Databricks + AWS + Next.js

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            DATA SOURCES                                      │
│  CelesTrak API (no auth)  │  Space-Track API (free acct)  │  NOAA SWPC API  │
└─────────┬─────────────────┴──────────────┬────────────────┴────────┬────────┘
          │              GitHub Actions (8h cron)                     │
          ▼                                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AWS S3 — Bronze Layer                                │
│  s3://orbital-junkyard-data/bronze/                                          │
│    celestrak/gp/      spacetrack/{satcat,gp}/      noaa/{solar_wind,kp,xr}/ │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ DLT Auto Loader (cloud_files)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  Databricks — Delta Live Tables Pipeline                      │
│                                                                              │
│  Bronze (6 Streaming Tables)                                                 │
│    → Silver (6 Materialized Views: space_objects, solar_weather, ...)         │
│      → Gold (6 Materialized Views: orbital_census, country_leaderboard, ...) │
│                                                                              │
│  Catalog: orbital_junkyard  │  Schema: main  │  Quality: @dlt.expect         │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ export_gold_to_json.py
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       AWS S3 — Export Layer                                   │
│  s3://orbital-junkyard-data/export/                                          │
│    orbital_census.json  │  country_leaderboard.json  │  decay_tracker.json   │
│    congestion_metrics.json  │  constellation_growth.json  │  storm_impact.json│
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ Next.js API Route → S3 GetObject
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Frontend — Next.js on Vercel                             │
│  3D Globe (CesiumJS)  │  Dashboard (Recharts)  │  i18n (EN/KO)              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. AWS Infrastructure

### S3 Bucket: `orbital-junkyard-data`

| Path | Purpose | Size |
|------|---------|------|
| `bronze/celestrak/gp/` | CelesTrak GP raw JSON (36,000+ objects) | ~15 MB/file |
| `bronze/spacetrack/satcat/` | Space-Track SATCAT catalog (67,672 objects) | ~55 MB |
| `bronze/spacetrack/gp/` | Space-Track GP orbital elements (66,293) | ~50 MB |
| `bronze/noaa/solar_wind/` | Solar wind plasma data (7-day) | ~1 MB |
| `bronze/noaa/kp_index/` | Geomagnetic Kp index | ~0.1 MB |
| `bronze/noaa/xray_flux/` | X-ray flux (GOES satellite) | ~0.5 MB |
| `export/*.json` | Gold table JSON for frontend | ~2-5 MB total |

### IAM Policy (Least Privilege)
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::orbital-junkyard-data", "arn:aws:s3:::orbital-junkyard-data/*"]
}
```

### External Location
- Databricks Unity Catalog External Location configured for `s3://orbital-junkyard-data/`
- Storage Credential with IAM Role trust for Databricks workspace

---

## 2. Databricks — DLT Pipeline

### Medallion Architecture: Bronze → Silver → Gold

All transformations run as a single **Delta Live Tables (DLT) Pipeline**.

#### Bronze (6 Streaming Tables)

Auto Loader (`cloud_files`) detects new JSON files in S3 and ingests them incrementally.

| Table | Source | Records |
|-------|--------|---------|
| `celestrak_gp_raw` | CelesTrak GP API | ~36,000 |
| `spacetrack_satcat_raw` | Space-Track SATCAT | ~67,672 |
| `spacetrack_gp_raw` | Space-Track GP | ~66,293 |
| `noaa_solar_wind_raw` | NOAA solar wind 7-day | ~2,000 |
| `noaa_kp_index_raw` | NOAA Kp index | ~300 |
| `noaa_xray_flux_raw` | NOAA X-ray flux 7-day | ~2,000 |

Key features:
- `cloudFiles.schemaEvolutionMode = "addNewColumns"` — auto-adapt to API changes
- `_ingestion_ts` column on every row for lineage
- `_source_file` tracked via `_metadata.file_path`

#### Silver (6 Materialized Views)

| Table | Logic | Key Feature |
|-------|-------|-------------|
| `space_objects` | JOIN SATCAT + CelesTrak on NORAD_CAT_ID | Derive `orbital_regime` (LEO/MEO/GEO/HEO), `is_active`, `is_debris` |
| `solar_wind_cleaned` | Cast types, filter nulls | Timestamp + numeric cleanup |
| `kp_index_cleaned` | Cast types, rename Kp → kp_value | Data quality: time_tag NOT NULL |
| `xray_flux_cleaned` | Cast types, rename columns | GOES satellite flux normalization |
| `solar_weather` | Full outer JOIN by hourly buckets | Aggregates wind + Kp + X-ray into unified timeline |
| `fragmentation_events` | GROUP BY launch_id prefix | Severity: catastrophic (≥1000), major (≥100), minor (≥10) |

DLT Expectations (data quality):
```python
@dlt.expect("valid_norad_id", "norad_cat_id IS NOT NULL AND norad_cat_id > 0")
@dlt.expect("valid_object_name", "object_name IS NOT NULL")
```

#### Gold (6 Materialized Views)

| Table | Description | Frontend Page |
|-------|-------------|---------------|
| `orbital_census` | Object count by type × regime × country | Dashboard |
| `congestion_metrics` | Density per 50km altitude band | Dashboard (congestion chart) |
| `country_leaderboard` | Country ranking + debris ratio | Countries |
| `constellation_growth` | Starlink/OneWeb/Kuiper tracking | Constellations |
| `decay_tracker` | Low-perigee re-entry candidates | Constellations |
| `storm_impact` | Solar storm ↔ orbital impact | Dashboard (storm table) |

### Pipeline Configuration

```
Pipeline: orbital_junkyard_pipeline
Catalog: orbital_junkyard
Schema: main
Total Tables: 18 (6 Bronze + 6 Silver + 6 Gold)
```

### Delta Lake Features Used

| Feature | Where |
|---------|-------|
| **Auto Loader** | Bronze — S3 new file detection |
| **Streaming Tables** | Bronze — append-only ingestion |
| **Materialized Views** | Silver + Gold — declarative transforms |
| **DLT Expectations** | Silver — data quality gates |
| **Schema Evolution** | Bronze — auto-adapt to API changes |
| **Unity Catalog** | All tables managed under `orbital_junkyard` catalog |

---

## 3. Automation & Scheduling

### Data Collection: GitHub Actions

**File:** `.github/workflows/collect_and_upload.yml`

```
Schedule: 0 0,8,16 * * * (UTC) — every 8 hours
Runner: ubuntu-latest
Timeout: 10 minutes
```

Pipeline:
1. `collect_celestrak.py` — CelesTrak GP (no auth)
2. `collect_spacetrack.py` — Space-Track SATCAT + GP (auth via secrets)
3. `collect_noaa.py` — NOAA solar wind + Kp + X-ray (no auth)
4. `upload_to_s3.py` — Upload all bronze/ → S3

### DLT Pipeline: Databricks Job

```
Schedule: 0 0 10,18,2 * * ? (Asia/Seoul) — 3x daily
Retry: 2 attempts, 5 min interval
```

Tasks (sequential):
1. **DLT Pipeline trigger** — Auto Loader detects new S3 files → Bronze → Silver → Gold
2. **JSON Export** — `export_gold_to_json.py` reads Gold tables → writes JSON → S3 `/export/`

---

## 4. Data Serving: S3 → Frontend

### Export Process

`export_gold_to_json.py` runs in Databricks after DLT completes:
- Reads each Gold table via `spark.table()`
- Converts to JSON with metadata wrapper:
  ```json
  {
    "table": "orbital_census",
    "exported_at": "2025-06-15T10:00:00+00:00",
    "row_count": 843,
    "data": [...]
  }
  ```
- Writes to `s3://orbital-junkyard-data/export/{table_name}.json`
- Creates `metadata.json` with table manifest

### Next.js API Route

**Endpoint:** `GET /api/data/{table}`

- Validates table name against whitelist (7 tables + metadata)
- Fetches from S3 via `@aws-sdk/client-s3` `GetObjectCommand`
- Cache: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200`
- Error: returns 503 when S3 unavailable

---

## 5. Frontend — Next.js Application

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| 3D Globe | CesiumJS 1.138 + Resium |
| Charts | Recharts 3.7 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5 |
| i18n | Custom React Context (EN/KO) |

### Pages

| Route | Description |
|-------|-------------|
| `/` | 3D Globe with 5,000 orbital objects + stats overlay |
| `/dashboard` | Orbital census: pie chart, bar charts, congestion, storm table |
| `/countries` | Country leaderboard: top 15 chart + full table with pagination |
| `/constellations` | Mega-constellation tracker + decay/re-entry table |

### Globe3D Features

- **5,000 point primitives** rendered on CesiumJS globe
- **Color by type:** Green (Payload), Red (Debris), Yellow (Rocket Body), Gray (Unknown)
- **Orbital band rings:** LEO (2,000km), MEO (20,200km), GEO (35,786km) with labels
- **Type filter toggle:** Click legend items to show/hide object types
- **Auto-rotation:** Camera rotates automatically, pauses on user interaction, resumes after 5s idle
- **Hover highlight:** Brightened color + white outline glow on mouse hover
- **Click popup:** Object name, NORAD ID, type, country, altitude

### Performance Optimizations

**CesiumJS:**
- `requestRenderMode = true` — only render on changes
- `maximumScreenSpaceError = 4` — reduced globe detail
- Disabled: fog, skyAtmosphere, groundAtmosphere, lighting, FXAA
- `msaaSamples = 1` — minimal anti-aliasing
- Removed `scaleByDistance` from all points

**React:**
- All chart components loaded with `next/dynamic({ ssr: false })`
- `useMemo` on all data aggregation (dashboard, countries, home)
- Pagination on large tables (20 items/page)
- CLS prevention: `min-h` on all containers matching actual content height

### Internationalization (i18n)

- Custom `LanguageProvider` using React Context + `localStorage`
- `useTranslation()` hook returns `{ t, language, setLanguage }`
- 90+ translation keys covering all 4 pages
- Natural Korean translations (not machine-translated)
- Toggle in Navbar

---

## 6. Sample Data Distribution

The Globe page generates 5,000 sample objects with realistic orbital distribution:

| Orbit | Proportion | Altitude Range | Examples |
|-------|-----------|----------------|----------|
| LEO | 75% | 200–2,000 km | STARLINK, COSMOS DEB, FENGYUN DEB, IRIDIUM |
| MEO | 13% | 19,000–22,000 km | GPS, GLONASS, GALILEO, BEIDOU |
| GEO | 12% | 35,500–36,100 km | INTELSAT, SES, ECHOSTAR, EUTELSAT |

Object type distribution follows real-world patterns:
- LEO: heavy debris (ASAT tests, collisions)
- MEO: mostly payloads (navigation)
- GEO: mix of payloads + old debris

---

## 7. Project File Structure

```
databricks_project/
├── .github/workflows/
│   └── collect_and_upload.yml      # 8h cron: collect → S3 upload
│
├── databricks/
│   ├── collection/
│   │   ├── collect_celestrak.py    # CelesTrak GP API → bronze/
│   │   ├── collect_spacetrack.py   # Space-Track SATCAT+GP → bronze/
│   │   └── collect_noaa.py         # NOAA solar weather → bronze/
│   ├── pipelines/
│   │   ├── 01_bronze_ingestion.py  # DLT Auto Loader → 6 Streaming Tables
│   │   ├── 02_silver_transforms.py # Bronze → 6 Silver Materialized Views
│   │   └── 03_gold_aggregations.py # Silver → 6 Gold Materialized Views
│   └── export/
│       └── export_gold_to_json.py  # Gold → JSON → S3 /export/
│
├── scripts/
│   ├── test_apis.py                # API connection test
│   ├── upload_to_s3.py             # bronze/ → S3 upload
│   └── run_pipeline.py             # Local pipeline orchestrator
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout + LanguageProvider
│   │   │   ├── page.tsx            # Home: Globe3D + StatsOverlay
│   │   │   ├── dashboard/page.tsx  # Charts + tables
│   │   │   ├── countries/page.tsx  # Country leaderboard
│   │   │   ├── constellations/page.tsx  # Constellation + decay
│   │   │   └── api/data/[table]/route.ts  # S3 → JSON API
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Nav + language toggle
│   │   │   ├── Globe3D.tsx         # CesiumJS 3D globe
│   │   │   ├── StatsOverlay.tsx    # Stats overlay on globe
│   │   │   └── charts/
│   │   │       ├── DashboardCharts.tsx
│   │   │       ├── CountryChart.tsx
│   │   │       └── ConstellationChart.tsx
│   │   └── lib/
│   │       ├── types.ts            # TypeScript interfaces
│   │       ├── data.ts             # API fetch utilities
│   │       └── i18n.tsx            # i18n context + translations
│   └── public/cesium/             # CesiumJS static assets
│
├── pyproject.toml
├── .env.example
└── .gitignore
```

---

## 8. Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| AWS S3 | Free Tier (5GB, 12 months) | $0 |
| Databricks | Pay-as-you-go Serverless | ~$5–15 |
| GitHub Actions | Free (2,000 min/month) | $0 |
| Vercel | Hobby (free) | $0 |
| **Total** | | **~$5–15/month** |

---

## 9. Key Interview Talking Points

1. **"Why Databricks?"** — 60,000+ objects require Spark for efficient MERGE upsert. DLT declaratively manages Bronze→Silver→Gold with built-in quality checks. pandas can't handle this at scale.

2. **"Why DLT over manual Spark?"** — Auto Loader handles S3 file detection + checkpointing. `@dlt.expect` embeds data quality. Schema evolution is automatic. ~60% less code than manual Structured Streaming.

3. **"Why not real-time streaming?"** — Space data APIs are batch (CelesTrak updates 3x/day). Triggered pipeline is cost-efficient and realistic. This is the most common enterprise pattern for API-based data sources.

4. **"How does data reach the frontend?"** — Gold tables → JSON export → S3 → Next.js API Route (with 1h cache). Static JSON + CDN = $0 serving cost, <100ms latency, always available.

5. **"Interesting findings?"** — 600-800km altitude is the most congested zone (ASAT tests + collisions). US has most objects but 60%+ are active Starlink. Russia has the worst debris-to-active ratio (Soviet-era legacy).
