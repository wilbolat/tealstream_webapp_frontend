// server/spacesClient.js
import dotenv from "dotenv";
import AWS from "aws-sdk";

dotenv.config();

const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);
export const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
});
export const BUCKET = process.env.SPACES_BUCKET;

/**
 * Uploads a JPEG buffer to Spaces under:
 *    images/<damId>/<ISO timestamp>.jpg
 */
export function uploadImageToSpaces(damId, buffer) {
  const iso = new Date().toISOString();              // unique per call
  const key = `images/${damId}/${iso}.jpg`;
  return s3
    .putObject({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
      ACL: "public-read",
    })
    .promise();
}
