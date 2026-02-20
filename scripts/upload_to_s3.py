"""Bronze 데이터 S3 업로드 스크립트

로컬 bronze/ 디렉토리의 raw JSON 파일을 AWS S3 버킷에 업로드한다.
디렉토리 구조를 그대로 유지하여 S3에 저장한다.

S3 경로:
    s3://{bucket}/bronze/celestrak/gp/YYYY-MM-DD/...
    s3://{bucket}/bronze/spacetrack/satcat/YYYY-MM-DD/...
    s3://{bucket}/bronze/spacetrack/gp/YYYY-MM-DD/...
    s3://{bucket}/bronze/noaa/solar_wind/YYYY-MM-DD/...
    s3://{bucket}/bronze/noaa/kp_index/YYYY-MM-DD/...
    s3://{bucket}/bronze/noaa/xray_flux/YYYY-MM-DD/...
"""

import logging
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# 프로젝트 루트
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

BRONZE_DIR = PROJECT_ROOT / "bronze"


def get_s3_client() -> boto3.client:
    """AWS S3 클라이언트를 생성한다."""
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )


def upload_directory(s3_client: boto3.client, bucket: str) -> dict[str, int]:
    """bronze/ 디렉토리 전체를 S3에 업로드한다.

    Args:
        s3_client: boto3 S3 클라이언트
        bucket: S3 버킷 이름

    Returns:
        업로드 결과 {성공 수, 실패 수, 스킵 수}
    """
    results = {"uploaded": 0, "failed": 0, "skipped": 0}

    if not BRONZE_DIR.exists():
        logger.error("bronze/ 디렉토리가 없습니다: %s", BRONZE_DIR)
        return results

    json_files = sorted(BRONZE_DIR.rglob("*.json"))
    logger.info("업로드 대상: %d개 파일", len(json_files))

    for local_path in json_files:
        # 로컬 경로에서 S3 키 생성: bronze/celestrak/gp/2026-02-20/file.json
        relative = local_path.relative_to(PROJECT_ROOT)
        s3_key = relative.as_posix()  # Windows 역슬래시 -> 슬래시

        try:
            # 이미 존재하는지 확인 (불필요한 PUT 방지)
            try:
                s3_client.head_object(Bucket=bucket, Key=s3_key)
                logger.info("  [SKIP] %s (이미 존재)", s3_key)
                results["skipped"] += 1
                continue
            except ClientError as e:
                if e.response["Error"]["Code"] != "404":
                    raise

            # 업로드
            file_size_mb = local_path.stat().st_size / (1024 * 1024)
            s3_client.upload_file(
                str(local_path),
                bucket,
                s3_key,
                ExtraArgs={"ContentType": "application/json"},
            )
            logger.info("  [OK] %s (%.2f MB)", s3_key, file_size_mb)
            results["uploaded"] += 1

        except Exception as e:
            logger.error("  [FAIL] %s: %s", s3_key, e)
            results["failed"] += 1

    return results


def verify_upload(s3_client: boto3.client, bucket: str) -> None:
    """S3 업로드 결과를 확인한다."""
    logger.info("S3 버킷 내용 확인:")

    paginator = s3_client.get_paginator("list_objects_v2")
    total_size = 0
    total_count = 0

    for page in paginator.paginate(Bucket=bucket, Prefix="bronze/"):
        for obj in page.get("Contents", []):
            total_size += obj["Size"]
            total_count += 1

    logger.info("  총 파일 수: %d", total_count)
    logger.info("  총 크기: %.2f MB", total_size / (1024 * 1024))


def main() -> None:
    bucket = os.getenv("AWS_S3_BUCKET")
    if not bucket:
        logger.error("AWS_S3_BUCKET 환경변수가 설정되지 않음")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Bronze 데이터 S3 업로드 시작")
    logger.info("버킷: %s", bucket)
    logger.info("=" * 60)

    s3_client = get_s3_client()
    results = upload_directory(s3_client, bucket)

    logger.info("")
    logger.info("=" * 60)
    logger.info("업로드 결과:")
    logger.info("  성공: %d개", results["uploaded"])
    logger.info("  스킵: %d개 (이미 존재)", results["skipped"])
    logger.info("  실패: %d개", results["failed"])
    logger.info("=" * 60)

    if results["uploaded"] > 0 or results["skipped"] > 0:
        verify_upload(s3_client, bucket)

    if results["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
