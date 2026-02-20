"""Space-Track 데이터 수집 스크립트 -- Bronze 적재

Space-Track REST API에서 SATCAT(카탈로그 메타데이터)과 GP(현재 궤도 요소)를
수집하여 로컬 Bronze 디렉토리에 날짜별로 저장한다.

데이터 소스:
    - URL: https://www.space-track.org/basicspacedata/query/
    - 인증: 무료 계정 필요 (이메일 가입)
    - Rate Limit: 30 req/min, 300 req/hr
    - 주요 클래스: SATCAT (~60,000 객체), GP (현재 궤도)

Bronze 저장 경로:
    bronze/spacetrack/satcat/YYYY-MM-DD/spacetrack_satcat_YYYYMMDD_HHMMSS.json
    bronze/spacetrack/gp/YYYY-MM-DD/spacetrack_gp_YYYYMMDD_HHMMSS.json

참고:
    GP_History (1.38억+ 레코드)는 Phase 1에서는 수집하지 않는다.
    대용량 백필은 Databricks에서 별도 수행 예정.
"""

import json
import logging
import os
import sys
import time
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
BASE_URL = "https://www.space-track.org"
LOGIN_URL = f"{BASE_URL}/ajaxauth/login"
QUERY_URL = f"{BASE_URL}/basicspacedata/query"
BRONZE_DIR = PROJECT_ROOT / "bronze" / "spacetrack"

# Rate limit: 30 req/min -> 최소 2초 간격
REQUEST_INTERVAL = 2.0


class SpaceTrackClient:
    """Space-Track API 세션 관리 클라이언트."""

    def __init__(self, username: str, password: str) -> None:
        self.session = requests.Session()
        self.username = username
        self.password = password
        self._last_request_time: float = 0.0

    def login(self) -> None:
        """Space-Track에 로그인한다."""
        logger.info("Space-Track 로그인 중...")
        resp = self.session.post(
            LOGIN_URL,
            data={"identity": self.username, "password": self.password},
            timeout=30,
        )

        if resp.status_code != 200 or "Login Failed" in resp.text:
            raise RuntimeError(f"Space-Track 로그인 실패: status={resp.status_code}")

        logger.info("로그인 성공")

    def _rate_limit_wait(self) -> None:
        """Rate limit 준수를 위한 대기."""
        elapsed = time.time() - self._last_request_time
        if elapsed < REQUEST_INTERVAL:
            wait = REQUEST_INTERVAL - elapsed
            logger.debug("Rate limit 대기: %.1f초", wait)
            time.sleep(wait)

    def query(self, class_name: str, params: str = "", limit: int = 0) -> list[dict]:
        """Space-Track API 쿼리를 실행한다.

        Args:
            class_name: 데이터 클래스 (satcat, gp, gp_history 등)
            params: 추가 쿼리 파라미터 (예: /OBJECT_TYPE/DEBRIS)
            limit: 결과 제한 (0이면 전체)

        Returns:
            레코드 리스트
        """
        self._rate_limit_wait()

        url = f"{QUERY_URL}/class/{class_name}"
        if params:
            url += params
        url += "/orderby/NORAD_CAT_ID asc/format/json"
        if limit > 0:
            url += f"/limit/{limit}"

        logger.info("쿼리 실행: class=%s", class_name)
        resp = self.session.get(url, timeout=120)
        self._last_request_time = time.time()

        resp.raise_for_status()

        data = resp.json()
        logger.info("  수신 완료: %d개 레코드", len(data))
        return data


def save_to_bronze(data: list[dict], dataset: str, timestamp: datetime) -> Path:
    """수집된 데이터를 Bronze 디렉토리에 JSON으로 저장한다.

    Args:
        data: 레코드 리스트
        dataset: 데이터셋 이름 (satcat, gp)
        timestamp: 수집 시점 (UTC)

    Returns:
        저장된 파일 경로
    """
    date_str = timestamp.strftime("%Y-%m-%d")
    time_str = timestamp.strftime("%Y%m%d_%H%M%S")

    output_dir = BRONZE_DIR / dataset / date_str
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"spacetrack_{dataset}_{time_str}.json"
    output_path = output_dir / filename

    payload = {
        "source": "spacetrack",
        "dataset": dataset,
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

    수집 대상:
        1. SATCAT: 전체 카탈로그 메타데이터 (~60,000 객체)
        2. GP: 현재 궤도 요소 (활성 + 잔해 전체)

    Returns:
        데이터셋별 수집 레코드 수
    """
    username = os.getenv("SPACETRACK_USERNAME", "")
    password = os.getenv("SPACETRACK_PASSWORD", "")

    if not username or not password or "your_" in username:
        logger.error("SPACETRACK_USERNAME/PASSWORD가 .env에 설정되지 않음")
        return {"satcat": 0, "gp": 0}

    timestamp = datetime.now(timezone.utc)
    logger.info("=" * 60)
    logger.info("Space-Track 데이터 수집 시작 (UTC: %s)", timestamp.isoformat())
    logger.info("=" * 60)

    client = SpaceTrackClient(username, password)
    results: dict[str, int] = {}

    try:
        client.login()
    except Exception as e:
        logger.error("로그인 실패: %s", e)
        return {"satcat": 0, "gp": 0}

    # 1) SATCAT 전체 수집
    try:
        logger.info("[SATCAT] 전체 카탈로그 수집 중...")
        satcat_data = client.query("satcat")
        save_to_bronze(satcat_data, "satcat", timestamp)
        results["satcat"] = len(satcat_data)
    except Exception as e:
        logger.error("[SATCAT] 수집 실패: %s", e)
        results["satcat"] = 0

    # 2) GP 현재 궤도 요소 수집
    try:
        logger.info("[GP] 현재 궤도 요소 수집 중...")
        gp_data = client.query("gp")
        save_to_bronze(gp_data, "gp", timestamp)
        results["gp"] = len(gp_data)
    except Exception as e:
        logger.error("[GP] 수집 실패: %s", e)
        results["gp"] = 0

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
