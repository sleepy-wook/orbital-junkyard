"""CelesTrak GP 데이터 수집 스크립트 -- Bronze 적재

CelesTrak API에서 전체 활성 위성 GP(General Perturbations) 데이터를 수집하여
로컬 Bronze 디렉토리에 날짜별로 저장한다.

데이터 소스:
    - URL: https://celestrak.org/NORAD/elements/gp.php
    - 인증: 불필요
    - Rate Limit: 동일 데이터셋 2시간 이내 재요청 금지
    - 갱신 주기: 하루 ~3회
    - 커버리지: 공개 추적 객체 전체 (~36,000+)

Bronze 저장 경로:
    bronze/celestrak/gp/YYYY-MM-DD/celestrak_gp_YYYYMMDD_HHMMSS.json
"""

import json
import logging
import os
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
CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
BRONZE_DIR = PROJECT_ROOT / "bronze" / "celestrak" / "gp"

# 수집 대상 그룹
GROUPS: dict[str, str] = {
    "active": "전체 활성 위성",
    "last-30-days": "최근 30일 신규 객체",
}


def fetch_gp_data(group: str, fmt: str = "json") -> list[dict]:
    """CelesTrak GP API에서 지정 그룹의 데이터를 가져온다.

    Args:
        group: CelesTrak 그룹명 (active, starlink, stations 등)
        fmt: 응답 형식 (json, csv, tle, xml)

    Returns:
        GP 레코드 리스트

    Raises:
        requests.HTTPError: API 응답 오류 시
    """
    params = {"GROUP": group, "FORMAT": fmt}
    logger.info("CelesTrak API 호출: GROUP=%s", group)

    resp = requests.get(CELESTRAK_BASE_URL, params=params, timeout=60)
    resp.raise_for_status()

    data = resp.json()
    logger.info("  수신 완료: %d개 객체", len(data))
    return data


def save_to_bronze(data: list[dict], group: str, timestamp: datetime) -> Path:
    """수집된 데이터를 Bronze 디렉토리에 JSON으로 저장한다.

    Args:
        data: GP 레코드 리스트
        group: 수집 그룹명
        timestamp: 수집 시점 (UTC)

    Returns:
        저장된 파일 경로
    """
    date_str = timestamp.strftime("%Y-%m-%d")
    time_str = timestamp.strftime("%Y%m%d_%H%M%S")

    output_dir = BRONZE_DIR / date_str
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"celestrak_gp_{group}_{time_str}.json"
    output_path = output_dir / filename

    # 메타데이터 포함하여 저장
    payload = {
        "source": "celestrak",
        "group": group,
        "collected_at": timestamp.isoformat(),
        "record_count": len(data),
        "data": data,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("  저장 완료: %s (%.2f MB)", output_path, file_size_mb)
    return output_path


def collect() -> dict[str, int]:
    """전체 수집 프로세스를 실행한다.

    Returns:
        그룹별 수집 레코드 수
    """
    timestamp = datetime.now(timezone.utc)
    logger.info("=" * 60)
    logger.info("CelesTrak 데이터 수집 시작 (UTC: %s)", timestamp.isoformat())
    logger.info("=" * 60)

    results: dict[str, int] = {}

    for group, description in GROUPS.items():
        try:
            logger.info("[%s] %s 수집 중...", group, description)
            data = fetch_gp_data(group)
            save_to_bronze(data, group, timestamp)
            results[group] = len(data)
        except requests.HTTPError as e:
            logger.error("[%s] HTTP 오류: %s", group, e)
            results[group] = 0
        except requests.ConnectionError as e:
            logger.error("[%s] 연결 실패: %s", group, e)
            results[group] = 0
        except Exception as e:
            logger.error("[%s] 예상치 못한 오류: %s", group, e)
            results[group] = 0

    logger.info("=" * 60)
    logger.info("수집 결과 요약:")
    total = 0
    for group, count in results.items():
        status = "OK" if count > 0 else "FAIL"
        logger.info("  [%s] %s: %d개", status, group, count)
        total += count
    logger.info("총 수집: %d개 객체", total)
    logger.info("=" * 60)

    return results


if __name__ == "__main__":
    results = collect()
    if all(count > 0 for count in results.values()):
        sys.exit(0)
    else:
        sys.exit(1)
