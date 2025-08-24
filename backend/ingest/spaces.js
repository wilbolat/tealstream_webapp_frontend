require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  region: process.env.SPACES_REGION,
  endpoint: process.env.SPACES_ENDPOINT,
  forcePathStyle: false,
  credentials: { accessKeyId: process.env.SPACES_ACCESS_KEY_ID, secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY }
});
async function putJpeg({ Bucket, Key, Body }) {
  await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType:'image/jpeg' /* ACL: 'public-read' optional */ }));
  return `s3://${Bucket}/${Key}`;
}
module.exports = { s3, putJpeg };
