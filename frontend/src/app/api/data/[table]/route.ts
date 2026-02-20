import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.AWS_S3_BUCKET || "orbital-junkyard-data";
const REGION = process.env.AWS_REGION || "us-east-1";

const VALID_TABLES = [
  "orbital_census",
  "congestion_metrics",
  "country_leaderboard",
  "constellation_growth",
  "decay_tracker",
  "storm_impact",
  "space_objects",
  "metadata",
];

function getS3Client(): S3Client {
  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;

  if (!VALID_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }

  // S3에서 export JSON 가져오기
  try {
    const s3 = getS3Client();
    const key = `export/${table}.json`;

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      return NextResponse.json({ error: "Empty response from S3" }, { status: 404 });
    }

    const data = JSON.parse(body);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`S3 fetch error for ${table}:`, message);

    // S3 실패 시 샘플 데이터 반환 (개발용)
    return NextResponse.json(
      { error: "Data not available", detail: message },
      { status: 503 }
    );
  }
}
