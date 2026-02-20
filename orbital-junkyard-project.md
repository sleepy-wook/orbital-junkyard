# 🗑️🌍 Orbital Junkyard — 우주 쓰레기 인텔리전스 플랫폼

> "지구 궤도에 36,000개 이상의 물체가 돌고 있다. 대부분은 쓰레기다. 얼마나 심각할까?"

---

## 프로젝트 개요

Orbital Junkyard는 지구 궤도의 모든 추적 가능 객체(활성 위성 + 우주 쓰레기)를 수집·정제·시각화하는 데이터 엔지니어링 플랫폼이다. 3D 지구본에 36,000개 이상의 궤도 객체를 실시간 렌더링하고, 궤도 혼잡도·국가별 기여도·파편화 사건·태양 폭풍 영향 등을 분석한다.

- **타겟 사용자:** 우주에 관심 있는 누구나 + Databricks SE 면접관
- **서비스 언어:** 영어 + 한국어 (i18n)
- **프론트엔드:** 3D 지구본 (CesiumJS) + 2D 분석 대시보드 (React/Next.js)

### 왜 이 프로젝트인가?

1. **시각적 임팩트** — 3D 지구본에 36,000개 객체가 궤도를 도는 모습
2. **시의성** — Starlink 논쟁, Kessler 증후군, 우주 쓰레기 문제는 지금 핫한 토픽
3. **Databricks 풀스택 showcase** — Streaming, Delta Lake MERGE/Time Travel, Medallion, Workflows, Spark SQL 전부 자연스럽게 활용
4. **데이터 풍부** — 무료 API + 36,000+ 현재 객체 + 1억 3,800만+ 이력 레코드
5. **차별화** — Databricks Lakehouse로 이 데이터를 처리한 프로젝트는 없음

---

## 1단계: 클라우드 인프라 셋업 (Claude Code 가이드)

> **이 섹션은 Claude Code가 프로젝트를 시작할 때 가장 먼저 참고해야 하는 부분이다.**
> 각 단계를 순서대로 진행하며, 비용을 최소화하면서도 Databricks의 핵심 기능을 showcase할 수 있는 구성이다.

### 1.1 아키텍처 선택지

| 구성 | 비용 | 장점 | 단점 |
|------|------|------|------|
| **A. Databricks Free Edition + AWS S3** | $0 (무료) | 완전 무료, Workflows 지원, 서버리스 | Unity Catalog/External Location 미지원, S3 마운트 불가 (Volumes 사용) |
| **B. Databricks 14일 Trial (AWS)** | $0 (14일간) | 풀 기능: Unity Catalog, Workflows, SQL Warehouse, External S3 | 14일 제한, AWS 인프라 비용 별도 (소액) |
| **C. Databricks Pay-as-you-go (AWS)** | $5~20/월 예상 | 풀 기능, 시간 제한 없음 | 비용 발생 |

**권장: A로 시작 → 포트폴리오 완성 단계에서 B 또는 C로 전환**

- Free Edition으로 핵심 로직(수집, 변환, MERGE, Spark SQL) 전부 개발 가능
- 포트폴리오 스크린샷이나 데모 녹화할 때만 Trial 사용
- Free Edition은 2025년 6월 출시, Community Edition 대체, 계정 만료 없음

### 1.2 AWS 계정 & S3 버킷 생성

> **Claude Code 실행 전 수동으로 해야 할 것들:**

```
[사전 준비 - 수동 작업]

1. AWS 계정 생성 (이미 있으면 스킵)
   - https://aws.amazon.com/free/
   - Free Tier: S3 5GB 무료 (12개월), 2,000 PUT/20,000 GET 요청 무료/월

2. IAM 사용자 생성 (프로그래밍 접근용)
   - AWS Console → IAM → Users → Create user
   - 이름: orbital-junkyard-bot
   - Access type: Programmatic access
   - Policy: 아래 커스텀 정책 연결

3. S3 버킷 생성
   - 이름: orbital-junkyard-data (또는 원하는 이름)
   - Region: us-east-1 (Databricks와 같은 리전 권장)
   - 나머지 기본값 유지

4. Access Key 저장
   - Access Key ID와 Secret Access Key를 안전하게 보관
   - 절대 Git에 커밋하지 말 것
```

#### IAM 정책 (최소 권한)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::orbital-junkyard-data",
        "arn:aws:s3:::orbital-junkyard-data/*"
      ]
    }
  ]
}
```

#### S3 버킷 구조

```
s3://orbital-junkyard-data/
├── bronze/
│   ├── celestrak/          # CelesTrak raw JSON
│   │   └── gp/YYYY-MM-DD/
│   ├── spacetrack/         # Space-Track raw JSON
│   │   ├── satcat/YYYY-MM-DD/
│   │   └── gp_history/     # 대용량 이력 (파티션별)
│   └── noaa/               # NOAA 우주날씨 raw JSON
│       ├── solar_wind/YYYY-MM-DD/
│       ├── kp_index/YYYY-MM-DD/
│       └── xray_flux/YYYY-MM-DD/
│
├── silver/                 # Delta Lake 테이블 (Databricks 관리)
│   ├── space_objects/
│   ├── orbital_history/
│   ├── solar_weather/
│   └── fragmentation_events/
│
├── gold/                   # 분석용 집계 테이블
│   ├── orbital_census/
│   ├── congestion_metrics/
│   ├── country_leaderboard/
│   ├── constellation_growth/
│   ├── decay_tracker/
│   └── storm_impact/
│
└── export/                 # 프론트엔드용 JSON 내보내기
    ├── globe_objects.json
    ├── census.json
    ├── countries.json
    └── ...
```

### 1.3 Claude Code 첫 번째 작업: 로컬 개발 환경 세팅

```bash
# Claude Code가 실행할 초기 셋업 명령어

# 1. 프로젝트 디렉토리 생성
mkdir -p orbital-junkyard/{databricks/{collection,bronze_to_silver,silver_to_gold,export,quality,workflows},frontend,scripts,docs}

# 2. Python 가상환경
cd orbital-junkyard
python -m venv .venv
source .venv/bin/activate

# 3. 핵심 의존성 설치
pip install \
  requests \
  boto3 \
  python-dotenv \
  pyspark \
  delta-spark \
  schedule

# 4. 환경변수 파일 생성 (.gitignore에 반드시 추가)
cat > .env << 'EOF'
# AWS
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=orbital-junkyard-data
AWS_REGION=us-east-1

# Space-Track
SPACETRACK_USERNAME=your_email_here
SPACETRACK_PASSWORD=your_password_here

# NASA (선택, DEMO_KEY로도 가능)
NASA_API_KEY=DEMO_KEY
EOF

# 5. .gitignore
cat > .gitignore << 'EOF'
.env
.venv/
__pycache__/
*.pyc
.DS_Store
node_modules/
.next/
EOF

# 6. pyproject.toml
cat > pyproject.toml << 'EOF'
[project]
name = "orbital-junkyard"
version = "0.1.0"
description = "Space Debris Intelligence Platform powered by Databricks"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.31.0",
    "boto3>=1.34.0",
    "python-dotenv>=1.0.0",
    "pyspark>=3.5.0",
    "delta-spark>=3.1.0",
    "schedule>=1.2.0",
]
EOF
```

### 1.4 Claude Code 두 번째 작업: API 연결 테스트

```python
# scripts/test_apis.py
# Claude Code가 먼저 실행하여 모든 데이터 소스 접근 가능 여부 확인

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def test_celestrak():
    """CelesTrak: 인증 불필요, JSON 응답 확인"""
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json"
    resp = requests.get(url)
    data = resp.json()
    print(f"✅ CelesTrak: {len(data)}개 우주정거장 객체 수신")
    print(f"   예시: {data[0]['OBJECT_NAME']} (NORAD: {data[0]['NORAD_CAT_ID']})")
    return True

def test_spacetrack():
    """Space-Track: 로그인 → SATCAT 쿼리 테스트"""
    login_url = "https://www.space-track.org/ajaxauth/login"
    query_url = ("https://www.space-track.org/basicspacedata/query"
                 "/class/satcat/NORAD_CAT_ID/25544/format/json")

    username = os.getenv("SPACETRACK_USERNAME")
    password = os.getenv("SPACETRACK_PASSWORD")

    if not username or not password:
        print("⚠️  Space-Track: SPACETRACK_USERNAME/PASSWORD 환경변수 필요")
        print("   https://www.space-track.org/auth/createAccount 에서 무료 가입")
        return False

    session = requests.Session()
    resp = session.post(login_url, data={"identity": username, "password": password})
    if resp.status_code != 200:
        print(f"❌ Space-Track: 로그인 실패 (status {resp.status_code})")
        return False

    resp = session.get(query_url)
    data = resp.json()
    print(f"✅ Space-Track: ISS 데이터 수신")
    print(f"   이름: {data[0]['SATNAME']}, 타입: {data[0]['OBJECT_TYPE']}, 국가: {data[0]['COUNTRY']}")
    return True

def test_noaa():
    """NOAA: 인증 불필요, 태양풍 데이터 확인"""
    url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
    resp = requests.get(url)
    data = resp.json()
    # 첫 행은 헤더
    print(f"✅ NOAA Kp Index: {len(data)-1}개 레코드 수신")
    print(f"   최신: {data[-1]}")
    return True

def test_s3():
    """S3: boto3로 버킷 접근 확인"""
    import boto3
    bucket = os.getenv("AWS_S3_BUCKET")

    if not bucket:
        print("⚠️  S3: AWS_S3_BUCKET 환경변수 필요")
        return False

    try:
        s3 = boto3.client("s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"))
        s3.head_bucket(Bucket=bucket)
        print(f"✅ S3: 버킷 '{bucket}' 접근 성공")
        return True
    except Exception as e:
        print(f"❌ S3: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Orbital Junkyard — API 연결 테스트")
    print("=" * 60)
    results = {}
    results["CelesTrak"] = test_celestrak()
    print()
    results["Space-Track"] = test_spacetrack()
    print()
    results["NOAA"] = test_noaa()
    print()
    results["S3"] = test_s3()
    print()
    print("=" * 60)
    all_ok = all(results.values())
    for name, ok in results.items():
        print(f"  {'✅' if ok else '❌'} {name}")
    print("=" * 60)
    if all_ok:
        print("🚀 모든 연결 성공! Phase 1 개발을 시작할 수 있습니다.")
    else:
        print("⚠️  실패한 항목을 해결한 후 다시 실행하세요.")
```

### 1.5 비용 추정 (월간)

| 항목 | Free Tier 내 | Free Tier 이후 |
|------|------------|--------------|
| **S3 스토리지** | 5GB 무료 | ~$0.023/GB/월 |
| **S3 요청** | PUT 2,000 / GET 20,000 무료 | PUT $0.005/1000, GET $0.0004/1000 |
| **Databricks Free Edition** | 무료 | 무료 |
| **Databricks Trial (14일)** | $0 (DBU 포함) | - |
| **Databricks Pay-as-you-go** | - | Jobs Light: ~$0.07/DBU |
| **Vercel (프론트엔드)** | 무료 | 무료 |
| **예상 합계** | **$0** | **$5~20/월** |

**비용 최적화 팁:**
- Bronze raw JSON은 S3에 저장, Delta Lake 테이블은 Databricks managed storage (Free Edition DBFS 또는 Volumes) 사용
- GP History 138M+ 레코드 전체 로드는 Trial/유료에서만 수행 (Free Edition에서는 최근 5년 샘플)
- 프론트엔드용 JSON export만 S3 → Vercel로 서빙 (CDN, 무료)

---

## 데이터 소스 상세

### Primary: CelesTrak GP Data API

| 항목 | 내용 |
|------|------|
| URL | `https://celestrak.org/NORAD/elements/gp.php` |
| 인증 | 불필요 |
| 형식 | JSON, CSV, TLE, XML |
| Rate Limit | 동일 데이터셋 2시간 이내 재요청 금지 |
| 갱신 주기 | 하루 ~3회 (18 SDS 발행 시) |
| 커버리지 | 공개 추적 객체 전체 (~36,000+) |

**주요 엔드포인트:**
```
# 전체 활성 위성
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json

# Starlink 전체
https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json

# 최근 30일 신규 객체
https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=json

# 이름으로 검색
https://celestrak.org/NORAD/elements/gp.php?NAME=ISS&FORMAT=json
```

**JSON 응답 예시:**
```json
{
  "OBJECT_NAME": "ISS (ZARYA)",
  "OBJECT_ID": "1998-067A",
  "EPOCH": "2024-05-06T19:53:04.999776",
  "MEAN_MOTION": 15.50957674,
  "ECCENTRICITY": 0.000358,
  "INCLINATION": 51.6393,
  "RA_OF_ASC_NODE": 160.4574,
  "ARG_OF_PERICENTER": 140.6673,
  "MEAN_ANOMALY": 205.725,
  "NORAD_CAT_ID": 25544,
  "BSTAR": 0.000183,
  "MEAN_MOTION_DOT": 0.00015698,
  "MEAN_MOTION_DDOT": 0,
  "REV_AT_EPOCH": 45212,
  "CLASSIFICATION_TYPE": "U",
  "ELEMENT_SET_NO": 999,
  "EPHEMERIS_TYPE": 0
}
```

### Primary: Space-Track.org REST API

| 항목 | 내용 |
|------|------|
| URL | `https://www.space-track.org/basicspacedata/query/` |
| 인증 | 무료 계정 필요 (이메일 가입) |
| Rate Limit | 30 req/min, 300 req/hr |
| 주요 클래스 | GP (현재 궤도), GP_History (1억 3,800만+ 이력), SATCAT (카탈로그 메타데이터) |

**SATCAT 객체 타입:** `PAYLOAD` (위성), `ROCKET BODY` (로켓 동체), `DEBRIS` (파편), `UNKNOWN` (미식별)

**주요 쿼리:**
```
# 모든 잔해 객체
/class/satcat/OBJECT_TYPE/DEBRIS/orderby/NORAD_CAT_ID asc/format/json

# SATCAT 전체 (타입, 국가, 발사일, 크기 포함)
/class/satcat/orderby/NORAD_CAT_ID asc/format/json

# 중국 ASAT 시험 (Fengyun-1C) 잔해 전체
/class/gp/OBJECT_ID/~~1999-025/format/json

# 특정 객체의 궤도 이력
/class/gp_history/NORAD_CAT_ID/25544/orderby/EPOCH asc/format/json
```

**SATCAT 응답 예시:**
```json
{
  "NORAD_CAT_ID": "25544",
  "OBJECT_TYPE": "PAYLOAD",
  "SATNAME": "ISS (ZARYA)",
  "COUNTRY": "ISS",
  "LAUNCH": "1998-11-20",
  "DECAY": null,
  "PERIOD": "92.87",
  "INCLINATION": "51.64",
  "APOGEE": "422",
  "PERIGEE": "418",
  "RCS_SIZE": "LARGE",
  "CURRENT": "Y",
  "OBJECT_ID": "1998-067A"
}
```

### Secondary: NOAA 우주날씨 API

| 항목 | 내용 |
|------|------|
| URL | `https://services.swpc.noaa.gov/` |
| 인증 | 불필요 |
| Rate Limit | 없음 (미 정부 공공데이터) |
| 갱신 주기 | 1~5분 |

**주요 엔드포인트:**
```
# 태양풍 속도 & 밀도 (7일)
https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json

# 지자기 폭풍 지수 (Kp)
https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json

# 태양 플레어 (X-ray flux, 7일)
https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json

# 우주날씨 경보
https://services.swpc.noaa.gov/products/alerts.json

# 오로라 예보 (30분)
https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
```

### Supplementary: UCS 위성 데이터베이스

| 항목 | 내용 |
|------|------|
| URL | `https://www.ucsusa.org/resources/satellite-database` |
| 형식 | Excel 다운로드 (분기별 갱신) |
| 커버리지 | ~7,500+ 활성 위성 상세 정보 |
| 주요 필드 | 운영자, 용도, 궤도 분류, 발사 질량, 예상 수명, 제작사, 발사체 |
| 용도 | 활성 위성 데이터에 운영자/목적 정보 enrichment |

---

## Databricks Medallion 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        데이터 소스                               │
│  CelesTrak API  │  Space-Track API  │  NOAA API  │  UCS Excel  │
└────────┬────────┴────────┬──────────┴─────┬──────┴──────┬──────┘
         │                 │                │             │
         ▼                 ▼                ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BRONZE (원시 데이터 적재)                     │
│                                                                 │
│  celestrak_gp_raw     CelesTrak GP API 원시 JSON                │
│  spacetrack_satcat    SATCAT 카탈로그 원시 데이터                  │
│  spacetrack_gp_hist   GP History (배치, 1.38억+ 레코드)           │
│  noaa_solar_wind      태양풍 원시 데이터                          │
│  noaa_kp_index        지자기 Kp 지수 원시 데이터                   │
│  noaa_xray_flux       X-ray 플럭스 원시 데이터                    │
│  ucs_satellite_db     UCS 위성 DB 원시 데이터                     │
│                                                                 │
│  형식: Delta Lake, append-only, 수집 타임스탬프 포함              │
│  파티션: ingestion_date                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SILVER (정제 & 통합)                           │
│                                                                 │
│  space_objects         중복 제거, 타입 분류, 통합 객체 테이블       │
│    - MERGE ON norad_cat_id (수집 시 upsert)                     │
│    - 조인: SATCAT 메타 + CelesTrak 궤도 요소                     │
│    - 파생: apogee, perigee, orbital_regime (LEO/MEO/GEO/HEO)   │
│    - 파생: is_active, is_debris, object_category                │
│    - enrichment: UCS 운영자/목적 데이터 (활성 위성)               │
│                                                                 │
│  orbital_history       궤도 요소 변화 시계열                      │
│    - GP_History (배치) + 일일 CelesTrak diff                     │
│    - 고도 변화, 감쇠 추세 추적                                    │
│    - 파티션: year, month                                        │
│                                                                 │
│  solar_weather         태양 활동 통합 시계열                      │
│    - Kp 지수, X-ray 플럭스, 태양풍 통합                          │
│    - 파티션: date                                               │
│                                                                 │
│  fragmentation_events  알려진 파편화/충돌 사건                    │
│    - SATCAT의 INTLDES 접두사로 그룹핑                            │
│    - ASAT 시험, 폭발, 충돌 사건                                  │
│                                                                 │
│  형식: Delta Lake, SCD Type 2 (해당 시)                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOLD (분석 준비 완료)                           │
│                                                                 │
│  orbital_census        일일 스냅샷: 타입/궤도/국가별 객체 수       │
│  congestion_metrics    고도 밴드별 밀도, 혼잡도 분석               │
│  country_leaderboard   국가별 순위: 활성 vs 잔해 비율              │
│  constellation_growth  Starlink/OneWeb/Kuiper 성장 추적          │
│  decay_tracker         감쇠 중 객체 추적 (재진입 후보)             │
│  storm_impact          태양 폭풍 ↔ 궤도 영향 상관분석             │
│                                                                 │
│  형식: Delta Lake, 사전 집계, ZORDER 최적화                      │
└─────────────────────────────────────────────────────────────────┘
```

### Delta Lake 기능 활용 매핑

| 기능 | 활용 |
|------|------|
| **MERGE (Upsert)** | `space_objects`: NORAD_CAT_ID 기준 upsert — 궤도 요소 갱신, 신규 삽입, 감쇠 플래그 |
| **Time Travel** | "6개월 전 궤도 현황 vs 지금" — `VERSION AS OF` / `TIMESTAMP AS OF` |
| **CDC (Change Data Feed)** | 객체 상태 변경 추적: 활성→잔해, 궤도 변경, 감쇠 |
| **Schema Evolution** | API 응답 변경 시 graceful 처리 |
| **OPTIMIZE + ZORDER** | `orbital_regime`, `object_type`, `country` 기준 최적화 |
| **파티셔닝** | Bronze: `ingestion_date`, Silver 이력: `year/month`, Gold: `snapshot_date` |

### Delta Live Tables (DLT) 파이프라인 전략

Bronze → Silver → Gold 전체 변환을 **DLT 파이프라인**으로 구현한다.
CelesTrak/Space-Track은 WebSocket을 제공하지 않으므로, 현실적인 아키텍처를 사용:

```
데이터 흐름:
  로컬 수집 스크립트 (8시간마다 cron/스케줄러)
    → S3에 JSON 업로드 (bronze/ 경로)
      → DLT Auto Loader가 신규 파일 자동 감지
        → Bronze (Streaming Tables, append-only)
          → Silver (Materialized Views, 정제/MERGE)
            → Gold (Materialized Views, 집계)

DLT를 선택한 이유:
1. Auto Loader 내장 — S3 신규 파일 자동 감지, 체크포인트 관리 불필요
2. 선언적 파이프라인 — @dlt.table 데코레이터로 의존성 자동 추론
3. 데이터 품질 내장 — @dlt.expect로 expectations 선언 (별도 검증 코드 불필요)
4. 자동 스키마 관리 — Schema Evolution 자동 처리
5. 모니터링 UI — 파이프라인 DAG, 데이터 품질 메트릭 시각화

면접 포인트:
  "왜 DLT인가?" → Auto Loader + Expectations + 선언적 ETL을 하나의 프레임워크로.
  "왜 진짜 스트리밍이 아닌가?" → 우주 데이터 API는 배치. triggered 파이프라인이
  현실적이고 비용 효율적. 실제 기업 환경의 가장 흔한 패턴.
```

### 오케스트레이션 (DLT Pipeline + Workflow)

```
┌─────────────────────────────────────────────────────────────┐
│              orbital_junkyard_workflow                       │
│                                                             │
│  Task 1: 데이터 수집 (로컬 → S3)                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ collect_  │  │ collect_  │  │ collect_  │               │
│  │ celestrak │  │ spacetrack│  │ noaa      │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│        └───────┬───────┘──────────────┘                     │
│                ▼                                             │
│  Task 2: S3 업로드                                           │
│  ┌─────────────────┐                                        │
│  │ upload_to_s3.py │                                        │
│  └────────┬────────┘                                        │
│           ▼                                                  │
│  Task 3: DLT 파이프라인 트리거                                │
│  ┌─────────────────────────────────────────┐                │
│  │  orbital_junkyard_dlt_pipeline          │                │
│  │                                         │                │
│  │  Bronze (Auto Loader, Streaming Tables) │                │
│  │    → Silver (Materialized Views, MERGE) │                │
│  │      → Gold (Materialized Views, 집계)  │                │
│  │                                         │                │
│  │  데이터 품질: @dlt.expect 내장           │                │
│  └────────┬────────────────────────────────┘                │
│           ▼                                                  │
│  Task 4: JSON export → S3 (프론트엔드용)                     │
│  ┌─────────────────┐                                        │
│  │ export_to_json  │                                        │
│  └─────────────────┘                                        │
│                                                             │
│  스케줄: 8시간마다 (Space-Track 갱신 주기에 맞춤)             │
│  재시도: 2회, 5분 간격                                       │
│  알림: 실패 시 이메일                                        │
└─────────────────────────────────────────────────────────────┘

별도 Workflows:
- gp_history_backfill: 1회성 이력 대용량 로드 (1.38억+ 레코드)
```

---

## 기술 스택

### 백엔드 (데이터 엔지니어링)

| 구성요소 | 기술 |
|---------|------|
| 컴퓨팅 | Databricks Pay-as-you-go (Serverless) |
| 스토리지 | Delta Lake on S3 (Unity Catalog 관리) |
| 처리 | Apache Spark (PySpark) |
| ETL 파이프라인 | **Delta Live Tables (DLT)** — 선언적 ETL 프레임워크 |
| 수집 | DLT Auto Loader (`cloud_files`) — S3 신규 파일 자동 감지 |
| 오케스트레이션 | Databricks Workflows (수집 → DLT 트리거 → export) |
| 데이터 품질 | DLT Expectations (`@dlt.expect`) |
| 카탈로그 | Unity Catalog (`orbital_junkyard.bronze/silver/gold`) |
| 언어 | Python |

### 프론트엔드 (시각화)

| 구성요소 | 기술 |
|---------|------|
| 3D 지구본 | CesiumJS (오픈소스, 위성 궤도 시각화 특화) |
| 2D 대시보드 | React + Recharts / D3.js |
| 프레임워크 | Next.js (SSR + API routes) |
| 다국어 | next-intl (영어 + 한국어) |
| 스타일 | Tailwind CSS |
| 호스팅 | Vercel (무료) |

### 데이터 서빙 (Databricks → 프론트엔드)

**권장: 정적 JSON Export 방식**

DLT 파이프라인 완료 후 Workflow 태스크가 Gold 테이블 → JSON 파일로 변환 → S3 업로드 → Vercel에서 서빙

이유:
- 우주 쓰레기 데이터는 8시간 주기 갱신이면 충분 (초단위 실시간 불필요)
- 정적 JSON + CDN = 비용 $0, 지연 최소, 항상 가용
- 면접에서 "왜 이 아키텍처를 선택했는지" 설명 가능 (비용 vs 지연 트레이드오프)

---

## 기능 & 사용 시나리오

### 🌍 3D 지구본 뷰 (랜딩 페이지)
- 36,000+ 추적 객체를 CesiumJS 지구본에 렌더링
- 색상 구분: 🟢 활성 위성, 🔴 잔해, 🟡 로켓 동체, ⚪ 미식별
- 클릭 → 팝업: 이름, 타입, 국가, 궤도 상세
- 필터: 객체 타입, 국가, 별자리, 고도 범위
- 타임 슬라이더: "2000년 vs 2025년 궤도 혼잡도 비교"

### 📊 궤도 센서스 대시보드
- 총 객체 수 (실시간 카운터 + 이력 스파크라인)
- 타입별: Payload vs Debris vs Rocket Body
- 궤도별: LEO / MEO / GEO / HEO
- 연도별 성장 차트 (1957년 → 현재)

### 🏆 국가별 리더보드
- "어떤 나라가 우주 쓰레기를 가장 많이 만들었나?"
- 토글: 전체 객체 / 잔해만 / 잔해-대-활성 비율
- 인사이트: "미국은 10,000+ 객체지만 60%는 활성 Starlink. 러시아는 4,000+지만 80%가 소련 시대 잔해."

### 🛰️ 대형 별자리 트래커
- Starlink, OneWeb, Kuiper: 발사 타임라인, 현재 수, 목표 수
- Shell 충전율: "Starlink 550km 쉘은 78% 차있음"
- 성장 예측: "현재 발사 속도로 2030년에 궤도 객체 100,000개?"

### 💥 파편화 사건 타임라인
- 알려진 파편화 사건 인터랙티브 타임라인
- 중국 ASAT (2007): 3,500+ 파편, 대부분 궤도 잔류
- 러시아 ASAT (2021): 1,500+ 파편, Kosmos-1408
- Iridium-Cosmos 충돌 (2009): 최초 우발적 초고속 충돌

### 📉 고도 밀도 히트맵
- X축: 고도 (0~40,000km), Y축: 시간 또는 경사각
- 색상: km 밴드당 객체 밀도
- "780~850km 고도가 가장 위험한 구간" 시각화

### ☀️ 태양 폭풍 영향 분석
- 상관관계: Kp 지수 급등 → 대기 항력 → 고도 하락
- 사례 연구: 2024년 5월 태양 폭풍 → Starlink 고도 변화
- "G4 폭풍은 잔해 감쇠를 얼마나 가속하는가?"

### ⏳ 감쇠 트래커
- 고도가 낮아지고 있는 객체 (재진입 후보)
- 고도 추세선
- "이 50개 객체는 6개월 내 재진입 가능성 높음"

---

## 프로젝트 구조

```
orbital-junkyard/
├── README.md
├── pyproject.toml
├── .env                           # Git에 커밋하지 않음
├── .env.example
├── .gitignore
│
├── docs/
│   └── architecture.md
│
├── databricks/                    # Databricks 관련 코드
│   ├── collection/                # 로컬 수집 스크립트 (S3 업로드용)
│   │   ├── collect_celestrak.py
│   │   ├── collect_spacetrack.py
│   │   └── collect_noaa.py
│   │
│   ├── pipelines/                 # DLT 파이프라인 노트북 (Databricks에서 실행)
│   │   ├── 01_bronze_ingestion.py     # Auto Loader → Bronze Streaming Tables
│   │   ├── 02_silver_transforms.py    # Bronze → Silver Materialized Views
│   │   └── 03_gold_aggregations.py    # Silver → Gold Materialized Views
│   │
│   └── export/                    # Gold → JSON (프론트엔드용)
│       └── export_gold_to_json.py
│
├── frontend/                      # Next.js 웹 애플리케이션
│   ├── package.json
│   ├── next.config.js
│   ├── public/
│   │   └── data/                  # Databricks에서 export한 정적 JSON
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/
│   │   │   │   ├── page.tsx       # 랜딩 (3D 지구본)
│   │   │   │   ├── dashboard/
│   │   │   │   ├── countries/
│   │   │   │   ├── constellations/
│   │   │   │   ├── events/
│   │   │   │   └── decay/
│   │   │   └── api/
│   │   ├── components/
│   │   │   ├── Globe3D.tsx
│   │   │   ├── OrbitalCensus.tsx
│   │   │   ├── CountryLeaderboard.tsx
│   │   │   ├── AltitudeHeatmap.tsx
│   │   │   ├── FragmentationTimeline.tsx
│   │   │   └── LanguageToggle.tsx
│   │   ├── i18n/
│   │   │   ├── en.json
│   │   │   └── ko.json
│   │   └── lib/
│   │       └── data.ts
│   └── tailwind.config.js
│
└── scripts/                       # 로컬 유틸리티
    ├── test_apis.py
    └── upload_to_s3.py
```

---

## 구현 단계

### Phase 1: 데이터 수집 + S3 적재 (완료)

**목표:** 로컬 수집 → S3 업로드, Databricks 연결 확인

- [x] Databricks Pay-as-you-go 가입 + Unity Catalog 설정
- [x] AWS S3 버킷 생성 + IAM Role + Storage Credential + External Location
- [x] `scripts/test_apis.py` 실행하여 모든 API 연결 확인
- [x] `collect_celestrak.py` — GP 전체 데이터 JSON 수집 (14,368 + 196 객체)
- [x] `collect_spacetrack.py` — SATCAT (67,672) + GP (66,293) 수집
- [x] `collect_noaa.py` — 태양날씨 3종 수집 (solar_wind, kp_index, xray_flux)
- [x] `upload_to_s3.py` — 7개 파일 S3 업로드 완료 (121.36 MB)
- [x] Databricks에서 S3 읽기 확인 (External Location)
- [x] Unity Catalog: `orbital_junkyard` 카탈로그 + bronze/silver/gold 스키마 생성

### Phase 2: DLT 파이프라인 구축 (완료)

**목표:** DLT로 Bronze → Silver → Gold 전체 파이프라인 구현

- [x] DLT 파이프라인 노트북 작성
  - `01_bronze_ingestion.py` — Auto Loader로 S3 JSON → Bronze Streaming Tables (6개 테이블)
  - `02_silver_transforms.py` — Bronze → Silver Materialized Views (6개 테이블)
  - `03_gold_aggregations.py` — Silver → Gold 집계 Materialized Views (6개 테이블)
- [x] DLT Pipeline 생성 (`orbital_junkyard_pipeline`, 카탈로그: `orbital_junkyard`, 스키마: `main`)
- [x] 데이터 품질 Expectations 설정 (`@dlt.expect`)
- [x] Silver 테이블 검증 — space_objects, solar_weather, fragmentation_events 등 6개
- [x] Gold 테이블 검증 — orbital_census, congestion_metrics 등 6개 (총 18개 테이블)
- [x] Export 노트북: `export_gold_to_json.py` — Gold → JSON → S3 (`s3://orbital-junkyard-data/export/`)

### Phase 3: 자동화 + Workflow (완료)

**목표:** 전체 파이프라인 자동 실행

- [x] GitHub Actions 워크플로우: 8시간마다 데이터 수집 + S3 업로드 (`.github/workflows/collect_and_upload.yml`)
- [x] Databricks Job: DLT 파이프라인 스케줄 실행 (Quartz cron: `0 0 10,18,2 * * ?` Asia/Seoul)
- [x] Export 자동화: Databricks Job에 JSON export 태스크 추가 (DLT 완료 후 실행)
- [ ] Delta Lake Time Travel 데모 노트북 (선택)

### Phase 4: 프론트엔드 — 3D 지구본 + 대시보드 (현재)

**목표:** Next.js + CesiumJS로 시각적 임팩트의 웹 애플리케이션

**데이터 흐름:** Gold 테이블 → JSON export → S3 (`/export/`) → Next.js API Routes → 프론트엔드 렌더링

- [ ] JSON export 자동화 설정 (Databricks Job에 export 태스크 추가)
- [ ] S3 export/ 경로 퍼블릭 읽기 설정 (또는 Next.js API Routes에서 AWS SDK로 fetch)
- [ ] Next.js + CesiumJS 프로젝트 셋업
- [ ] export JSON으로 36,000+ 객체 3D 렌더링
- [ ] 객체 타입별 색상 구분
- [ ] 클릭 → 상세 팝업
- [ ] 필터 (타입, 국가, 고도)
- [ ] 궤도 센서스 대시보드
- [ ] 국가별 리더보드
- [ ] 별자리 성장 트래커
- [ ] i18n (영어/한국어 토글)
- [ ] 반응형 (데스크톱 + 모바일)
- [ ] Vercel 배포

### Phase 5: 마무리 & 문서화

**목표:** 포트폴리오 완성

- [ ] README: 아키텍처 다이어그램, 스크린샷, 데모 링크
- [ ] Databricks 노트북 문서화 (마크다운 셀로 각 단계 설명)
- [ ] 성능 최적화 (ZORDER, 캐싱, 쿼리 튜닝)
- [ ] 데모 영상 / 워크스루
- [ ] 블로그 포스트 (선택, LinkedIn용)

---

## 데이터 볼륨 추정

| 테이블 | 레코드 | 크기 | 성장 |
|--------|--------|------|------|
| Bronze (CelesTrak raw) | ~36K/수집 × 3/일 | ~50MB/일 | 선형 |
| Bronze (SATCAT) | ~60K 전체 | ~30MB | 느림 |
| Bronze (GP History) | 1.38억+ | ~50GB+ | 1회 백필 |
| Bronze (NOAA) | ~2K 레코드/일 | ~1MB/일 | 선형 |
| Silver (space_objects) | ~60K 행 | ~30MB | 느림 (MERGE) |
| Silver (orbital_history) | 1.38억+ | ~50GB+ | 백필 + 일일 |
| Gold (전체 집계) | ~100K 행 | ~50MB | 일일 스냅샷 |
| Export JSON (프론트엔드) | ~10개 파일 | ~20MB | 갱신 시 |

**참고:** GP History 백필 (1.38억+)이 "빅데이터" showcase 핵심. 이건 pandas로 불가능하며, Spark의 분산 처리가 필요한 이유를 보여준다.

---

## 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| Space-Track 계정 거부 | CelesTrak만으로 대체 가능 (인증 불필요). SATCAT 일부 정보는 CelesTrak GROUP 쿼리로 재구성 |
| CelesTrak Rate Limit | 2시간 폴링 간격 준수, 캐시 적극 활용, Space-Track을 주 데이터소스로 |
| Databricks Free Edition 제약 | Free Edition 제약 내에서 설계, 풀 워크스페이스 확장 방법 문서화 |
| CesiumJS 36K 객체 성능 | 포인트 프리미티브 사용 (3D 모델 X), LOD, 원거리 객체 클러스터링 |
| GP History 대용량 | Free Edition에서는 최근 5년 샘플, 풀 백필 프로세스는 별도 문서화 |

---

## 면접 대화 포인트

Databricks SE 면접에서 이 프로젝트를 설명할 때:

1. **"왜 Databricks가 필요한가?"**
   → 1.38억+ 이력 레코드는 Spark 없으면 처리 불가. 6만 객체에 대한 일일 MERGE upsert는 Delta Lake의 핵심 기능. DLT 파이프라인으로 Bronze→Silver→Gold 전체를 선언적으로 관리. pandas로는 불가능한 규모.

2. **"왜 DLT를 선택했는가?"**
   → Auto Loader로 S3 신규 파일 자동 감지, @dlt.expect로 데이터 품질 내장, 선언적 파이프라인으로 의존성 자동 관리. 수동 Spark 코딩 대비 코드량 60% 감소하면서도 모니터링·품질·스키마 진화를 프레임워크가 처리.

3. **"Medallion 아키텍처를 설명해달라"**
   → Bronze는 DLT Streaming Tables로 S3 raw JSON append-only 수집. Silver는 Materialized Views로 MERGE upsert + enrichment. Gold는 Materialized Views로 사전 집계 + ZORDER 최적화.

4. **"스트리밍은 어떻게 동작하는가?"**
   → 솔직한 답변: 우주 데이터 API는 배치임. 로컬 스크립트가 8시간마다 S3에 JSON을 적재하면, DLT Auto Loader가 신규 파일을 감지하여 incremental 처리. 실제 기업 환경의 가장 흔한 "API 기반 near-real-time" 패턴.

5. **"가장 흥미로운 발견은?"**
   → "780~850km 고도가 가장 혼잡한 구간. 여기서 하나의 충돌이 연쇄 반응을 일으킬 수 있음 (Kessler 증후군). 미국은 객체 수 최다지만 대부분 활성 Starlink. 러시아는 잔해-대-활성 비율이 최악 (소련 시대 유산)."

6. **"어떻게 확장하겠는가?"**
   → Unity Catalog로 거버넌스, Photon으로 쿼리 가속, Delta Sharing으로 데이터 마켓플레이스 (위성 운영자 구독 모델), MLflow로 충돌 확률 모델.