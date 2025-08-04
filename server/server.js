// server/server.js
import AWS from "aws-sdk";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { s3, BUCKET, uploadImageToSpaces } from "./spacesClient.js";

// load env vars
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const HTTP_PORT = process.env.HTTP_PORT || 9001;

// health‐check
app.get("/health", (_req, res) =>
  res.json({ status: "ok", port: HTTP_PORT })
);

// image upload endpoint
app.post("/upload-image", upload.single("image"), async (req, res) => {
  const damId = req.query.damId;
  if (!damId || !req.file) {
    return res
      .status(400)
      .json({ error: "Missing query param damId or form field ‘image’" });
  }
  try {
    await uploadImageToSpaces(damId, req.file.buffer);
    return res.json({ success: true });
  } catch (err) {
    console.error("Upload failed:", err);
    return res.status(500).json({ error: "Upload to Spaces failed" });
  }
});

app.get("/snapshot-info", async (req, res) => {
  const damId = req.query.damId;
  if (!damId) return res.status(400).json({ error: "damId required" });

  const key = `images/${damId}/latest.jpg`;
  try {
    const head = await s3.headObject({
      Bucket: BUCKET,
      Key: key
    }).promise();
    // Log the raw UTC timestamp
    console.log("💡 LastModified (raw UTC):", head.LastModified.toISOString());

    return res.json({
      url: `https://${BUCKET}.${process.env.SPACES_ENDPOINT}/${key}`,
      lastModified: head.LastModified,
    });
  } catch (err) {
    return res.status(404).json({ error: "Snapshot not found" });
  }
});

app.listen(HTTP_PORT, () =>
  console.log(`Image ingestion HTTP server listening on port ${HTTP_PORT}`)
);
