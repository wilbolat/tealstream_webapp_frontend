import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useTheme } from "@/components/ui/theme-provider";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface VisualizationProps {
  data: any[];
  domain?: [number, number];
  currentIndex: number;
  onIndexChange?: (index: number) => void;
  damData: any;
}

export function Visualization({
  data,
  currentIndex,
  onIndexChange,
  damData
}: VisualizationProps) {
  const { theme } = useTheme();
  const currentData = data[currentIndex] || data[data.length - 1];
  const crestElevation = parseFloat(damData.crestElevation) || 1;
  const rawWaterLevel = parseFloat(currentData.waterLevel || "0");
  const fillRatio = Math.min(Math.max(rawWaterLevel / crestElevation, 0), 1);
  const markerLen = 20;                       // length of each segment
  const diag = markerLen * Math.SQRT1_2;      // same length at 45°
  const crestX = (-2 + 15) / 2;               // midpoint of your crest corners

  //const waterLevel = parseFloat(currentData?.storagePercentage || "0");

  const handleSliderChange = (value: number[]) => {
    onIndexChange?.(Math.round(value[0]));
  };

  const handlePrevious = () => {
    if (currentIndex > 0) onIndexChange?.(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < data.length - 1) onIndexChange?.(currentIndex + 1);
  };

  const formatDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split(".");
    return format(
      new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
      "MMM dd, yyyy"
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const target = format(date, "dd.MM.yyyy");
    const idx = data.findIndex((d) => d.date === target);
    if (idx !== -1) onIndexChange?.(idx);
  };

  const currentDate = currentData?.date
    ? new Date(currentData.date.split(".").reverse().join("-"))
    : new Date();

  const availableDates = useMemo(
    () => data.map((item) => new Date(item.date.split(".").reverse().join("-"))),
    [data]
  );

  return (
    <Card className="glass-card h-full">
      <CardContent className="p-0 flex flex-col h-full">
        {/* --- VISUALIZATION AREA --- */}
        <div className="relative min-h-[240px]">
          <svg
            viewBox="0 0 700 400"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="sky-gradient-light" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#87CEEB" />
                <stop offset="100%" stopColor="#E0F6FF" />
              </linearGradient>
              <linearGradient id="sky-gradient-dark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B1026" />
              </linearGradient>
              <linearGradient id="water-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--dam-water))"
                  stopOpacity="var(--dam-water-opacity)"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--dam-water))"
                  stopOpacity={0.5}
                />
              </linearGradient>
            </defs>

            {/* Pure Sky Background */}
            <motion.rect
              x="0"
              y="0"
              width="800"
              height="400"
              initial={false}
              animate={{
                fill:
                  theme === "light"
                    ? "url(#sky-gradient-light)"
                    : "url(#sky-gradient-dark)",
              }}
              transition={{ duration: 0.5 }}
            />

            {/* Main Dam & Reservoir Group */}
            <g transform="translate(300,100)">
              {/* Buoy & Level Indicator */}
              <g transform="translate(-50,80)">
                <motion.g
                  initial={{ y: 220 * (1 - fillRatio) }}
                  animate={{
                    y: 220 * (1 - fillRatio),
                    rotate: [-2, 2, -2],
                  }}
                  transition={{
                    y: { type: "spring", stiffness: 50, damping: 12 },
                    rotate: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                  }}
                >
                  {/* % Storage */}
                  <g transform="translate(-65,-17)">
                    <foreignObject x="-150" y="-10" width="200" height="24">
                      <div className="text-right" style={{ width: "100%" }}>
                        <AnimatedNumber
                          value={rawWaterLevel}
                          decimals={2}
                          suffix="m"
                          className="text-2xl font-medium"
                        />
                      </div>
                    </foreignObject>
                  </g>
                  {/* Buoy Image */}
                  <image
                    href="/buoy.webp"
                    x="-20"
                    y="-32"
                    width="40"
                    height="40"
                  />
                </motion.g>
              </g>

              {/* Water Body */}
              <motion.rect
                x="-300"
                initial={{
                  y: 80 + 220 * (1 - fillRatio),
                  height: 220 * fillRatio,
                }}
                animate={{
                  y: 80 + 220 * (1 - fillRatio),
                  height: 220 * fillRatio,
                }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                width="420"
                fill="url(#water-gradient)"
              />

              {/* Dam Structure */}
              <g transform="translate(120,80)">
                {/* Main Embankment/Concrete Shape */}
                <path
                  d="M-2 0 L-180 220 L180 220 L15 0 Z"
                  fill="#A0522D"
                />
                {/* Tiny window you can remove if desired */}
                <rect
                  x="-8"
                  y="-6"
                  width="4"
                  height="3"
                  fill="hsl(var(--dam-window))"
                  opacity="var(--dam-window-opacity)"
                />
                {/* vertical marker */}
                <line
                  x1={crestX}
                  y1={0}
                  x2={crestX}
                  y2={-markerLen}
                  stroke="hsl(var(--dam-structure-dark))"
                  strokeWidth={2}
                />

                {/* 45° diagonal */}
                <line
                  x1={crestX}
                  y1={-markerLen}
                  x2={crestX + diag}
                  y2={-markerLen - diag}
                  stroke="hsl(var(--dam-structure-dark))"
                  strokeWidth={2}
                />

                {/* crest elevation label */}
                <text
                  x={crestX + diag + 4}
                  y={-markerLen - diag - 4}
                  fill="hsl(var(--foreground))"
                  fontSize="1.25rem"
                  fontWeight={500}
                >
                  {crestElevation.toFixed(2)} m
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* --- NAVIGATION CONTROLS --- */}
        <div className="px-6 pt-4 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="text-sm text-muted-foreground font-medium min-w-[150px] justify-start"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {currentData?.date && formatDate(currentData.date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={currentDate}
                onSelect={handleDateSelect}
                disabled={(date) =>
                  !availableDates.some(
                    (d) => d.toDateString() === date.toDateString()
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === data.length - 1}
            className="h-8 w-8 shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* --- TIME SLIDER --- */}
        <div className="px-6 pb-8 pt-5 overflow-hidden">
          <div className="relative mx-4">
            <Slider
              value={[currentIndex]}
              min={0}
              max={data.length - 1}
              step={1}
              onValueChange={handleSliderChange}
              className="w-full"
            />

            {data.length > 0 && (
              <div className="relative mt-2">
                <div className="relative text-[10px] text-muted-foreground">
                  {Array.from({ length: Math.min(6, Math.floor(data.length / 30)) }).map(
                    (_, idx, arr) => {
                      const dataIndex = Math.floor(
                        (idx * (data.length - 1)) / (arr.length - 1)
                      );
                      const position = `${(idx / (arr.length - 1)) * 100}%`;

                      return (
                        <div
                          key={dataIndex}
                          className="absolute"
                          style={{
                            left: position,
                            width: "28px",
                            transform:
                              idx === 0
                                ? "translateX(0)"
                                : idx === arr.length - 1
                                  ? "translateX(-100%)"
                                  : "translateX(-50%)",
                          }}
                        >
                          {/* tick mark */}
                          <div className="h-2 w-[2px] bg-muted-foreground/40 mx-auto mb-1.5" />
                          {/* date label */}
                          <div
                            className={`opacity-90 font-medium leading-none tracking-tight whitespace-nowrap ${idx === 0
                              ? "text-left pl-0.5"
                              : idx === arr.length - 1
                                ? "text-right pr-0.5"
                                : "text-center"
                              }`}
                          >
                            {format(
                              new Date(
                                data[dataIndex].date.split(".").reverse().join("-")
                              ),
                              "MM/yy"
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
