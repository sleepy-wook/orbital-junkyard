"""Orbital Junkyard — API 연결 테스트 스크립트

모든 데이터 소스(CelesTrak, Space-Track, NOAA)와 AWS S3 접근을 검증한다.
"""

import os
import sys
import requests
import boto3
from dotenv import load_dotenv

# .env 파일은 프로젝트 루트에 위치
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def test_celestrak() -> bool:
    """CelesTrak GP API 연결 테스트. 인증 불필요, 우주정거장 그룹으로 소량 테스트."""
    try:
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        print(f"  CelesTrak: {len(data)}개 우주정거장 객체 수신")
        print(f"  예시: {data[0]['OBJECT_NAME']} (NORAD: {data[0]['NORAD_CAT_ID']})")
        return True
    except Exception as e:
        print(f"  CelesTrak 실패: {e}")
        return False


def test_spacetrack() -> bool:
    """Space-Track REST API 연결 테스트. 로그인 후 ISS SATCAT 쿼리."""
    username = os.getenv("SPACETRACK_USERNAME")
    password = os.getenv("SPACETRACK_PASSWORD")

    if not username or not password or "your_" in username:
        print("  Space-Track: SPACETRACK_USERNAME/PASSWORD가 .env에 설정되지 않음")
        print("  https://www.space-track.org/auth/createAccount 에서 가입 필요")
        return False

    try:
        session = requests.Session()
        login_resp = session.post(
            "https://www.space-track.org/ajaxauth/login",
            data={"identity": username, "password": password},
            timeout=30,
        )

        if login_resp.status_code != 200 or "Login Failed" in login_resp.text:
            print(f"  Space-Track: 로그인 실패 (status {login_resp.status_code})")
            return False

        query_url = (
            "https://www.space-track.org/basicspacedata/query"
            "/class/satcat/NORAD_CAT_ID/25544/format/json"
        )
        resp = session.get(query_url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        print(f"  Space-Track: ISS 데이터 수신")
        print(f"  이름: {data[0]['SATNAME']}, 타입: {data[0]['OBJECT_TYPE']}, 국가: {data[0]['COUNTRY']}")
        return True
    except Exception as e:
        print(f"  Space-Track 실패: {e}")
        return False


def test_noaa() -> bool:
    """NOAA 우주날씨 API 연결 테스트. 인증 불필요, Kp 지수 조회."""
    try:
        url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # 첫 행은 헤더
        print(f"  NOAA Kp Index: {len(data) - 1}개 레코드 수신")
        print(f"  최신: {data[-1]}")
        return True
    except Exception as e:
        print(f"  NOAA 실패: {e}")
        return False


def test_s3() -> bool:
    """AWS S3 버킷 접근 테스트. boto3로 head_bucket 호출."""
    bucket = os.getenv("AWS_S3_BUCKET")
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if not bucket or not access_key or "your_" in access_key:
        print("  S3: AWS 환경변수가 .env에 설정되지 않음")
        return False

    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
        s3.head_bucket(Bucket=bucket)
        print(f"  S3: 버킷 '{bucket}' 접근 성공")
        return True
    except Exception as e:
        print(f"  S3 실패: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Orbital Junkyard — API 연결 테스트")
    print("=" * 60)

    tests = {
        "CelesTrak": test_celestrak,
        "Space-Track": test_spacetrack,
        "NOAA": test_noaa,
        "AWS S3": test_s3,
    }

    results: dict[str, bool] = {}
    for name, test_fn in tests.items():
        print(f"\n[{name}]")
        results[name] = test_fn()

    print("\n" + "=" * 60)
    print("결과 요약:")
    for name, ok in results.items():
        status = "OK" if ok else "FAIL"
        print(f"  [{status}] {name}")
    print("=" * 60)

    if all(results.values()):
        print("모든 연결 성공! Phase 1 개발을 시작할 수 있습니다.")
    else:
        print("실패한 항목을 해결한 후 다시 실행하세요.")
        sys.exit(1)
