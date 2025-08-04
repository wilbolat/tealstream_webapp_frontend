// server/server.js
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { s3, BUCKET, uploadImageToSpaces } from "./spacesClient.js";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const HTTP_PORT = process.env.HTTP_PORT || 9001;

// health‐check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", port: HTTP_PORT });
});

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

// snapshot-info endpoint
app.get("/snapshot-info", async (req, res) => {
  const damId = req.query.damId;
  if (!damId) {
    return res.status(400).json({ error: "damId required" });
  }

  const prefix = `images/${damId}/`;
  try {
    const list = await s3
      .listObjectsV2({ Bucket: BUCKET, Prefix: prefix })
      .promise();

    if (!list.Contents || list.Contents.length === 0) {
      return res.status(404).json({ error: "No snapshots found" });
    }

    // Find the most recently modified object
    const latestObj = list.Contents.reduce((a, b) =>
      a.LastModified > b.LastModified ? a : b
    );

    const key = latestObj.Key;
    const url = `https://${BUCKET}.${process.env.SPACES_ENDPOINT}/${key}`;

    return res.json({
      url,
      lastModified: latestObj.LastModified,
    });
  } catch (err) {
    console.error("snapshot-info failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
}); // ← Make sure this closes the snapshot-info route

// start the server
app.listen(HTTP_PORT, () => {
  console.log(`Image ingestion HTTP server listening on port ${HTTP_PORT}`);
});
