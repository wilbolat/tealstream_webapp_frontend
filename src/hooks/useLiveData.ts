// src/hooks/useLiveData.ts
import { useEffect, useState } from "react";

export function useLiveData() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    const url = `/live.json?v=${Date.now()}`; // cache‑buster
    fetch(url, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => setData(j))
      .catch(e => setErr(e))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, err };
}
