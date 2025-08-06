// src/components/DamList.tsx

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { Dam } from "@/types/dam";

type SortField = "name" | "waterLevel" | "freeboard";
type SortDirection = "asc" | "desc";

const getSortLabel = (f: SortField) =>
  ({ name: "Name", waterLevel: "Reservoir Level", freeboard: "Available Freeboard" } as const)[f];

// identical to DamStatusCards.tsx
const getAlertLabel = (status: string) => {
  switch (status) {
    case "red":
      return {
        text: "RED",
        bgClass:
          "bg-gradient-to-r from-red-500 to-red-600 w-[90px] text-xs tracking-widest shadow-sm shadow-red-500/20",
      };
    case "orange":
      return {
        text: "ORANGE",
        bgClass:
          "bg-gradient-to-r from-orange-500 to-orange-600 w-[90px] text-xs tracking-widest shadow-sm shadow-orange-500/20",
      };
    case "blue":
      return {
        text: "BLUE",
        bgClass:
          "bg-gradient-to-r from-blue-500 to-blue-600 w-[90px] text-xs tracking-widest shadow-sm shadow-blue-500/20",
      };
    default:
      return {
        text: "NO ALERT",
        bgClass:
          "bg-gradient-to-r from-zinc-600 to-zinc-700 w-[90px] text-xs tracking-widest shadow-sm shadow-zinc-600/20",
      };
  }
};

interface DamListProps {
  dams: Dam[];
  isLoading: boolean;
  error: Error | null;
}

export default function DamList({ dams, isLoading, error }: DamListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("waterLevel");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const toggleSortDir = () =>
    setSortDirection((d) => (d === "asc" ? "desc" : "asc"));

  const list = useMemo(() => {
    return dams
      .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortField === "name") {
          const cmp = a.name.localeCompare(b.name);
          return sortDirection === "asc" ? cmp : -cmp;
        }
        // exact lines from DamStatusCards.tsx
        const lastA = a.data[a.data.length - 1] || { waterLevel: "0" };
        const lvlA = parseFloat(lastA.waterLevel);
        const freeA = parseFloat(a.crestElevation) - lvlA;

        const lastB = b.data[b.data.length - 1] || { waterLevel: "0" };
        const lvlB = parseFloat(lastB.waterLevel);
        const freeB = parseFloat(b.crestElevation) - lvlB;
        // end copy

        const valA = sortField === "waterLevel" ? lvlA : freeA;
        const valB = sortField === "waterLevel" ? lvlB : freeB;
        return sortDirection === "asc" ? valA - valB : valB - valA;
      });
  }, [dams, search, sortField, sortDirection]);

  if (isLoading) return <div className="p-4">Loading dams…</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error.message}</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Card className="mx-4 h-full flex flex-col overflow-hidden bg-background shadow-xl">
        <CardHeader className="p-4 border-b bg-muted">
          <div className="flex items-center gap-4">
            <CardTitle className="flex-1 truncate">Lower Mainland Reservoirs</CardTitle>
            <ThemeToggle />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dams…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by…" />
              </SelectTrigger>
              <SelectContent>
                {(["name", "waterLevel", "freeboard"] as SortField[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {getSortLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" onClick={toggleSortDir}>
                  <ArrowUpDown className={sortDirection === "desc" ? "rotate-180 transform" : ""} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle sort direction</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {list.map((dam, idx) => {
                const last = dam.data[dam.data.length - 1] || { waterLevel: "0" };
                const currentLevel = parseFloat(last.waterLevel);
                const currentFreebd = parseFloat(dam.crestElevation) - currentLevel;
                const displayValue = sortField === "waterLevel" ? currentLevel : currentFreebd;

                // determine status
                let status = "normal";
                if (currentLevel >= parseFloat(dam.redLevel)) status = "red";
                else if (currentLevel >= parseFloat(dam.orangeLevel)) status = "orange";
                else if (currentLevel >= parseFloat(dam.blueLevel)) status = "blue";

                const label = getAlertLabel(status);
                const borderColor =
                  status === "red"
                    ? "border-red-500"
                    : status === "orange"
                    ? "border-orange-500"
                    : status === "blue"
                    ? "border-blue-500"
                    : "border-zinc-600";

                return (
                  <motion.div
                    key={dam.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                    exit={{ opacity: 0, y: -20 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <Card
                      onClick={() => navigate(`/${encodeURIComponent(dam.name)}`)}
                      className={`relative cursor-pointer border-l-4 ${borderColor} bg-card pt-6 pb-4 px-4`}
                    >
                      {/* corner ribbon */}
                      <div className="absolute top-0 left-0">
                        <div
                          className={`${label.bgClass} text-white h-6 px-2 flex items-center justify-center text-xs font-medium rounded-br-lg`}
                        >
                          {label.text}
                        </div>
                      </div>

                      {/* dam info */}
                      <div className="flex justify-between items-center mt-1">
                        <div className="truncate">
                          <h3 className="font-semibold">{dam.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {currentLevel.toFixed(2)} m
                          </p>
                        </div>
                        <div className="text-right">
                          <AnimatedNumber value={displayValue} decimals={2} suffix=" m" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {getSortLabel(sortField)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </CardContent>
        </ScrollArea>
      </Card>
    </motion.div>
  );
}
