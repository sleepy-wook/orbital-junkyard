# Databricks notebook source
# MAGIC %md
# MAGIC # Silver 변환 — DLT Materialized Views
# MAGIC
# MAGIC Bronze 원시 데이터를 정제·통합하여 분석 가능한 Silver 테이블로 변환한다.
# MAGIC
# MAGIC **테이블 목록:**
# MAGIC | 테이블 | 설명 |
# MAGIC |--------|------|
# MAGIC | `space_objects` | 통합 객체 테이블 (SATCAT 메타 + Space-Track GP 궤도 요소) |
# MAGIC | `fragmentation_events` | 파편화/충돌 사건 그룹핑 |

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

# COMMAND ----------

# MAGIC %md
# MAGIC ## space_objects — 통합 우주 객체 테이블
# MAGIC
# MAGIC SATCAT 메타데이터 + Space-Track GP 궤도 요소를 NORAD_CAT_ID로 조인.
# MAGIC 궤도 분류(orbital_regime), 객체 카테고리(object_category) 파생.

# COMMAND ----------

@dlt.table(
    name="space_objects",
    comment="통합 우주 객체 테이블 — SATCAT 메타 + 궤도 요소, orbital_regime/object_category 파생",
    table_properties={"quality": "silver"},
)
@dlt.expect("valid_norad_id", "norad_cat_id IS NOT NULL")
@dlt.expect("valid_object_name", "object_name IS NOT NULL")
def space_objects():
    # SATCAT: 카탈로그 메타데이터 (최신 수집분만 유지)
    satcat_all = dlt.read("spacetrack_satcat_raw").select(
        F.col("NORAD_CAT_ID").cast("int").alias("norad_cat_id"),
        F.col("SATNAME").alias("object_name"),
        F.col("OBJECT_ID").alias("intl_designator"),
        F.col("OBJECT_TYPE").alias("object_type"),
        F.col("COUNTRY").alias("country"),
        F.col("LAUNCH").cast("date").alias("launch_date"),
        F.col("DECAY").cast("date").alias("decay_date"),
        F.col("PERIOD").cast("double").alias("period_min"),
        F.col("APOGEE").cast("int").alias("apogee_km"),
        F.col("PERIGEE").cast("int").alias("perigee_km"),
        F.col("RCS_SIZE").alias("rcs_size"),
        F.col("CURRENT").alias("is_current"),
        F.col("_ingestion_ts"),
    )
    # dedup: NORAD_CAT_ID 기준 최신 레코드만 유지
    from pyspark.sql.window import Window
    w_satcat = Window.partitionBy("norad_cat_id").orderBy(F.desc("_ingestion_ts"))
    satcat = satcat_all.withColumn("_rn", F.row_number().over(w_satcat)).filter("_rn = 1").drop("_rn", "_ingestion_ts")

    # Space-Track GP: 최신 궤도 요소 (최신 수집분만 유지)
    gp_all = dlt.read("spacetrack_gp_raw").select(
        F.col("NORAD_CAT_ID").cast("int").alias("norad_cat_id"),
        F.col("EPOCH").cast("timestamp").alias("epoch"),
        F.col("MEAN_MOTION").cast("double").alias("mean_motion"),
        F.col("ECCENTRICITY").cast("double").alias("eccentricity"),
        F.col("INCLINATION").cast("double").alias("inclination"),
        F.col("RA_OF_ASC_NODE").cast("double").alias("ra_of_asc_node"),
        F.col("ARG_OF_PERICENTER").cast("double").alias("arg_of_pericenter"),
        F.col("MEAN_ANOMALY").cast("double").alias("mean_anomaly"),
        F.col("BSTAR").cast("double").alias("bstar"),
        F.col("REV_AT_EPOCH").cast("int").alias("rev_at_epoch"),
        F.col("TLE_LINE1").alias("tle_line1"),
        F.col("TLE_LINE2").alias("tle_line2"),
        F.col("_ingestion_ts"),
    )
    # dedup: NORAD_CAT_ID 기준 최신 EPOCH 레코드만 유지
    w_gp = Window.partitionBy("norad_cat_id").orderBy(F.desc("epoch"), F.desc("_ingestion_ts"))
    gp = gp_all.withColumn("_rn", F.row_number().over(w_gp)).filter("_rn = 1").drop("_rn", "_ingestion_ts")

    # 조인: SATCAT + GP (left join — GP가 없는 SATCAT 객체도 유지)
    df = satcat.join(gp, "norad_cat_id", "left")

    # 파생: orbital_regime (궤도 분류)
    df = df.withColumn(
        "orbital_regime",
        F.when(F.col("apogee_km") < 2000, "LEO")
        .when(
            (F.col("perigee_km") >= 2000) & (F.col("apogee_km") < 35000),
            "MEO",
        )
        .when(
            (F.col("perigee_km") >= 35000) & (F.col("apogee_km") <= 36500),
            "GEO",
        )
        .when(F.col("apogee_km") >= 36500, "HEO")
        .otherwise("UNKNOWN"),
    )

    # 파생: object_category (세분화 카테고리)
    df = df.withColumn(
        "object_category",
        F.when(
            (F.col("object_type") == "PAYLOAD") & (F.col("decay_date").isNull()),
            "active_payload",
        )
        .when(
            (F.col("object_type") == "PAYLOAD") & (F.col("decay_date").isNotNull()),
            "defunct_payload",
        )
        .when(F.col("object_type") == "ROCKET BODY", "rocket_body")
        .when(F.col("object_type") == "DEBRIS", "debris")
        .otherwise("unknown"),
    )

    # 파생: is_debris, is_active 플래그
    df = df.withColumn("is_debris", F.col("object_type") == "DEBRIS")
    df = df.withColumn(
        "is_active",
        (F.col("object_type") == "PAYLOAD") & (F.col("decay_date").isNull()),
    )

    return df

# COMMAND ----------

# MAGIC %md
# MAGIC ## fragmentation_events — 파편화/충돌 사건
# MAGIC
# MAGIC SATCAT의 INTLDES(국제 식별코드) 접두사로 그룹핑하여
# MAGIC 파편화 사건별 잔해 수를 집계한다.

# COMMAND ----------

@dlt.table(
    name="fragmentation_events",
    comment="파편화/충돌 사건 — INTLDES 접두사 기반 잔해 그룹핑",
    table_properties={"quality": "silver"},
)
def fragmentation_events():
    satcat_raw = dlt.read("spacetrack_satcat_raw")
    # dedup: NORAD_CAT_ID 기준 최신 레코드만 유지
    from pyspark.sql.window import Window
    w = Window.partitionBy(F.col("NORAD_CAT_ID")).orderBy(F.desc("_ingestion_ts"))
    satcat = satcat_raw.withColumn("_rn", F.row_number().over(w)).filter("_rn = 1").drop("_rn")

    # INTLDES 접두사 추출 (예: "1999-025" → "1999-025")
    # OBJECT_ID 형식: "1999-025ABC" → 앞 8자리가 발사 식별자
    debris = satcat.filter(F.col("OBJECT_TYPE") == "DEBRIS").select(
        F.col("NORAD_CAT_ID").cast("int").alias("norad_cat_id"),
        F.col("OBJECT_ID").alias("intl_designator"),
        F.col("SATNAME").alias("object_name"),
        F.col("COUNTRY").alias("country"),
        F.col("LAUNCH").cast("date").alias("launch_date"),
        # 발사 식별자: "1999-025A" → "1999-025"
        F.regexp_extract("OBJECT_ID", r"^(\d{4}-\d{3})", 1).alias("launch_id"),
    )

    # 발사 식별자별 잔해 집계
    events = debris.groupBy("launch_id", "country").agg(
        F.count("*").alias("debris_count"),
        F.min("launch_date").alias("event_date"),
        F.first("object_name").alias("sample_object_name"),
    )

    # 잔해가 10개 이상인 사건만 (의미 있는 파편화 사건)
    return events.filter(F.col("debris_count") >= 10).withColumn(
        "severity",
        F.when(F.col("debris_count") >= 1000, "catastrophic")
        .when(F.col("debris_count") >= 100, "major")
        .when(F.col("debris_count") >= 10, "minor")
        .otherwise("insignificant"),
    )
