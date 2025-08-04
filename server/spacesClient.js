// server/spacesClient.js
import dotenv from "dotenv";
import AWS from "aws-sdk";

// load .env into process.env
dotenv.config();

// configure your Spaces endpoint & credentials
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);
export const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
});

export const BUCKET = process.env.SPACES_BUCKET;

/**
 * Uploads a JPEG buffer to Spaces under
 *   images/<damId>/latest.jpg
 */
export function uploadImageToSpaces(damId, buffer) {
  const key = `images/${damId}/latest.jpg`;
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
