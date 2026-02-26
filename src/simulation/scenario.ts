export type TyphoonStrength =
  | "Tropical Depression"
  | "Tropical Storm"
  | "Severe Tropical Storm"
  | "Typhoon"
  | "Super Typhoon";

export type SimulationScenario = {
  typhoonStrength: TyphoonStrength;
  forecastLeadHours: number;
  rainfallMm24h: number;
  floodDepthMeters: number;
  atRiskPopulation: number;
  barangaysExposed: number;
  evacuationCompliancePercent: number;
  publicSchoolShelters: number;
  communityShelters: number;
  avgShelterCapacity: number;
  avgSchoolEnrollment: number;
  averageStayDays: number;
  roadAccessibilityPercent: number;
  homesNeedingRepairPercent: number;
  dailyReturnPercent: number;
  useAssumptionsForMissingData: boolean;
};

export const typhoonStrengthOptions: TyphoonStrength[] = [
  "Tropical Depression",
  "Tropical Storm",
  "Severe Tropical Storm",
  "Typhoon",
  "Super Typhoon",
];

export const defaultSimulationScenario: SimulationScenario = {
  typhoonStrength: "Typhoon",
  forecastLeadHours: 18,
  rainfallMm24h: 220,
  floodDepthMeters: 1.2,
  atRiskPopulation: 12000,
  barangaysExposed: 7,
  evacuationCompliancePercent: 74,
  publicSchoolShelters: 4,
  communityShelters: 6,
  avgShelterCapacity: 320,
  avgSchoolEnrollment: 950,
  averageStayDays: 5,
  roadAccessibilityPercent: 68,
  homesNeedingRepairPercent: 36,
  dailyReturnPercent: 17,
  useAssumptionsForMissingData: true,
};
