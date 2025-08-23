// server/server.js
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { s3, BUCKET, uploadImageToSpaces } from "./spacesClient.js";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const HTTP_PORT = process.env.HTTP_PORT || 9001;

// Where nginx serves live.json from
const LIVE_ROOT = "/var/www/metrovancouver.tealstream.ca";

/* --------------------------- helpers --------------------------- */

/** Read live.json and return dams array (best-effort). */
async function readLive() {
  try {
    const raw = await fs.readFile(path.join(LIVE_ROOT, "live.json"), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.dams) ? data.dams : [];
  } catch {
    return [];
  }
}

/**
 * Normalize any dam key (name or numeric id) into a canonical numeric id,
 * plus the friendly name when available.
 */
async function resolveDam(damKey) {
  const dams = await readLive();
  const keyStr = String(damKey).trim();

  // If it's numeric, treat it as the id
  if (/^\d+$/.test(keyStr)) {
    const found = dams.find((d) => String(d.id) === keyStr);
    return { id: keyStr, name: found?.name || null };
  }

  // Otherwise treat it as a name (match name or officialName)
  const foundByName =
    dams.find((d) => d.name === keyStr) ||
    dams.find((d) => d.officialName === keyStr);
  if (foundByName) return { id: String(foundByName.id), name: foundByName.name || keyStr };

  // Fallback: unknown; return what we can
  return { id: null, name: keyStr };
}

/* --------------------------- routes --------------------------- */

// health‐check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", port: String(HTTP_PORT) });
});

// image upload endpoint (always saves to images/<id>/latest.jpg when possible)
app.post("/upload-image", upload.single("image"), async (req, res) => {
  const damKey = req.query.damId;
  if (!damKey || !req.file) {
    return res
      .status(400)
      .json({ error: "Missing damId or form field 'image'" });
  }

  try {
    const { id, name } = await resolveDam(damKey);
    // Prefer numeric id; if unknown, fall back to the provided name/key
    const folder = id ?? name;
    if (!folder) {
      return res.status(400).json({ error: "Unknown dam" });
    }

    // Pass through mimetype so Spaces gets correct Content-Type
    await uploadImageToSpaces(folder, req.file.buffer, req.file.mimetype);
    return res.json({ success: true });
  } catch (err) {
    console.error("Upload failed:", err);
    return res.status(500).json({ error: "Upload to Spaces failed" });
  }
});

// snapshot-info endpoint (prefer images/<id>/, fall back to images/<name>/)
app.get("/snapshot-info", async (req, res) => {
  const damKey = req.query.damId;
  if (!damKey) {
    return res.status(400).json({ error: "damId required" });
  }

  try {
    const { id, name } = await resolveDam(damKey);

    // Search order: numeric id first (canonical), then name as a fallback
    const prefixes = [];
    if (id) prefixes.push(`images/${id}/`);
    if (name) prefixes.push(`images/${name}/`);

    let latest = null; // { Key, LastModified }

    for (const Prefix of prefixes) {
      const list = await s3
        .listObjectsV2({ Bucket: BUCKET, Prefix })
        .promise();

      for (const obj of list.Contents || []) {
        if (
          !latest ||
          new Date(obj.LastModified) > new Date(latest.LastModified)
        ) {
          latest = obj;
        }
      }

      // If we found something under the preferred folder, stop searching
      if (latest) break;
    }

    if (!latest) {
      return res.status(404).json({ error: "No snapshots found" });
    }

    const url = `https://${BUCKET}.${process.env.SPACES_ENDPOINT}/${latest.Key}`;
    return res.json({ url, lastModified: latest.LastModified });
  } catch (err) {
    console.error("snapshot-info failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* --------------------------- start --------------------------- */

app.listen(HTTP_PORT, () => {
  console.log(`Image ingestion HTTP server listening on port ${HTTP_PORT}`);
});
