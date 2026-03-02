"""통합 파이프라인 실행 스크립트

전체 데이터 수집 → S3 업로드를 한 번에 실행한다.
Windows Task Scheduler로 8시간마다 자동 실행되도록 설정할 수 있다.

실행 순서:
    1. Space-Track SATCAT + GP 수집
    2. S3 업로드

사용법:
    python scripts/run_pipeline.py
"""

import logging
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def run_script(name: str, script_path: Path) -> bool:
    """Python 스크립트를 실행하고 성공 여부를 반환한다."""
    logger.info("▶ %s 시작...", name)
    start = time.time()

    try:
        result = subprocess.run(
            [PYTHON, str(script_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"},
            timeout=600,  # 10분 타임아웃
        )

        elapsed = time.time() - start

        if result.returncode == 0:
            logger.info("  [OK] %s 완료 (%.1f초)", name, elapsed)
            return True
        else:
            logger.error("  [FAIL] %s 실패 (%.1f초)", name, elapsed)
            if result.stderr:
                for line in result.stderr.strip().split("\n")[-5:]:
                    logger.error("    %s", line)
            return False

    except subprocess.TimeoutExpired:
        logger.error("  [TIMEOUT] %s 시간 초과 (10분)", name)
        return False
    except Exception as e:
        logger.error("  [ERROR] %s: %s", name, e)
        return False


def main() -> None:
    start_time = datetime.now(timezone.utc)
    logger.info("=" * 60)
    logger.info("Orbital Junkyard 파이프라인 실행")
    logger.info("시작: %s (UTC)", start_time.strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("=" * 60)

    # 수집 스크립트 목록
    scripts = [
        ("Space-Track SATCAT+GP 수집", PROJECT_ROOT / "databricks/collection/collect_spacetrack.py"),
        ("S3 업로드", PROJECT_ROOT / "scripts/upload_to_s3.py"),
    ]

    results = {}
    for name, path in scripts:
        success = run_script(name, path)
        results[name] = success

        # 수집 실패해도 다음 수집은 계속 진행 (S3 업로드 전까지)
        if not success and "S3" in name:
            logger.warning("S3 업로드 실패 — DLT 파이프라인에 새 데이터가 반영되지 않음")

    # 결과 요약
    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    logger.info("")
    logger.info("=" * 60)
    logger.info("파이프라인 결과 요약 (%.1f초)", elapsed)
    logger.info("=" * 60)

    all_ok = True
    for name, success in results.items():
        status = "OK" if success else "FAIL"
        logger.info("  [%s] %s", status, name)
        if not success:
            all_ok = False

    if all_ok:
        logger.info("")
        logger.info("전체 성공! DLT 파이프라인이 S3 신규 파일을 자동 감지합니다.")
    else:
        logger.warning("")
        logger.warning("일부 작업 실패. 로그를 확인하세요.")
        sys.exit(1)


if __name__ == "__main__":
    main()
