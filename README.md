# Orbital Junkyard

> Space Debris Intelligence Platform — 36,000+ 우주 물체를 추적하고 분석하는 데이터 엔지니어링 & 시각화 플랫폼

[![Data Pipeline](https://github.com/sleepy-wook/orbital-junkyard/actions/workflows/collect_and_upload.yml/badge.svg)](https://github.com/sleepy-wook/orbital-junkyard/actions/workflows/collect_and_upload.yml)

## Overview

Orbital Junkyard는 지구 궤도의 **인공위성, 우주 파편(debris), 로켓 잔해** 등 36,000개 이상의 물체를 실시간에 가깝게 수집·정제·분석하는 풀스택 데이터 플랫폼입니다.

**핵심 기능:**
- 3개 공공 API(CelesTrak, Space-Track, NOAA)에서 8시간 주기로 데이터 자동 수집
- Databricks Delta Live Tables 기반 Medallion Architecture (Bronze → Silver → Gold)
- CesiumJS 3D 지구본 위에 5,000개 궤도 물체 실시간 시각화
- 국가별 우주 파편 순위, 궤도 혼잡도, 태양 폭풍 영향 분석 대시보드

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Sources                                                       │
│  CelesTrak (36k objects)  ·  Space-Track (SATCAT + GP)  ·  NOAA   │
└──────────┬─────────────────────────────┬────────────────────┬──────┘
           │         GitHub Actions (8h cron)                 │
           ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AWS S3 — Bronze Layer                                              │
│  s3://orbital-junkyard-data/bronze/                                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  DLT Auto Loader
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Databricks — Delta Live Tables Pipeline                            │
│  Bronze (6 Streaming Tables)                                        │
│    → Silver (6 Materialized Views)                                  │
│      → Gold (6 Materialized Views)                                  │
│  Unity Catalog: orbital_junkyard.main                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  export_gold_to_json.py
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AWS S3 — Export Layer (JSON)                                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  Next.js API Route (AWS SDK)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend — Next.js 16 on Vercel                                    │
│  3D Globe (CesiumJS)  ·  Dashboard (Recharts)  ·  i18n (EN/KO)    │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Collection | Python · requests · boto3 · GitHub Actions |
| Storage | AWS S3 |
| Data Lakehouse | Databricks · Delta Lake · Unity Catalog |
| ETL Pipeline | Delta Live Tables (DLT) · PySpark |
| Orchestration | Databricks Workflows · GitHub Actions (cron) |
| Frontend | Next.js 16 · React 19 · TypeScript |
| 3D Visualization | CesiumJS 1.138 · Resium |
| Charts | Recharts |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel (frontend) · Databricks Serverless (compute) |

## Project Structure

```
├── .github/workflows/
│   └── collect_and_upload.yml       # 8h cron: collect → S3 upload
│
├── databricks/
│   ├── collection/
│   │   ├── collect_celestrak.py     # CelesTrak GP API
│   │   ├── collect_spacetrack.py    # Space-Track SATCAT + GP
│   │   └── collect_noaa.py          # NOAA solar weather
│   ├── pipelines/
│   │   ├── 01_bronze_ingestion.py   # Auto Loader → 6 Streaming Tables
│   │   ├── 02_silver_transforms.py  # 6 Silver Materialized Views
│   │   └── 03_gold_aggregations.py  # 6 Gold Materialized Views
│   └── export/
│       └── export_gold_to_json.py   # Gold → JSON → S3
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx             # Home: 3D Globe
│       │   ├── dashboard/           # Analytics dashboard
│       │   ├── countries/           # Country leaderboard
│       │   ├── constellations/      # Constellation tracker
│       │   └── api/data/[table]/    # S3 JSON API route
│       ├── components/
│       │   ├── Globe3D.tsx          # CesiumJS 3D globe
│       │   ├── StatsOverlay.tsx     # Stats overlay
│       │   ├── Navbar.tsx           # Navigation + i18n toggle
│       │   └── charts/             # Recharts components
│       └── lib/
│           ├── types.ts             # TypeScript interfaces
│           ├── data.ts              # API fetch utilities
│           └── i18n.tsx             # EN/KO translations
│
├── scripts/
│   ├── upload_to_s3.py              # bronze/ → S3 upload
│   ├── test_apis.py                 # API connection tests
│   └── run_pipeline.py              # Local pipeline runner
│
├── pyproject.toml
└── .env.example
```

## Data Pipeline

### Medallion Architecture (18 Tables)

**Bronze (6 Streaming Tables)** — Auto Loader로 S3 JSON 자동 수집
| Table | Source | Records |
|-------|--------|---------|
| `celestrak_gp_raw` | CelesTrak GP | ~36,000 |
| `spacetrack_satcat_raw` | Space-Track SATCAT | ~67,672 |
| `spacetrack_gp_raw` | Space-Track GP | ~66,293 |
| `noaa_solar_wind_raw` | NOAA Solar Wind | ~2,000 |
| `noaa_kp_index_raw` | NOAA Kp Index | ~300 |
| `noaa_xray_flux_raw` | NOAA X-ray Flux | ~2,000 |

**Silver (6 Materialized Views)** — 정제, JOIN, 분류
| Table | Description |
|-------|-------------|
| `space_objects` | SATCAT + CelesTrak JOIN → 궤도 분류 (LEO/MEO/GEO/HEO), 활성/파편 구분 |
| `solar_wind_cleaned` | 태양풍 데이터 타입 캐스팅 + null 필터링 |
| `kp_index_cleaned` | 지자기 Kp 지수 정제 |
| `xray_flux_cleaned` | X선 플럭스 정규화 |
| `solar_weather` | 태양풍 + Kp + X선 시간별 통합 |
| `fragmentation_events` | 파편화 이벤트 식별 (catastrophic/major/minor) |

**Gold (6 Materialized Views)** — 분석용 집계
| Table | Description | Frontend Page |
|-------|-------------|---------------|
| `orbital_census` | 타입 × 궤도 × 국가별 물체 수 | Dashboard |
| `congestion_metrics` | 50km 고도 대역별 밀도 | Dashboard |
| `country_leaderboard` | 국가별 순위 + 파편 비율 | Countries |
| `constellation_growth` | Starlink/OneWeb/Kuiper 추적 | Constellations |
| `decay_tracker` | 저궤도 재진입 후보 | Constellations |
| `storm_impact` | 태양 폭풍 ↔ 궤도 영향 상관관계 | Dashboard |

### Data Quality

DLT Expectations로 데이터 품질 보장:
```python
@dlt.expect("valid_norad_id", "norad_cat_id IS NOT NULL AND norad_cat_id > 0")
@dlt.expect("valid_object_name", "object_name IS NOT NULL")
```

## Frontend Pages

### Home — 3D Globe
- CesiumJS 위에 **5,000개** 궤도 물체를 포인트로 렌더링
- 색상 구분: 🟢 Payload · 🔴 Debris · 🟡 Rocket Body · ⚪ Unknown
- 궤도 대역 링: LEO (2,000km) · MEO (20,200km) · GEO (35,786km)
- 클릭 팝업: 이름, NORAD ID, 국가, 고도
- 자동 회전 + 마우스 인터랙션 시 일시정지

### Dashboard
- 궤도 유형별 파이 차트 (Payload/Debris/Rocket Body)
- 궤도 대역별 바 차트 (LEO/MEO/GEO/HEO)
- 고도 혼잡도 히트맵
- 태양 폭풍 영향 테이블

### Countries
- 상위 15개국 바 차트
- 전체 국가 테이블 (페이지네이션)
- 총 물체 수, 활성 비율, 파편 비율

### Constellations
- 대규모 별자리 성장 타임라인 (Starlink, OneWeb, Kuiper)
- 대기권 재진입 후보 테이블

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- AWS 계정 (S3 버킷)
- [Space-Track](https://www.space-track.org/) 계정 (무료)

### 1. Clone & Install

```bash
git clone https://github.com/sleepy-wook/orbital-junkyard.git
cd orbital-junkyard

# Python dependencies
pip install -e .

# Frontend dependencies
cd frontend
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

`.env` 파일에 실제 값을 입력:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=orbital-junkyard-data
AWS_REGION=us-east-1
SPACETRACK_USERNAME=your_email
SPACETRACK_PASSWORD=your_password
```

### 3. Data Collection (Local)

```bash
# API 연결 테스트
python scripts/test_apis.py

# 데이터 수집
python databricks/collection/collect_celestrak.py
python databricks/collection/collect_spacetrack.py
python databricks/collection/collect_noaa.py

# S3 업로드
python scripts/upload_to_s3.py
```

### 4. Run Frontend

```bash
cd frontend
npm run dev
```

`http://localhost:3000`에서 확인 가능.

### 5. Databricks Pipeline

Databricks 워크스페이스에서:
1. `databricks/pipelines/` 의 3개 노트북을 Workspace에 업로드
2. ETL Pipeline (Delta Live Tables) 생성
3. `databricks/export/export_gold_to_json.py` 를 후속 태스크로 추가
4. Workflow Job 스케줄 설정 (예: 3x daily)

## Automation

| Component | Schedule | Tool |
|-----------|----------|------|
| Data Collection + S3 Upload | 매 8시간 (UTC 00/08/16) | GitHub Actions |
| DLT Pipeline (Bronze→Silver→Gold) | 1일 3회 (KST 02/10/18) | Databricks Workflows |
| Gold → JSON Export | DLT 완료 후 자동 | Databricks Job Task |
| Frontend Deploy | git push 시 자동 | Vercel |

## Cost

| Service | Tier | Monthly |
|---------|------|---------|
| AWS S3 | Free Tier | $0 |
| Databricks | Serverless (pay-per-query) | ~$5–15 |
| GitHub Actions | Free (2,000 min/mo) | $0 |
| Vercel | Hobby | $0 |
| **Total** | | **~$5–15** |

## License

This project is for educational and portfolio purposes.

## Author

**sleepy-wook** — [GitHub](https://github.com/sleepy-wook)
