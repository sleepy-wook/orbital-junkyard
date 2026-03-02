# Databricks notebook source
# MAGIC %md
# MAGIC # Gold 집계 — DLT Materialized Views
# MAGIC
# MAGIC Silver 테이블을 기반으로 분석 준비 완료된 Gold 집계 테이블을 생성한다.
# MAGIC 프론트엔드에서 직접 소비하거나 JSON export 대상이 된다.
# MAGIC
# MAGIC **테이블 목록:**
# MAGIC | 테이블 | 설명 |
# MAGIC |--------|------|
# MAGIC | `orbital_census` | 타입/궤도/국가별 객체 수 스냅샷 |
# MAGIC | `congestion_metrics` | 고도 밴드별 밀도/혼잡도 |
# MAGIC | `country_leaderboard` | 국가별 순위 + 잔해 비율 |
# MAGIC | `constellation_growth` | Starlink/OneWeb/Kuiper 추적 |
# MAGIC | `decay_tracker` | 감쇠 중 객체 (재진입 후보) |
# MAGIC | `globe_data` | 3D 글로브용 TLE 데이터 (~5,000개 샘플) |

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

# COMMAND ----------

# MAGIC %md
# MAGIC ## orbital_census — 궤도 인구 조사

# COMMAND ----------

@dlt.table(
    name="orbital_census",
    comment="궤도 인구 조사 — 타입/궤도/국가별 객체 수 스냅샷",
    table_properties={"quality": "gold"},
)
def orbital_census():
    objects = dlt.read("space_objects")

    # 전체 요약
    by_type = objects.groupBy("object_type").agg(
        F.count("*").alias("count"),
        F.sum(F.when(F.col("is_active"), 1).otherwise(0)).alias("active_count"),
    )

    by_regime = objects.groupBy("orbital_regime").agg(F.count("*").alias("count"))

    by_country = (
        objects.groupBy("country")
        .agg(F.count("*").alias("count"))
        .orderBy(F.desc("count"))
    )

    # 다차원 집계: object_type × orbital_regime
    census = objects.groupBy("object_type", "orbital_regime", "country").agg(
        F.count("*").alias("object_count"),
        F.sum(F.when(F.col("is_active"), 1).otherwise(0)).alias("active_count"),
        F.sum(F.when(F.col("is_debris"), 1).otherwise(0)).alias("debris_count"),
        F.avg("apogee_km").alias("avg_apogee_km"),
        F.avg("perigee_km").alias("avg_perigee_km"),
    )

    return census.withColumn("snapshot_date", F.current_date())

# COMMAND ----------

# MAGIC %md
# MAGIC ## congestion_metrics — 고도 밴드별 혼잡도

# COMMAND ----------

@dlt.table(
    name="congestion_metrics",
    comment="고도 밴드별 혼잡도 — 50km 구간별 객체 밀도",
    table_properties={"quality": "gold"},
)
def congestion_metrics():
    objects = dlt.read("space_objects").filter(F.col("apogee_km").isNotNull())

    # 50km 밴드로 구분
    df = objects.withColumn(
        "altitude_band_km",
        (F.floor(F.col("apogee_km") / 50) * 50).cast("int"),
    )

    return (
        df.groupBy("altitude_band_km")
        .agg(
            F.count("*").alias("total_objects"),
            F.sum(F.when(F.col("is_debris"), 1).otherwise(0)).alias("debris_count"),
            F.sum(F.when(F.col("is_active"), 1).otherwise(0)).alias("active_count"),
            F.avg("eccentricity").alias("avg_eccentricity"),
            F.avg("inclination").alias("avg_inclination"),
        )
        .withColumn(
            "debris_ratio",
            F.round(F.col("debris_count") / F.col("total_objects"), 4),
        )
        .withColumn(
            "congestion_level",
            F.when(F.col("total_objects") >= 500, "critical")
            .when(F.col("total_objects") >= 200, "high")
            .when(F.col("total_objects") >= 50, "moderate")
            .otherwise("low"),
        )
        .orderBy("altitude_band_km")
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## country_leaderboard — 국가별 순위

# COMMAND ----------

@dlt.table(
    name="country_leaderboard",
    comment="국가별 우주 객체 순위 — 활성 vs 잔해 비율",
    table_properties={"quality": "gold"},
)
def country_leaderboard():
    objects = dlt.read("space_objects")

    return (
        objects.groupBy("country")
        .agg(
            F.count("*").alias("total_objects"),
            F.sum(F.when(F.col("object_type") == "PAYLOAD", 1).otherwise(0)).alias(
                "payload_count"
            ),
            F.sum(F.when(F.col("is_active"), 1).otherwise(0)).alias("active_count"),
            F.sum(F.when(F.col("is_debris"), 1).otherwise(0)).alias("debris_count"),
            F.sum(
                F.when(F.col("object_type") == "ROCKET BODY", 1).otherwise(0)
            ).alias("rocket_body_count"),
        )
        .withColumn(
            "debris_ratio",
            F.round(F.col("debris_count") / F.col("total_objects"), 4),
        )
        .withColumn(
            "active_ratio",
            F.round(F.col("active_count") / F.col("total_objects"), 4),
        )
        .orderBy(F.desc("total_objects"))
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## constellation_growth — 대형 별자리 추적

# COMMAND ----------

@dlt.table(
    name="constellation_growth",
    comment="대형 별자리(Starlink/OneWeb/Kuiper) 현황 추적",
    table_properties={"quality": "gold"},
)
def constellation_growth():
    objects = dlt.read("space_objects")

    # 주요 별자리 식별 (객체 이름 기반)
    constellations = objects.withColumn(
        "constellation",
        F.when(F.upper(F.col("object_name")).contains("STARLINK"), "Starlink")
        .when(F.upper(F.col("object_name")).contains("ONEWEB"), "OneWeb")
        .when(F.upper(F.col("object_name")).contains("KUIPER"), "Kuiper")
        .when(F.upper(F.col("object_name")).contains("IRIDIUM"), "Iridium")
        .when(F.upper(F.col("object_name")).contains("GLOBALSTAR"), "Globalstar")
        .otherwise(None),
    ).filter(F.col("constellation").isNotNull())

    return constellations.groupBy("constellation").agg(
        F.count("*").alias("total_objects"),
        F.sum(F.when(F.col("is_active"), 1).otherwise(0)).alias("active_count"),
        F.sum(F.when(F.col("is_debris"), 1).otherwise(0)).alias("debris_count"),
        F.avg("apogee_km").alias("avg_altitude_km"),
        F.min("launch_date").alias("first_launch"),
        F.max("launch_date").alias("latest_launch"),
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## decay_tracker — 감쇠 중 객체 추적

# COMMAND ----------

@dlt.table(
    name="decay_tracker",
    comment="감쇠 중 객체 — 저고도 + 높은 BSTAR 값 객체 (재진입 후보)",
    table_properties={"quality": "gold"},
)
def decay_tracker():
    objects = dlt.read("space_objects")

    # 감쇠 후보: 저궤도 + 높은 대기 항력 (BSTAR)
    return (
        objects.filter(
            (F.col("perigee_km") < 400)  # 저고도
            & (F.col("decay_date").isNull())  # 아직 재진입 안 함
            & (F.col("bstar").isNotNull())
        )
        .select(
            "norad_cat_id",
            "object_name",
            "object_type",
            "country",
            "apogee_km",
            "perigee_km",
            "inclination",
            "bstar",
            "epoch",
            "launch_date",
            "orbital_regime",
        )
        .withColumn(
            "decay_risk",
            F.when(F.col("perigee_km") < 200, "imminent")
            .when(F.col("perigee_km") < 300, "high")
            .otherwise("moderate"),
        )
        .orderBy("perigee_km")
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## globe_data — 3D 글로브 시각화용 데이터
# MAGIC
# MAGIC TLE 데이터가 있는 객체를 궤도/유형별 층화 샘플링하여
# MAGIC 프론트엔드 3D 글로브에서 satellite.js로 실시간 위치를 계산할 수 있도록 한다.

# COMMAND ----------

@dlt.table(
    name="globe_data",
    comment="3D 글로브 시각화용 — TLE 데이터 포함 층화 샘플 (~5,000개)",
    table_properties={"quality": "gold"},
)
def globe_data():
    objects = dlt.read("space_objects").filter(
        F.col("tle_line1").isNotNull() & F.col("tle_line2").isNotNull()
    )

    # 궤도별 층화 샘플링 (LEO 75%, MEO 13%, GEO 12%)
    leo = objects.filter(F.col("orbital_regime") == "LEO").limit(3750)
    meo = objects.filter(F.col("orbital_regime") == "MEO").limit(650)
    geo = objects.filter(F.col("orbital_regime") == "GEO").limit(600)

    sampled = leo.unionByName(meo).unionByName(geo)

    return sampled.select(
        "norad_cat_id",
        "object_name",
        "object_type",
        "country",
        "orbital_regime",
        "tle_line1",
        "tle_line2",
    )
