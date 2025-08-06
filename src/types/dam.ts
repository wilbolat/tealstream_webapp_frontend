// src/types/dam.ts

export interface DamDataPoint {
  date: string;
  waterLevel: string;
  liveStorage?: string;
  storagePercentage?: string;
  inflow?: string;
  powerHouseDischarge?: string;
  spillwayRelease?: string;
  totalOutflow?: string;
  rainfall?: string;
}

export interface Dam {
  id: string;
  name: string;
  officialName?: string;
  MWL?: string;
  FRL?: string;
  spillwayElevation: string;   // <— add this
  crestElevation: string;      // <— add this
  liveStorageAtFRL?: string;
  ruleLevel?: string;
  blueLevel: string;           // <— add this
  orangeLevel: string;         // <— add this
  redLevel: string;            // <— add this
  latitude?: number;
  longitude?: number;
  dataSource?: string;
  data: DamDataPoint[];        // your historic time series
}
