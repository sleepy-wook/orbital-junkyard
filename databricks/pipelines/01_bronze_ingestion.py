# Databricks notebook source
# MAGIC %md
# MAGIC # Bronze 수집 — DLT Auto Loader
# MAGIC
# MAGIC S3에 적재된 raw JSON 파일을 Auto Loader(`cloud_files`)로 자동 감지하여
# MAGIC Bronze Streaming Tables에 적재한다.
# MAGIC
# MAGIC **테이블 목록:**
# MAGIC | 테이블 | 소스 | 설명 |
# MAGIC |--------|------|------|
# MAGIC | `spacetrack_satcat_raw` | Space-Track SATCAT | 카탈로그 메타데이터 |
# MAGIC | `spacetrack_gp_raw` | Space-Track GP | 현재 궤도 요소 |

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

# S3 경로
S3_BASE = "s3://orbital-junkyard-data/bronze"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Space-Track SATCAT (카탈로그 메타데이터)

# COMMAND ----------

@dlt.table(
    name="spacetrack_satcat_raw",
    comment="Space-Track SATCAT 원시 데이터 — 객체 카탈로그 메타데이터",
    table_properties={"quality": "bronze"},
)

def spacetrack_satcat_raw():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("multiLine", "true")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .load(f"{S3_BASE}/spacetrack/satcat/")
        .select(
            F.explode("data").alias("record"),
            F.col("_metadata.file_path").alias("_source_file"),
        )
        .select("record.*", "_source_file")
        .withColumn("_ingestion_ts", F.current_timestamp())
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Space-Track GP (현재 궤도 요소)

# COMMAND ----------

@dlt.table(
    name="spacetrack_gp_raw",
    comment="Space-Track GP 원시 데이터 — 현재 궤도 요소",
    table_properties={"quality": "bronze"},
)

def spacetrack_gp_raw():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("multiLine", "true")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .load(f"{S3_BASE}/spacetrack/gp/")
        .select(
            F.explode("data").alias("record"),
            F.col("_metadata.file_path").alias("_source_file"),
        )
        .select("record.*", "_source_file")
        .withColumn("_ingestion_ts", F.current_timestamp())
    )
