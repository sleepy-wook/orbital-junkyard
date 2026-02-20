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
# MAGIC | `celestrak_gp_raw` | CelesTrak GP API | 활성 위성 궤도 요소 |
# MAGIC | `spacetrack_satcat_raw` | Space-Track SATCAT | 카탈로그 메타데이터 |
# MAGIC | `spacetrack_gp_raw` | Space-Track GP | 현재 궤도 요소 |
# MAGIC | `noaa_solar_wind_raw` | NOAA SWPC | 태양풍 속도/밀도 |
# MAGIC | `noaa_kp_index_raw` | NOAA SWPC | 지자기 Kp 지수 |
# MAGIC | `noaa_xray_flux_raw` | NOAA SWPC | X-ray 플럭스 |

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

# S3 경로
S3_BASE = "s3://orbital-junkyard-data/bronze"

# COMMAND ----------

# MAGIC %md
# MAGIC ## CelesTrak GP (활성 위성 궤도 요소)

# COMMAND ----------

@dlt.table(
    name="celestrak_gp_raw",
    comment="CelesTrak GP 원시 데이터 — 활성 위성 궤도 요소",
    table_properties={"quality": "bronze"},
)

def celestrak_gp_raw():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("multiLine", "true")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .load(f"{S3_BASE}/celestrak/gp/")
        .select(
            F.explode("data").alias("record"),
            F.col("_metadata.file_path").alias("_source_file"),
        )
        .select("record.*", "_source_file")
        .withColumn("_ingestion_ts", F.current_timestamp())
    )

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

# COMMAND ----------

# MAGIC %md
# MAGIC ## NOAA Solar Wind (태양풍 속도/밀도)
# MAGIC
# MAGIC NOAA solar_wind와 kp_index는 data가 리스트의 리스트 (첫 행 = 헤더).
# MAGIC 컬럼명을 하드코딩하여 처리한다.

# COMMAND ----------

@dlt.table(
    name="noaa_solar_wind_raw",
    comment="NOAA 태양풍 원시 데이터 — 속도/밀도 (7일)",
    table_properties={"quality": "bronze"},
)
def noaa_solar_wind_raw():
    HEADERS = ["time_tag", "density", "speed", "temperature"]

    df_raw = (
        spark.read.option("multiLine", True)
        .option("recursiveFileLookup", "true")
        .json(f"{S3_BASE}/noaa/solar_wind/")
    )
    df = df_raw.select(
        F.explode(F.slice("data", 2, F.size("data") - 1)).alias("row")
    )
    return df.select(
        *[F.element_at("row", i + 1).alias(h) for i, h in enumerate(HEADERS)]
    ).withColumn("_ingestion_ts", F.current_timestamp())

# COMMAND ----------

# MAGIC %md
# MAGIC ## NOAA Kp Index (지자기 폭풍 지수)

# COMMAND ----------

@dlt.table(
    name="noaa_kp_index_raw",
    comment="NOAA Kp 지수 원시 데이터 — 지자기 폭풍 강도",
    table_properties={"quality": "bronze"},
)
def noaa_kp_index_raw():
    HEADERS = ["time_tag", "Kp", "a_running", "station_count"]

    df_raw = (
        spark.read.option("multiLine", True)
        .option("recursiveFileLookup", "true")
        .json(f"{S3_BASE}/noaa/kp_index/")
    )
    df = df_raw.select(
        F.explode(F.slice("data", 2, F.size("data") - 1)).alias("row")
    )
    return df.select(
        *[F.element_at("row", i + 1).alias(h) for i, h in enumerate(HEADERS)]
    ).withColumn("_ingestion_ts", F.current_timestamp())

# COMMAND ----------

# MAGIC %md
# MAGIC ## NOAA X-ray Flux (X-ray 플럭스)

# COMMAND ----------

@dlt.table(
    name="noaa_xray_flux_raw",
    comment="NOAA X-ray 플럭스 원시 데이터 — GOES 위성 관측 (7일)",
    table_properties={"quality": "bronze"},
)

def noaa_xray_flux_raw():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("multiLine", "true")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .load(f"{S3_BASE}/noaa/xray_flux/")
        .select(
            F.explode("data").alias("record"),
            F.col("_metadata.file_path").alias("_source_file"),
        )
        .select("record.*", "_source_file")
        .withColumn("_ingestion_ts", F.current_timestamp())
    )
