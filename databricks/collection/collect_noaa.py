"""NOAA 우주날씨 데이터 수집 스크립트 -- Bronze 적재

NOAA SWPC(Space Weather Prediction Center) API에서 태양풍, Kp 지수,
X-ray 플럭스 데이터를 수집하여 로컬 Bronze 디렉토리에 날짜별로 저장한다.

데이터 소스:
    - URL: https://services.swpc.noaa.gov/
    - 인증: 불필요 (미 정부 공공데이터)
    - Rate Limit: 없음
    - 갱신 주기: 1~5분

수집 대상:
    1. solar_wind: 태양풍 속도 & 밀도 (7일)
    2. kp_index: 지자기 폭풍 지수 (Kp)
    3. xray_flux: X-ray 플럭스 (7일)

Bronze 저장 경로:
    bronze/noaa/solar_wind/YYYY-MM-DD/noaa_solar_wind_YYYYMMDD_HHMMSS.json
    bronze/noaa/kp_index/YYYY-MM-DD/noaa_kp_index_YYYYMMDD_HHMMSS.json
    bronze/noaa/xray_flux/YYYY-MM-DD/noaa_xray_flux_YYYYMMDD_HHMMSS.json
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# 프로젝트 루트 기준 .env 로드
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# 상수
NOAA_BASE_URL = "https://services.swpc.noaa.gov"
BRONZE_DIR = PROJECT_ROOT / "bronze" / "noaa"

# 수집 대상 엔드포인트
ENDPOINTS: dict[str, dict[str, str]] = {
    "solar_wind": {
        "url": f"{NOAA_BASE_URL}/products/solar-wind/plasma-7-day.json",
        "description": "태양풍 속도 & 밀도 (7일)",
    },
    "kp_index": {
        "url": f"{NOAA_BASE_URL}/products/noaa-planetary-k-index.json",
        "description": "지자기 폭풍 Kp 지수",
    },
    "xray_flux": {
        "url": f"{NOAA_BASE_URL}/json/goes/primary/xrays-7-day.json",
        "description": "X-ray 플럭스 (7일)",
    },
}


def fetch_noaa_data(dataset: str) -> list:
    """NOAA API에서 지정 데이터셋을 가져온다.

    Args:
        dataset: 데이터셋 이름 (solar_wind, kp_index, xray_flux)

    Returns:
        레코드 리스트 (첫 행이 헤더인 경우 포함)
    """
    endpoint = ENDPOINTS[dataset]
    logger.info("NOAA API 호출: %s", dataset)

    resp = requests.get(endpoint["url"], timeout=30)
    resp.raise_for_status()

    data = resp.json()
    logger.info("  수신 완료: %d개 레코드", len(data))
    return data


def save_to_bronze(data: list, dataset: str, timestamp: datetime) -> Path:
    """수집된 데이터를 Bronze 디렉토리에 JSON으로 저장한다.

    Args:
        data: 레코드 리스트
        dataset: 데이터셋 이름
        timestamp: 수집 시점 (UTC)

    Returns:
        저장된 파일 경로
    """
    date_str = timestamp.strftime("%Y-%m-%d")
    time_str = timestamp.strftime("%Y%m%d_%H%M%S")

    output_dir = BRONZE_DIR / dataset / date_str
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"noaa_{dataset}_{time_str}.json"
    output_path = output_dir / filename

    payload = {
        "source": "noaa",
        "dataset": dataset,
        "description": ENDPOINTS[dataset]["description"],
        "collected_at": timestamp.isoformat(),
        "record_count": len(data),
        "data": data,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    file_size_kb = output_path.stat().st_size / 1024
    logger.info("  저장 완료: %s (%.1f KB)", output_path, file_size_kb)
    return output_path


def collect() -> dict[str, int]:
    """전체 수집 프로세스를 실행한다.

    Returns:
        데이터셋별 수집 레코드 수
    """
    timestamp = datetime.now(timezone.utc)
    logger.info("=" * 60)
    logger.info("NOAA 우주날씨 데이터 수집 시작 (UTC: %s)", timestamp.isoformat())
    logger.info("=" * 60)

    results: dict[str, int] = {}

    for dataset, info in ENDPOINTS.items():
        try:
            logger.info("[%s] %s 수집 중...", dataset, info["description"])
            data = fetch_noaa_data(dataset)
            save_to_bronze(data, dataset, timestamp)
            results[dataset] = len(data)
        except requests.HTTPError as e:
            logger.error("[%s] HTTP 오류: %s", dataset, e)
            results[dataset] = 0
        except requests.ConnectionError as e:
            logger.error("[%s] 연결 실패: %s", dataset, e)
            results[dataset] = 0
        except Exception as e:
            logger.error("[%s] 예상치 못한 오류: %s", dataset, e)
            results[dataset] = 0

    logger.info("=" * 60)
    logger.info("수집 결과 요약:")
    total = 0
    for dataset, count in results.items():
        status = "OK" if count > 0 else "FAIL"
        logger.info("  [%s] %s: %d개", status, dataset, count)
        total += count
    logger.info("총 수집: %d개 레코드", total)
    logger.info("=" * 60)

    return results


if __name__ == "__main__":
    results = collect()
    if all(count > 0 for count in results.values()):
        sys.exit(0)
    else:
        sys.exit(1)
