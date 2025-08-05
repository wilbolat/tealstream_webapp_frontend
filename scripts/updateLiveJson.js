// scripts/updateLiveJson.js
import fs from "fs/promises";
import path from "path";
// import { fetchHistoricalDamData } from "../src/lib/api"; // adjust path if needed
async function fetchHistoricalDamData(damName) {
  const filename = `${damName.replace(/\s+/g, "_")}.json`;
  const filePath = path.resolve(process.cwd(), "public", "historic_data", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  // 1) load your current live.json metadata (so you keep lastUpdate, dams list, etc.)
  const livePath = path.resolve(process.cwd(), "public/live.json");
  const liveRaw  = await fs.readFile(livePath, "utf-8");
  const liveData = JSON.parse(liveRaw);

  // 2) for each dam stub, fetch its full history and pick the latest record
  const updatedDams = await Promise.all(
    liveData.dams.map(async (stub) => {
      const hist = await fetchHistoricalDamData(stub.name);
      const newest = hist.data?.[hist.data.length - 1] || {};
      
      // replace data array with only the newest
      return {
        ...stub,
        data: [newest],
      };
    })
  );

  // 3) write back with updated time and dams[]
  const out = {
    ...liveData,
    lastUpdate: new Date().toLocaleDateString("en-GB"), // dd.mm.yyyy
    dams: updatedDams,
  };

  await fs.writeFile(livePath, JSON.stringify(out, null, 2), "utf-8");
  console.log("✅ live.json refreshed with latest readings");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
