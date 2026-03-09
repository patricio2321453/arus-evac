import { regionOptions, type Region } from "./shelterData";

export type HazardType =
  | "Flood"
  | "Typhoon-Related Flood";

export type HazardStatus = "Monitoring" | "Watch" | "Warning" | "Evacuation Ordered";

export type HazardSeverity = "Low" | "Moderate" | "High" | "Critical";

export type HazardRecord = {
  id: string;
  name: string;
  type: HazardType;
  status: HazardStatus;
  severity: HazardSeverity;
  region: Region;
  municipalityCity: string;
  forecastLeadHours: number;
  affectedBarangays: number;
  estimatedAffectedPopulation: number;
  expectedEvacueeNeed: number;
  sourceAgency: string;
  lastUpdated: string;
  notes: string;
  latitude: number;
  longitude: number;
  isochroneGeometry?: GeoJSON.Polygon;
};

export const hazardTypeOptions: HazardType[] = [
  "Flood",
  "Typhoon-Related Flood",
];

export const hazardStatusOptions: HazardStatus[] = [
  "Monitoring",
  "Watch",
  "Warning",
  "Evacuation Ordered",
];

export const hazardSeverityOptions: HazardSeverity[] = [
  "Low",
  "Moderate",
  "High",
  "Critical",
];

export const regionFilterOptions = [...regionOptions] as const;

export const initialHazards: HazardRecord[] = [
  {
    id: "h-001",
    name: "Southbound Flood Surge Wave",
    type: "Typhoon-Related Flood",
    status: "Watch",
    severity: "High",
    region: "Luzon",
    municipalityCity: "San Juan",
    forecastLeadHours: 22,
    affectedBarangays: 18,
    estimatedAffectedPopulation: 52000,
    expectedEvacueeNeed: 13000,
    sourceAgency: "PAGASA",
    lastUpdated: "12 mins ago",
    notes: "Expected heavy flood bands across low-lying zones. Preposition response assets.",
    latitude: 14.606,
    longitude: 121.035,
  },
  {
    id: "h-002",
    name: "River Overflow in Pasig Basin",
    type: "Flood",
    status: "Warning",
    severity: "Critical",
    region: "Luzon",
    municipalityCity: "Pasig City",
    forecastLeadHours: 8,
    affectedBarangays: 12,
    estimatedAffectedPopulation: 41000,
    expectedEvacueeNeed: 9800,
    sourceAgency: "MMDA",
    lastUpdated: "25 mins ago",
    notes: "Localized flooding around low-lying barangays, evacuation may expand by dawn.",
    latitude: 14.5764,
    longitude: 121.0855,
  },
  {
    id: "h-003",
    name: "Cordillera Basin Flood Watch",
    type: "Typhoon-Related Flood",
    status: "Monitoring",
    severity: "Moderate",
    region: "Luzon",
    municipalityCity: "Baguio City",
    forecastLeadHours: 36,
    affectedBarangays: 6,
    estimatedAffectedPopulation: 8400,
    expectedEvacueeNeed: 2200,
    sourceAgency: "PHIVOLCS",
    lastUpdated: "41 mins ago",
    notes: "Saturated soil and recent heavy precipitation increase flood runoff risk.",
    latitude: 16.4023,
    longitude: 120.596,
  },
  {
    id: "h-004",
    name: "Iloilo Coastal Flood Advisory",
    type: "Typhoon-Related Flood",
    status: "Monitoring",
    severity: "Moderate",
    region: "Visayas",
    municipalityCity: "Iloilo City",
    forecastLeadHours: 15,
    affectedBarangays: 9,
    estimatedAffectedPopulation: 18000,
    expectedEvacueeNeed: 4600,
    sourceAgency: "PAGASA",
    lastUpdated: "1 hour ago",
    notes: "Wave setup combined with river overflow may expand flood footprint near high tide.",
    latitude: 10.7202,
    longitude: 122.5621,
  },
  {
    id: "h-005",
    name: "Davao Corridor Flood Watch",
    type: "Typhoon-Related Flood",
    status: "Evacuation Ordered",
    severity: "High",
    region: "Mindanao",
    municipalityCity: "Davao City",
    forecastLeadHours: 5,
    affectedBarangays: 7,
    estimatedAffectedPopulation: 12600,
    expectedEvacueeNeed: 3100,
    sourceAgency: "MDRRMO",
    lastUpdated: "9 mins ago",
    notes: "Evacuation routes in feeder roads are blocked by flood damage.",
    latitude: 7.1907,
    longitude: 125.4553,
  },
  {
    id: "h-006",
    name: "Cebu Island Flood Watch",
    type: "Typhoon-Related Flood",
    status: "Watch",
    severity: "Low",
    region: "Visayas",
    municipalityCity: "Cebu City",
    forecastLeadHours: 72,
    affectedBarangays: 3,
    estimatedAffectedPopulation: 4200,
    expectedEvacueeNeed: 500,
    sourceAgency: "PHIVOLCS",
    lastUpdated: "2 hours ago",
    notes: "Minor localized flooding remains under observation.",
    latitude: 10.3157,
    longitude: 123.8854,
  },
];
