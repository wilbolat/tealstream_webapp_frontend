// server/spacesClient.js
import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

/**
 * DigitalOcean Spaces client
 * SPACES_ENDPOINT should be like: "tor1.digitaloceanspaces.com" (no protocol)
 */
const endpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);

export const s3 = new AWS.S3({
  endpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
  signatureVersion: "v4",
  s3ForcePathStyle: false,
});

export const BUCKET = process.env.SPACES_BUCKET;

/**
 * Upload image to Spaces under images/<folder>/.
 * We save a history copy (timestamped) and update latest.jpg.
 *
 * @param {string} folder   normalized folder (prefer numeric dam id, e.g. "19")
 * @param {Buffer} buffer   image bytes
 * @param {string} mime     content type, e.g. "image/jpeg" (optional)
 */
export async function uploadImageToSpaces(folder, buffer, mime = "image/jpeg") {
  const iso = new Date().toISOString().replace(/[:]/g, "-"); // safe-ish for keys
  const historyKey = `images/${folder}/${iso}.jpg`;
  const latestKey  = `images/${folder}/latest.jpg`;

  // 1) history copy
  await s3.putObject({
    Bucket: BUCKET,
    Key: historyKey,
    Body: buffer,
    ContentType: mime,
    ACL: "public-read",
    CacheControl: "public, max-age=600", // 10 minutes; tune as you like
  }).promise();

  // 2) latest pointer
  await s3.putObject({
    Bucket: BUCKET,
    Key: latestKey,
    Body: buffer,
    ContentType: mime,
    ACL: "public-read",
    CacheControl: "public, max-age=60",  // keep lower so latest refreshes faster
  }).promise();

  // Return the public URL for latest
  return `https://${BUCKET}.${process.env.SPACES_ENDPOINT}/${latestKey}`;
}
