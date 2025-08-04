// server/spacesClient.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import AWS from "aws-sdk";

// 1) load env
dotenv.config();

// 2) derive __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 3) read & parse public/live.json
const LIVE_JSON_PATH = path.resolve(__dirname, "../public/live.json");
let damLookup = {};

try {
  const raw = fs.readFileSync(LIVE_JSON_PATH, "utf8");
  const all = JSON.parse(raw).dams;             // your JSON has a top-level "dams" array
  damLookup = all.reduce((acc, dam) => {
    acc[dam.id] = dam.name;                     // map "19"→"Coquitlam", "20"→"Harrison", etc.
    return acc;
  }, {});
  console.log("✅ damLookup loaded:", damLookup);
} catch (err) {
  console.warn("⚠️ failed to load live.json:", err.message);
}

// 4) configure DO Spaces client
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);
export const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
});
export const BUCKET = process.env.SPACES_BUCKET;

// 5) upload helper
export async function uploadImageToSpaces(damId, buffer) {
  const name      = damLookup[damId] || `dam_${damId}`;
  const timestamp = new Date().toISOString();
  const historyKey = `images/${damId}/${name}_${timestamp}.jpg`;
  const latestKey  = `images/${damId}/latest.jpg`;

  // 5a) write history copy
  await s3.putObject({
    Bucket: BUCKET,
    Key: historyKey,
    Body: buffer,
    ContentType: "image/jpeg",
    ACL: "public-read",
  }).promise();

  // 5b) update latest pointer
  return s3.putObject({
    Bucket: BUCKET,
    Key: latestKey,
    Body: buffer,
    ContentType: "image/jpeg",
    ACL: "public-read",
  }).promise();
}
