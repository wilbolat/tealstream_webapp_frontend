import React, { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDamTimeSeries } from "@/hooks/useDamTimeSeries";
import { motion, AnimatePresence } from "framer-motion";
import { fetchHistoricalDamData } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Building2, CloudRain, ArrowDown, ArrowUp } from "lucide-react";
import { DateRange } from "react-day-picker";
import { parse, parseISO, isWithinInterval, format, startOfDay, addMonths, subYears } from "date-fns";
import { DamHeader } from "@/components/dam/DamHeader";
import { DamStatusCards } from "@/components/dam/DamStatusCards";
import { DamSpecifications } from "@/components/dam/DamSpecifications";
import { TrendChart } from "@/components/dam/TrendChart";
import { Visualization } from "@/components/dam/Visualization";
import { Helmet } from 'react-helmet';
import CameraFeedCard from "@/components/dam/CameraFeedCard";


const TIME_RANGE_STORAGE_KEY = 'dam-time-range';

const parseNumber = (value: string | undefined): number => {
  if (!value || value.trim() === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const calculateAxisDomain = (data: number[]): [number, number] => {
  const validData = data.filter(val => typeof val === 'number' && !isNaN(val) && val !== undefined);
  if (validData.length === 0) return [0, 100];
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  if (min === max) {
    const value = min;
    return [value * 0.9, value * 1.1];
  }
  const padding = (max - min) * 0.05;
  return [min - padding, max + padding];
};

const DamDetail = () => {
  const { name } = useParams();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    try {
      const savedRange = localStorage.getItem(TIME_RANGE_STORAGE_KEY);
      if (savedRange) {
        const parsed = JSON.parse(savedRange);
        const from = new Date(parsed.from);
        const to = new Date(parsed.to);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
          return { from: startOfDay(from), to: startOfDay(to) };
        }
      }
    } catch (e) {
      localStorage.removeItem(TIME_RANGE_STORAGE_KEY);
    }
    return undefined;
  });
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [isChangingRange, setIsChangingRange] = useState(false);
  const [visualizationIndex, setVisualizationIndex] = useState(0);

  const { data: damData, isLoading, error } = useQuery({
    queryKey: ["dam-history", name],
    queryFn: () => fetchHistoricalDamData(name || ""),
    enabled: !!name,
  });

  const { loading: seriesLoading, series, latest } = useDamTimeSeries(damData || {});

  const { data: snapshotInfo, isLoading: infoLoading } = useQuery({
    queryKey: ["snapshotInfo", damData?.id],
    queryFn: () => fetch(`/snapshot-info?damId=${damData?.id}`).then(r => r.json()),
    enabled: !!damData?.id,
  });

  useEffect(() => {
    if (damData?.data && damData.data.length > 0) {
      const mostRecentDate = damData.data.reduce((latest, item) => {
        const [day, month, year] = item.date.split('.');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date > latest ? date : latest;
      }, new Date(0));

      setReferenceDate(mostRecentDate);
      const defaultRange = {
        from: startOfDay(addMonths(mostRecentDate, -6)),
        to: startOfDay(mostRecentDate)
      };
      setDateRange(defaultRange);
    }
  }, [damData?.data]);

  const filteredData = useMemo(() => {
    if (!damData?.data || !dateRange?.from) return damData?.data;

    const filtered = damData.data.filter((item) => {
      const [day, month, year] = item.date.split('.');
      const date = startOfDay(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
      return isWithinInterval(date, {
        start: startOfDay(dateRange.from),
        end: startOfDay(dateRange.to || referenceDate)
      });
    });

    return filtered.sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split('.');
      const [dayB, monthB, yearB] = b.date.split('.');
      const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
      return dateA.getTime() - dateB.getTime();
    });
  }, [damData?.data, dateRange, referenceDate]);

  const visualizationData = useMemo(() => {
    if (!damData?.data || !referenceDate) return [];
    const twoYearsAgo = subYears(referenceDate, 2);

    return damData.data.filter((item) => {
      const [day, month, year] = item.date.split('.');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date >= twoYearsAgo && date <= referenceDate;
    }).sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split('.');
      const [dayB, monthB, yearB] = b.date.split('.');
      const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
      return dateA.getTime() - dateB.getTime();
    });
  }, [damData?.data, referenceDate]);

  const waterLevelStats = useMemo(() => {
    if (!filteredData?.length) return null;
    const levels = filteredData.map(d => parseFloat(d.waterLevel)).filter(level => !isNaN(level));
    if (levels.length === 0) return null;
    return {
      min: Math.min(...levels),
      max: Math.max(...levels),
      avg: levels.reduce((a, b) => a + b, 0) / levels.length
    };
  }, [filteredData]);

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    setIsChangingRange(true);
    setDateRange(newRange);

    try {
      if (newRange?.from && newRange?.to) {
        localStorage.setItem(TIME_RANGE_STORAGE_KEY, JSON.stringify({
          from: startOfDay(newRange.from).toISOString(),
          to: startOfDay(newRange.to).toISOString()
        }));
      } else {
        localStorage.removeItem(TIME_RANGE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save time range to localStorage:', e);
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsChangingRange(false);
      }, 300);
    });
  };

  const isTimeRangeLoading = useMemo(() => {
    return isLoading || isChangingRange || (dateRange && !filteredData);
  }, [isLoading, isChangingRange, dateRange, filteredData]);

  useEffect(() => {
    if (visualizationData?.length) {
      setVisualizationIndex(visualizationData.length - 1);
    }
  }, [visualizationData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading dam data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error loading dam data</div>
      </div>
    );
  }

  if (!damData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Dam not found</div>
      </div>
    );
  }

  const snapshotUrl = snapshotInfo?.url
    ? `${snapshotInfo.url}?ts=${Date.now()}`
    : undefined;

  console.log("Snapshot URL is:", snapshotUrl);
  const currentData = filteredData?.[filteredData.length - 1] || damData?.data[damData.data.length - 1];

  // domains for charts
  const inflowDomain = calculateAxisDomain(filteredData?.map(d => parseNumber(d.inflow)) || []);
  const rainfallDomain = calculateAxisDomain(filteredData?.map(d => parseNumber(d.rainfall)) || []);
  const storageDomain = calculateAxisDomain(filteredData?.map(d => parseNumber(d.liveStorage)) || []);
  const outflowDomain = calculateAxisDomain([
    ...(filteredData?.map(d => parseNumber(d.powerHouseDischarge)) || []),
    ...(filteredData?.map(d => parseNumber(d.spillwayRelease)) || [])
  ]);

  // Calculate water level ,alerts
  const waterLevels = filteredData?.map(d => parseFloat(d.waterLevel)) || [];
  const referenceLines = [
    parseFloat(damData.FRL),
    parseFloat(damData.redLevel),
    parseFloat(damData.orangeLevel),
    parseFloat(damData.blueLevel)
  ].filter(val => !isNaN(val) && val > 0);
  const waterLevelDomain = calculateAxisDomain([...waterLevels, ...referenceLines]);

  // Determine current alert status
  const currentLevel = parseFloat(currentData.waterLevel);
  const redThreshold = parseFloat(damData.redLevel);
  const orangeThreshold = parseFloat(damData.orangeLevel);

  let currentAlert = "No Alert";
  if (!isNaN(currentLevel)) {
    if (currentLevel >= redThreshold) {
      currentAlert = "Red Alert";
    } else if (currentLevel >= orangeThreshold) {
      currentAlert = "Orange Alert";
    }
  }


  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-blue-50 to-teal-50 dark:from-black dark:to-slate-950">
      <Helmet>
        <title>{damData.name} Reservoir Levels</title>
        <meta name="description" content={`Current water level of ${damData.name} dam is ${currentData?.waterLevel} meters.`} />
        <meta name="keywords" content={`${damData.name} dam, water levels, dam storage, inflow, outflow, rainfall`} />
        <meta property="og:title" content={`${damData.name} Dam Water Levels | Real-time Monitoring`} />
        <meta property="og:description" content={`Current water level of ${damData.name} dam is ${currentData?.waterLevel} meters.`} />
        <meta property="og:image" content="/og-image.png" />
        <meta property="twitter:title" content={`${damData.name} Dam Water Levels | Real-time Monitoring`} />
        <meta property="twitter:description" content={`Current water level of ${damData.name} dam is ${currentData?.waterLevel} meters.`} />
      </Helmet>
      <DamHeader
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        isTimeRangeLoading={isTimeRangeLoading}
        currentDate={currentData?.date}
        referenceDate={referenceDate}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6 p-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-4">
                  {damData.name} Dam
                  <span
                    className={
                      "px-2 py-1 rounded font-medium text-3xl " +
                      (currentAlert === "No Alert"
                        ? "bg-green-100 text-green-800"
                        : currentAlert === "Orange Alert"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800")
                    }
                  >
                    {currentAlert}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </motion.div>

          <DamStatusCards
            currentData={currentData}
            damData={damData}
            waterLevelStats={waterLevelStats}
          />

          <motion.div
            className="grid grid-cols-1 gap-6"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.15,
                  delayChildren: 0.5
                }
              }
            }}
          >
            {/* Section 1: Specifications and Visualization */}
            <motion.div variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/*
                <DamSpecifications damData={damData} />
                */}
                {/* Live Snapshot instead of HLS feed */}
                <Card>
                  <CardHeader>
                    <CardTitle>Upstream View</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Only render the <img> once snapshotInfo.url is available */}
                    {snapshotInfo?.url && (
                      <img
                        src={`${snapshotInfo.url}?ts=${Date.now()}`}
                        alt={`Snapshot of dam ${damData.name}`}
                        className="w-full h-auto object-cover rounded-lg"
                      />
                    )}
                    {/* show timestamp once loaded */}
                    {!infoLoading && snapshotInfo?.lastModified && (
                      <div className="mt-2 text-sm text-gray-500">
                        Taken at{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          timeZone: "America/Los_Angeles",
                          month: "short",    // e.g. “Aug”
                          day: "numeric",    // e.g. “2”
                          year: "numeric",   // e.g. “2025”
                          hour: "numeric",   // e.g. “4”
                          minute: "2-digit", // e.g. “04”
                          hour12: true,      // “PM”
                          timeZoneName: "short", // “PDT”
                        }).format(new Date(snapshotInfo.lastModified))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* Dam figure with water level */}
                <Visualization
                  data={visualizationData}
                  currentIndex={visualizationIndex}
                  onIndexChange={setVisualizationIndex}
                  damData={damData}
                />
              </div>
            </motion.div>

            {/* Section 2: Water Level Trend */}
            <motion.div variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}>
              <TrendChart
                title="Water Level Trend"
                icon={LineChart}
                iconColor="rgb(56, 189, 248)"
                data={filteredData.map(item => ({
                  ...item,
                  waterLevel: item.waterLevel ? parseFloat(item.waterLevel) : null,
                  fullReservoirLevel: parseFloat(damData.FRL),
                  redAlertLevel: parseFloat(damData.redLevel),
                  orangeAlertLevel: parseFloat(damData.orangeLevel)
                }))}
                charts={[
                  { type: 'area', dataKey: 'waterLevel', color: 'rgb(56, 189, 248)', label: 'Water Level' },
                  { type: 'line', dataKey: 'fullReservoirLevel', color: 'rgb(34, 197, 94)', label: 'FRL' },
                  { type: 'line', dataKey: 'redAlertLevel', color: 'rgb(239, 68, 68)', label: 'Red Alert' },
                  { type: 'line', dataKey: 'orangeAlertLevel', color: 'rgb(249, 115, 22)', label: 'Orange Alert' }
                ]}
                unit="m"
                domain={calculateAxisDomain(
                  series.map(d => d.waterLevel ?? 0).concat(
                    [parseFloat(damData.FRL), parseFloat(damData.redLevel), parseFloat(damData.orangeLevel)]
                  )
                )}
              />
            </motion.div>

            {/* Section 3: Storage and Inflow 
            <motion.div variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TrendChart
                  title="Storage Trend"
                  icon={Building2}
                  iconColor="rgb(16, 185, 129)"
                  data={filteredData?.map(item => ({
                    ...item,
                    liveStorage: parseNumber(item.liveStorage),
                    storagePercentage: parseNumber(item.storagePercentage)
                  }))}
                  charts={[
                    { type: 'area', dataKey: 'liveStorage', color: 'rgb(16, 185, 129)', label: 'Live Storage' },
                    { type: 'line', dataKey: 'storagePercentage', color: 'rgb(234, 179, 8)', label: 'Storage %', yAxisId: 'right' }
                  ]}
                  unit="MCM"
                  secondaryUnit="%"
                  domain={storageDomain}
                />

                <TrendChart
                  title="Inflow Trend"
                  icon={ArrowDown}
                  iconColor="rgb(59, 130, 246)"
                  data={filteredData?.map(item => ({
                    ...item,
                    inflow: parseNumber(item.inflow)
                  }))}
                  charts={[
                    { type: 'area', dataKey: 'inflow', color: 'rgb(59, 130, 246)', label: 'Inflow' }
                  ]}
                  unit="cumecs"
                  domain={inflowDomain}
                />
              </div>
            </motion.div>
*/}

            {/* Section 4: Outflow and Rainfall 
            <motion.div variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TrendChart
                  title="Outflow Trend"
                  icon={ArrowUp}
                  iconColor="rgb(168, 85, 247)"
                  data={filteredData?.map(item => ({
                    ...item,
                    powerHouseDischarge: parseNumber(item.powerHouseDischarge),
                    spillwayRelease: parseNumber(item.spillwayRelease)
                  }))}
                  charts={[
                    { type: 'line', dataKey: 'powerHouseDischarge', color: 'rgb(234, 179, 8)', label: 'Power House' },
                    { type: 'line', dataKey: 'spillwayRelease', color: 'rgb(239, 68, 68)', label: 'Spillway' }
                  ]}
                  unit="cumecs"
                  domain={outflowDomain}
                />


                <TrendChart
                  title="Rainfall Trend"
                  icon={CloudRain}
                  iconColor="rgb(98, 100, 247)"
                  data={filteredData?.map(item => ({
                    ...item,
                    rainfall: parseNumber(item.rainfall)
                  }))}
                  charts={[
                    { type: 'area', dataKey: 'rainfall', color: 'rgb(99, 102, 241)', label: 'Rainfall' }
                  ]}
                  unit="mm"
                  domain={rainfallDomain}
                />

              </div>
            </motion.div>
            */}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="animate-pulse text-lg"
            >
              Loading dam data...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DamDetail;
