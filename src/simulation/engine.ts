import { SimulationScenario } from "./scenario";

export type SimulationResult = {
  estimatedEvacuees: number;
  peakEvacuationHours: number;
  totalShelterCapacity: number;
  occupancyPercent: number;
  overflowPeople: number;
  estimatedSheltersNeeded: number;
  schoolDisruptionStudents: number;
  servedBarangays: number;
  estimatedReturnDays: number;
  displacedAfter7Days: number;
  assumptions: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function runSimulation(scenario: SimulationScenario): SimulationResult {
  const typhoonFactorByStrength = {
    "Tropical Depression": 0.72,
    "Tropical Storm": 0.85,
    "Severe Tropical Storm": 1,
    Typhoon: 1.15,
    "Super Typhoon": 1.3,
  } as const;

  const typhoonFactor = typhoonFactorByStrength[scenario.typhoonStrength];
  const rainFactor = clamp(0.7 + scenario.rainfallMm24h / 350, 0.7, 1.5);
  const floodFactor = clamp(0.6 + scenario.floodDepthMeters * 0.35, 0.6, 1.6);
  const hazardFactor = clamp(typhoonFactor * rainFactor * floodFactor, 0.45, 1.8);

  const evacuationRate = clamp(
    (scenario.evacuationCompliancePercent / 100) * (0.55 + hazardFactor * 0.35),
    0,
    1
  );
  const estimatedEvacuees = Math.round(scenario.atRiskPopulation * evacuationRate);

  const leadTimePenalty = clamp(24 / Math.max(6, scenario.forecastLeadHours), 0.6, 2.2);
  const routePenalty = clamp(1.35 - scenario.roadAccessibilityPercent / 200, 0.65, 1.35);
  const peakEvacuationHours = Math.round(6 * leadTimePenalty * routePenalty);

  const totalShelterCapacity =
    (scenario.publicSchoolShelters + scenario.communityShelters) *
    scenario.avgShelterCapacity;
  const occupancyPercent =
    totalShelterCapacity > 0
      ? Math.round((estimatedEvacuees / totalShelterCapacity) * 100)
      : 0;
  const overflowPeople = Math.max(0, estimatedEvacuees - totalShelterCapacity);
  const estimatedSheltersNeeded =
    scenario.avgShelterCapacity > 0
      ? Math.ceil(estimatedEvacuees / scenario.avgShelterCapacity)
      : 0;

  const schoolUseFactor = clamp(scenario.averageStayDays / 5, 0.4, 1.5);
  const schoolDisruptionStudents = Math.round(
    scenario.publicSchoolShelters * scenario.avgSchoolEnrollment * schoolUseFactor
  );

  const routeFactor = clamp(scenario.roadAccessibilityPercent / 100, 0.35, 1);
  const homeRepairPenalty = clamp(0.6 + scenario.homesNeedingRepairPercent / 100, 0.6, 1.6);
  const normalizedDailyReturn = clamp(
    (scenario.dailyReturnPercent / 100) * routeFactor * (1 / homeRepairPenalty),
    0.02,
    0.55
  );

  const estimatedReturnDays = Math.max(1, Math.ceil(1 / normalizedDailyReturn));
  const displacedAfter7Days = Math.round(
    estimatedEvacuees * Math.max(0, 1 - normalizedDailyReturn * 7)
  );

  const assumptions: string[] = scenario.useAssumptionsForMissingData
    ? [
        "Average school enrollment per selected public school is modeled as one shared value.",
        "Shelter capacity is treated as evenly distributed across all active shelters.",
        "Road accessibility and home repair rates are simplified into a daily return multiplier.",
      ]
    : [];

  return {
    estimatedEvacuees,
    peakEvacuationHours,
    totalShelterCapacity,
    occupancyPercent,
    overflowPeople,
    estimatedSheltersNeeded,
    schoolDisruptionStudents,
    servedBarangays: scenario.barangaysExposed,
    estimatedReturnDays,
    displacedAfter7Days,
    assumptions,
  };
}
