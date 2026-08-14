import { Client } from "minio";

let minioClient: Client | null = null;

function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "estimaia",
      secretKey: process.env.MINIO_SECRET_KEY || "estimaia123",
    });
  }
  return minioClient;
}

const BUCKET = process.env.MINIO_BUCKET || "estima-ia";

export async function ensureBucket() {
  const client = getMinioClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
    // Public read policy
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    });
    await client.setBucketPolicy(BUCKET, policy);
  }
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const client = getMinioClient();
  await ensureBucket();
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": mimeType,
  });

  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const useSSL = process.env.MINIO_USE_SSL === "true";
  const protocol = useSSL ? "https" : "http";
  return `${protocol}://${endpoint}:${port}/${BUCKET}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  const client = getMinioClient();
  await client.removeObject(BUCKET, key);
}

export async function getSignedUrl(key: string, expiry = 3600): Promise<string> {
  const client = getMinioClient();
  return client.presignedGetObject(BUCKET, key, expiry);
}
