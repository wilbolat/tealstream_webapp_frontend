import { useEffect, useState } from "react";

// In-memory cache for API responses, keyed by station number
const damApiCache: Record<string, {
  timestamp: number,
  series: { date: string, waterLevel: number | null }[],
  latest: number | null
}> = {};

export function useDamTimeSeries(damMeta: any) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<{ date: string, waterLevel: number | null }[]>([]);
  const [latest, setLatest] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      if (damMeta.dataSource && damMeta.dataSource.startsWith("wsc_")) {
        const station = damMeta.dataSource.replace("wsc_", "");
        const cacheKey = station;
        const now = Date.now();

        // Check cache: less than 15 min old
        if (
          damApiCache[cacheKey] &&
          now - damApiCache[cacheKey].timestamp < 15 * 60 * 1000
        ) {
          setSeries(damApiCache[cacheKey].series);
          setLatest(damApiCache[cacheKey].latest);
          setLoading(false);
          return;
        }

        // Fetch latest data from ECCC Hydrometric API (GeoMet)
        const url = `https://api.weather.gc.ca/collections/hydrometric-realtime/items?STATION_NUMBER=${station}&property=H`;
        const res = await fetch(url);
        const json = await res.json();

        const dataArr = (json.features || []).map((feature: any) => ({
          date: feature.properties.DATE_TIME.split("T")[0],
          waterLevel: feature.properties.H ? Number(feature.properties.H) : null,
        }));

        setSeries(dataArr);
        setLatest(dataArr.length ? dataArr[dataArr.length - 1].waterLevel : null);

        // Store in cache
        damApiCache[cacheKey] = {
          timestamp: now,
          series: dataArr,
          latest: dataArr.length ? dataArr[dataArr.length - 1].waterLevel : null
        };
      } else {
        setSeries(
          damMeta.data.map((pt: any) => ({
            date: pt.date,
            waterLevel: pt.waterLevel ? Number(pt.waterLevel) : null,
          }))
        );
        setLatest(
          damMeta.data.length
            ? Number(damMeta.data[damMeta.data.length - 1].waterLevel)
            : null
        );
      }

      setLoading(false);
    }
    fetchData();
  }, [damMeta]);

  return { loading, series, latest };
}
