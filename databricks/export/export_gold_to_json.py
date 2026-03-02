# Databricks notebook source
# MAGIC %md
# MAGIC # Gold → JSON Export
# MAGIC Gold 테이블 데이터를 JSON으로 변환하여 S3에 저장한다.
# MAGIC 프론트엔드(Next.js)에서 이 JSON 파일들을 fetch하여 대시보드를 렌더링한다.
# MAGIC
# MAGIC **Export 경로:** `s3://orbital-junkyard-data/export/`
# MAGIC
# MAGIC **자동화:** Databricks Job에서 DLT 파이프라인 완료 후 이 노트북이 실행된다.

# COMMAND ----------

import json
from datetime import datetime, timezone

CATALOG = "orbital_junkyard"
SCHEMA = "main"
EXPORT_BASE = "s3://orbital-junkyard-data/export"

GOLD_TABLES = [
    "orbital_census",
    "congestion_metrics",
    "country_leaderboard",
    "constellation_growth",
    "decay_tracker",
    "globe_data",
]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Export 함수

# COMMAND ----------

def export_table_to_json(table_name: str) -> dict:
    """Gold 테이블 하나를 JSON으로 S3에 export한다.

    각 JSON 파일 구조:
        {
            "table": "테이블명",
            "exported_at": "ISO timestamp",
            "row_count": 123,
            "data": [ ... ]
        }
    """
    full_name = f"{CATALOG}.{SCHEMA}.{table_name}"
    df = spark.table(full_name)
    row_count = df.count()

    # DataFrame → JSON (toPandas 사용, Serverless 호환)
    pdf = df.toPandas()
    json_array = json.loads(pdf.to_json(orient="records", date_format="iso"))

    export_data = {
        "table": table_name,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "row_count": row_count,
        "data": json_array,
    }

    json_str = json.dumps(export_data, ensure_ascii=False, indent=2)

    # S3에 단일 JSON 파일로 저장
    export_path = f"{EXPORT_BASE}/{table_name}.json"
    dbutils.fs.put(export_path, json_str, overwrite=True)

    size_kb = len(json_str.encode("utf-8")) / 1024
    print(f"  [OK] {table_name}: {row_count}행, {size_kb:.1f} KB → {export_path}")

    return {"table": table_name, "rows": row_count, "size_kb": round(size_kb, 1)}

# COMMAND ----------

# MAGIC %md
# MAGIC ## 전체 Gold 테이블 Export 실행

# COMMAND ----------

print("=" * 60)
print("Gold → JSON Export 시작")
print(f"시각: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
print("=" * 60)

results = []
errors = []

for table_name in GOLD_TABLES:
    try:
        result = export_table_to_json(table_name)
        results.append(result)
    except Exception as e:
        print(f"  [FAIL] {table_name}: {e}")
        errors.append({"table": table_name, "error": str(e)})

# COMMAND ----------

# MAGIC %md
# MAGIC ## 메타데이터 파일 생성

# COMMAND ----------

# 프론트엔드에서 사용 가능한 테이블 목록 + 최종 업데이트 시각
metadata = {
    "exported_at": datetime.now(timezone.utc).isoformat(),
    "tables": [r["table"] for r in results],
    "endpoints": {r["table"]: f"{r['table']}.json" for r in results},
    "total_rows": sum(r["rows"] for r in results),
}

meta_json = json.dumps(metadata, ensure_ascii=False, indent=2)
dbutils.fs.put(f"{EXPORT_BASE}/metadata.json", meta_json, overwrite=True)
print("metadata.json 생성 완료")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 결과 요약

# COMMAND ----------

print("")
print("=" * 60)
print("Export 결과 요약")
print("=" * 60)

total_rows = sum(r["rows"] for r in results)
total_size = sum(r["size_kb"] for r in results)

print(f"  성공: {len(results)}/{len(GOLD_TABLES)} 테이블")
print(f"  실패: {len(errors)}개")
print(f"  총 행 수: {total_rows:,}")
print(f"  총 크기: {total_size:.1f} KB")
print(f"  Export 경로: {EXPORT_BASE}/")
print("")

for r in results:
    print(f"    {r['table']}.json — {r['rows']:,}행, {r['size_kb']:.1f} KB")

if errors:
    print("")
    print("  실패 목록:")
    for e in errors:
        print(f"    {e['table']}: {e['error']}")
    raise Exception(f"{len(errors)}개 테이블 export 실패")

print("")
print("Export 완료! 프론트엔드에서 JSON 데이터를 사용할 수 있습니다.")
