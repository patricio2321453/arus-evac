import { Box, Flex, Grid, Heading, Select, Text, TextField } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { regionOptions, type Region, type ShelterRecord } from "./shelterData";
import { type HazardRecord } from "./hazardData";

const STORAGE_KEY_POPULATION = "arus-evac.population.v1";
const STORAGE_KEY_POPULATION_DEMOGRAPHIC_MIX = "arus-evac.population.demographic-mix.v1";
const STORAGE_KEY_POPULATION_DEMOGRAPHIC_LOCKS = "arus-evac.population.demographic-locks.v1";
const STORAGE_KEY_POPULATION_RESOLUTION_MODE = "arus-evac.population.resolution-mode.v1";
const STORAGE_KEY_POPULATION_SUBZONE_COUNT = "arus-evac.population.subzone-count.v1";
const STORAGE_KEY_POPULATION_SCENARIOS = "arus-evac.population.scenarios.v1";
const POPULATION_UPDATE_EVENT = "arus-evac:population-updated";
const POPULATION_SUBZONE_COUNT_MIN = 2;
const POPULATION_SUBZONE_COUNT_MAX = 8;

type DemographicGroupKey = "adults" | "children" | "pwd" | "others";
type PopulationDemographicMix = Record<DemographicGroupKey, number>;
type PopulationDemographicLocks = Record<DemographicGroupKey, boolean>;
type PopulationResolutionMode = "municipality" | "subzones";

const DEFAULT_DEMOGRAPHIC_MIX: PopulationDemographicMix = {
  adults: 62,
  children: 22,
  pwd: 11,
  others: 5,
};

const DEFAULT_DEMOGRAPHIC_LOCKS: PopulationDemographicLocks = {
  adults: false,
  children: false,
  pwd: false,
  others: false,
};

const DEMOGRAPHIC_GROUPS: Array<{ key: DemographicGroupKey; label: string }> = [
  { key: "adults", label: "Adults" },
  { key: "children", label: "Children" },
  { key: "pwd", label: "PWDs" },
  { key: "others", label: "Others" },
];

const DEMOGRAPHIC_KEYS: DemographicGroupKey[] = ["adults", "children", "pwd", "others"];

const DEMOGRAPHIC_PALETTE: Record<DemographicGroupKey, string> = {
  adults: "bg-sky-500",
  children: "bg-emerald-500",
  pwd: "bg-amber-500",
  others: "bg-violet-500",
};

const DEMOGRAPHIC_PRESETS: Array<{
  key: string;
  label: string;
  mix: PopulationDemographicMix;
}> = [
  { key: "balanced", label: "Balanced", mix: { adults: 62, children: 22, pwd: 11, others: 5 } },
  {
    key: "family-first",
    label: "Family-first",
    mix: { adults: 54, children: 33, pwd: 9, others: 4 },
  },
  {
    key: "pwd-support",
    label: "PWD support",
    mix: { adults: 47, children: 26, pwd: 22, others: 5 },
  },
  {
    key: "mobile-response",
    label: "Mobile response",
    mix: { adults: 56, children: 30, pwd: 8, others: 6 },
  },
];

type PopulationRecord = {
  id: string;
  region: Region;
  municipalityCity: string;
  totalPopulation: number;
  atRiskPopulation: number;
  latitude: number;
  longitude: number;
  notes?: string;
};

type PopulationRecordDraft = {
  region: Region;
  municipalityCity: string;
  totalPopulation: string;
  atRiskPopulation: string;
  latitude: string;
  longitude: string;
  notes: string;
};

type PopulationScenarioSnapshot = {
  name: string;
  records: PopulationRecord[];
  evacuationRate: number;
  demographicMix: PopulationDemographicMix;
  demographicLocks: PopulationDemographicLocks;
  updatedAt: string;
};

const initialPopulationRecords: PopulationRecord[] = [
  {
    id: "p-001",
    region: "Luzon",
    municipalityCity: "Batangas City",
    latitude: 13.7565,
    longitude: 121.0583,
    totalPopulation: 125000,
    atRiskPopulation: 42000,
    notes: "Coastal lowland barangays near river channels.",
  },
  {
    id: "p-002",
    region: "Luzon",
    municipalityCity: "Calapan City",
    latitude: 13.4115,
    longitude: 121.1803,
    totalPopulation: 94000,
    atRiskPopulation: 39000,
    notes: "Drainage-prone low elevation areas.",
  },
  {
    id: "p-003",
    region: "Visayas",
    municipalityCity: "Cebu City",
    latitude: 10.3157,
    longitude: 123.8854,
    totalPopulation: 210000,
    atRiskPopulation: 84000,
    notes: "Barangays near reclaimed waterfront zones.",
  },
  {
    id: "p-004",
    region: "Visayas",
    municipalityCity: "Iloilo City",
    latitude: 10.7202,
    longitude: 122.5621,
    totalPopulation: 102000,
    atRiskPopulation: 23000,
    notes: "Road-block risk during intense flood.",
  },
  {
    id: "p-005",
    region: "Mindanao",
    municipalityCity: "Davao City",
    latitude: 7.1907,
    longitude: 125.4553,
    totalPopulation: 184000,
    atRiskPopulation: 68000,
    notes: "Multiple evacuation routes available.",
  },
  {
    id: "p-006",
    region: "Mindanao",
    municipalityCity: "Cagayan de Oro City",
    latitude: 8.4542,
    longitude: 124.6319,
    totalPopulation: 122000,
    atRiskPopulation: 30000,
    notes: "River-adjacent subdivisions flagged.",
  },
];

function createEmptyPopulationDraft(): PopulationRecordDraft {
  return {
    region: "Luzon",
    municipalityCity: "",
    totalPopulation: "0",
    atRiskPopulation: "0",
    latitude: "",
    longitude: "",
    notes: "",
  };
}

function createPopulationDraftFromRecord(record: PopulationRecord): PopulationRecordDraft {
  return {
    region: record.region,
    municipalityCity: record.municipalityCity,
    totalPopulation: String(record.totalPopulation),
    atRiskPopulation: String(record.atRiskPopulation),
    latitude: String(record.latitude),
    longitude: String(record.longitude),
    notes: record.notes ?? "",
  };
}

function isRegion(value: unknown): value is Region {
  return regionOptions.includes(value as Region);
}

function parsePopulationCoordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDemographicPercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function normalizeDemographicMixFromValues(next: PopulationDemographicMix) {
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...DEFAULT_DEMOGRAPHIC_MIX };

  if (total === 100) return { ...next };

  const scaled = (Object.keys(next) as DemographicGroupKey[]).reduce((acc, key) => {
    acc[key] = Math.round((next[key] / total) * 100);
    return acc;
  }, {} as PopulationDemographicMix);

  let runningTotal = 0;
  for (const key of ["adults", "children", "pwd"] as DemographicGroupKey[]) {
    runningTotal += scaled[key];
  }

  const leftover = 100 - runningTotal;
  scaled.others = Math.max(0, Math.min(100, leftover));

  const finalTotal = Object.values(scaled).reduce((sum, value) => sum + value, 0);
  if (finalTotal === 100) return scaled;

  const keys = ["adults", "children", "pwd", "others"] as DemographicGroupKey[];
  let adjustment = 100 - finalTotal;
  for (const key of keys) {
    const candidate = scaled[key] + adjustment;
    const clamped = Math.max(0, Math.min(100, candidate));
    adjustment = candidate - clamped;
    scaled[key] = clamped;
    if (adjustment === 0) break;
  }

  return scaled;
}

function normalizeDemographicMix(value: unknown): PopulationDemographicMix | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const adults = parseDemographicPercent(candidate.adults);
  const children = parseDemographicPercent(candidate.children);
  const pwd = parseDemographicPercent(candidate.pwd);
  const others = parseDemographicPercent(candidate.others);

  if (
    adults === null ||
    children === null ||
    pwd === null ||
    others === null
  ) {
    return null;
  }

  return normalizeDemographicMixFromValues({
    adults,
    children,
    pwd,
    others,
  });
}

function computeExpectedByDemographic(
  expectedTotalEvacuees: number,
  demographicMix: PopulationDemographicMix
) {
  const adults = Math.round((expectedTotalEvacuees * demographicMix.adults) / 100);
  const children = Math.round((expectedTotalEvacuees * demographicMix.children) / 100);
  const pwd = Math.round((expectedTotalEvacuees * demographicMix.pwd) / 100);
  const others = Math.max(
    0,
    expectedTotalEvacuees - adults - children - pwd
  );

  return { adults, children, pwd, others };
}

function loadPopulationDemographicMixFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION_DEMOGRAPHIC_MIX);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return normalizeDemographicMix(parsed);
  } catch {
    return null;
  }
}

function normalizeDemographicLocks(value: unknown): PopulationDemographicLocks | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const parsed = { ...DEFAULT_DEMOGRAPHIC_LOCKS };
  const hasValue = DEMOGRAPHIC_KEYS.some((key) => typeof candidate[key] === "boolean");
  if (!hasValue) return null;

  for (const key of DEMOGRAPHIC_KEYS) {
    const candidateValue = candidate[key];
    if (typeof candidateValue === "boolean") {
      parsed[key] = candidateValue;
    }
  }

  return parsed;
}

function loadPopulationDemographicLocksFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION_DEMOGRAPHIC_LOCKS);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return normalizeDemographicLocks(parsed);
  } catch {
    return null;
  }
}

function fixDemographicValuesForSum(values: PopulationDemographicMix) {
  const next = { ...values };
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...DEFAULT_DEMOGRAPHIC_MIX };
  if (total === 100) return next;

  let delta = 100 - total;
  for (const key of DEMOGRAPHIC_KEYS) {
    if (delta === 0) break;

    if (delta > 0) {
      const available = 100 - next[key];
      if (available <= 0) continue;
      const added = Math.min(available, delta);
      next[key] += added;
      delta -= added;
      continue;
    }

    const removable = next[key];
    if (removable <= 0) continue;
    const removed = Math.min(removable, -delta);
    next[key] -= removed;
    delta += removed;
  }

  // In case of edge cases where exact distribution is blocked by boundaries,
  // force a final correction onto the last bucket.
  if (delta !== 0) {
    const lastKey = DEMOGRAPHIC_KEYS[DEMOGRAPHIC_KEYS.length - 1];
    next[lastKey] = Math.max(0, Math.min(100, next[lastKey] + delta));
  }

  return next;
}

function buildDemographicMixByAdjustingOne(
  current: PopulationDemographicMix,
  nextKey: DemographicGroupKey,
  nextValue: number,
  locked: PopulationDemographicLocks
) {
  if (locked[nextKey]) return current;

  const clamped = Math.max(0, Math.min(100, Math.floor(nextValue)));
  const lockedOtherKeys = DEMOGRAPHIC_KEYS.filter((key) => key !== nextKey && locked[key]);
  const adjustableKeys = DEMOGRAPHIC_KEYS.filter((key) => key !== nextKey && !locked[key]);
  const lockedOtherTotal = lockedOtherKeys.reduce((sum, key) => sum + current[key], 0);
  const maxForNext = Math.max(0, 100 - lockedOtherTotal);
  const nextValueAdjusted = Math.min(clamped, maxForNext);
  const next: PopulationDemographicMix = {
    ...current,
    [nextKey]: nextValueAdjusted,
  };

  if (adjustableKeys.length === 0) {
    const leftover = Math.max(0, 100 - (lockedOtherTotal + nextValueAdjusted));
    if (leftover !== 0) {
      next[nextKey] = Math.min(100, next[nextKey] + leftover);
    }
    return fixDemographicValuesForSum(next);
  }

  const fixedForAdjustable = Math.max(0, 100 - nextValueAdjusted - lockedOtherTotal);
  const adjustableCurrentTotal = adjustableKeys.reduce((sum, key) => sum + current[key], 0);

  if (adjustableCurrentTotal === 0) {
    const base = Math.floor(fixedForAdjustable / adjustableKeys.length);
    let remainder = fixedForAdjustable - base * adjustableKeys.length;
    adjustableKeys.forEach((key) => {
      next[key] = base;
    });
    if (remainder > 0) {
      next[adjustableKeys[0]] = Math.min(100, next[adjustableKeys[0]] + remainder);
    }
    return fixDemographicValuesForSum(next);
  }

  adjustableKeys.forEach((key) => {
    const ratio = current[key] / adjustableCurrentTotal;
    next[key] = Math.round(ratio * fixedForAdjustable);
  });

  const adjustableTotal = adjustableKeys.reduce((sum, key) => sum + next[key], 0);
  const total = adjustableTotal + nextValueAdjusted + lockedOtherTotal;
  const delta = 100 - total;
  if (delta !== 0) {
    const keyToAdjust = adjustableKeys[adjustableKeys.length - 1];
    next[keyToAdjust] = Math.max(0, Math.min(100, next[keyToAdjust] + delta));
  }

  return fixDemographicValuesForSum(next);
}

function buildDemographicMixFromPreset(
  current: PopulationDemographicMix,
  preset: PopulationDemographicMix,
  locked: PopulationDemographicLocks
) {
  const unlocked = DEMOGRAPHIC_KEYS.filter((key) => !locked[key]);
  if (unlocked.length === 0) return { ...current };

  const lockedTotal = DEMOGRAPHIC_KEYS.filter((key) => locked[key]).reduce(
    (sum, key) => sum + current[key],
    0
  );
  const availableForUnlocked = Math.max(0, 100 - lockedTotal);
  if (availableForUnlocked === 0) return { ...current };

  const presetUnlockedTotal = unlocked.reduce((sum, key) => sum + preset[key], 0);
  const next = { ...current };

  if (presetUnlockedTotal === 0) {
    const base = Math.floor(availableForUnlocked / unlocked.length);
    let remainder = availableForUnlocked - base * unlocked.length;
    unlocked.forEach((key) => {
      next[key] = base;
    });
    if (remainder > 0) {
      next[unlocked[0]] = Math.min(100, next[unlocked[0]] + remainder);
    }
    return fixDemographicValuesForSum(next);
  }

  unlocked.forEach((key) => {
    const ratio = preset[key] / presetUnlockedTotal;
    next[key] = Math.round(ratio * availableForUnlocked);
  });

  return fixDemographicValuesForSum(next);
}

function buildLockedStateValue(state: PopulationDemographicLocks) {
  return DEMOGRAPHIC_KEYS.reduce((acc, key) => {
    acc[key] = !!state[key];
    return acc;
  }, {} as PopulationDemographicLocks);
}

function DemographicSplitBar({
  mix,
}: {
  mix: PopulationDemographicMix;
}) {
  return (
    <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-neutral-200 bg-neutral-200">
      <div className="h-full flex">
        {DEMOGRAPHIC_GROUPS.map((group) => (
          <div
            key={group.key}
            className={`h-full ${DEMOGRAPHIC_PALETTE[group.key]}`}
            style={{ width: `${mix[group.key]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function normalizePopulationRecord(value: unknown): PopulationRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const region = candidate.region;
  if (!isRegion(region)) return null;

  const municipalityCity =
    typeof candidate.municipalityCity === "string" ? candidate.municipalityCity.trim() : "";
  if (municipalityCity.length === 0) return null;

  const totalPopulation = parsePopulationCoordinate(candidate.totalPopulation);
  const atRiskPopulation = parsePopulationCoordinate(candidate.atRiskPopulation);
  const latitude = parsePopulationCoordinate(candidate.latitude);
  const longitude = parsePopulationCoordinate(candidate.longitude);

  if (
    totalPopulation === null ||
    atRiskPopulation === null ||
    latitude === null ||
    longitude === null ||
    totalPopulation < 0 ||
    atRiskPopulation < 0 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    id,
    region,
    municipalityCity,
    totalPopulation: Math.floor(totalPopulation),
    atRiskPopulation: Math.min(Math.floor(atRiskPopulation), Math.floor(totalPopulation)),
    latitude,
    longitude,
    notes:
      typeof candidate.notes === "string" && candidate.notes.trim().length > 0
        ? candidate.notes
        : undefined,
  };
}

function buildPopulationRecordFromDraft(
  draft: PopulationRecordDraft,
  existingId?: string
): PopulationRecord | null {
  const municipalityCity = draft.municipalityCity.trim();
  const totalPopulation = parsePositiveInteger(draft.totalPopulation);
  const atRiskPopulation = parsePositiveInteger(draft.atRiskPopulation);
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);

  if (
    !municipalityCity ||
    !isRegion(draft.region) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    id: existingId ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    region: draft.region,
    municipalityCity,
    totalPopulation,
    atRiskPopulation: Math.min(atRiskPopulation, totalPopulation),
    latitude,
    longitude,
    notes: draft.notes.trim().length > 0 ? draft.notes.trim() : undefined,
  };
}

function normalizePopulationScenarioSnapshot(value: unknown): PopulationScenarioSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!name) return null;
  if (!Array.isArray(candidate.records)) return null;

  const records = candidate.records
    .map((record) => normalizePopulationRecord(record))
    .filter((record): record is PopulationRecord => record !== null);
  if (records.length === 0) return null;

  const evacuationRate = parsePositiveInteger(String(candidate.evacuationRate ?? "65"));
  const demographicMix =
    normalizeDemographicMix(candidate.demographicMix) ?? { ...DEFAULT_DEMOGRAPHIC_MIX };
  const demographicLocks =
    normalizeDemographicLocks(candidate.demographicLocks) ?? { ...DEFAULT_DEMOGRAPHIC_LOCKS };
  const updatedAt =
    typeof candidate.updatedAt === "string" && candidate.updatedAt.trim().length > 0
      ? candidate.updatedAt
      : new Date().toISOString();

  return {
    name,
    records,
    evacuationRate: Math.min(100, evacuationRate),
    demographicMix,
    demographicLocks,
    updatedAt,
  };
}

function loadPopulationFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = parsed
      .map((record) => normalizePopulationRecord(record))
      .filter((record): record is PopulationRecord => record !== null);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function loadPopulationScenariosFromStorage() {
  if (typeof window === "undefined") return [] as PopulationScenarioSnapshot[];
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION_SCENARIOS);
  if (!raw) return [] as PopulationScenarioSnapshot[];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as PopulationScenarioSnapshot[];
    return parsed
      .map((scenario) => normalizePopulationScenarioSnapshot(scenario))
      .filter((scenario): scenario is PopulationScenarioSnapshot => scenario !== null);
  } catch {
    return [] as PopulationScenarioSnapshot[];
  }
}

function loadPopulationResolutionModeFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION_RESOLUTION_MODE);
  if (raw === "municipality" || raw === "subzones") return raw;
  return null;
}

function loadPopulationSubzoneCountFromStorage() {
  if (typeof window === "undefined") return POPULATION_SUBZONE_COUNT_MIN;
  const raw = window.localStorage.getItem(STORAGE_KEY_POPULATION_SUBZONE_COUNT);
  if (!raw) return POPULATION_SUBZONE_COUNT_MIN;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return POPULATION_SUBZONE_COUNT_MIN;
  return Math.max(
    POPULATION_SUBZONE_COUNT_MIN,
    Math.min(POPULATION_SUBZONE_COUNT_MAX, Math.floor(parsed))
  );
}

type PopulationProps = {
  shelters: ShelterRecord[];
  selectedHazard: HazardRecord | null;
  onPopulationCardFocus?: (municipality: string, latitude: number, longitude: number) => void;
};

const HAZARD_MAX_RADIUS_KM = 5.6;
const HAZARD_MIN_RADIUS_KM = 0.4;

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function parseCoordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pointInRing(point: [number, number], ring: [number, number][]) {
  const [longitude, latitude] = point;
  let isInside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    const doesIntersect =
      y1 > latitude !== y2 > latitude &&
      longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (doesIntersect) isInside = !isInside;
    j = i;
  }

  return isInside;
}

function parseHazardRing(geometry?: GeoJSON.Polygon) {
  if (!geometry) return null;
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
  const rawRing = geometry.coordinates[0];
  if (!Array.isArray(rawRing) || rawRing.length < 4) return null;

  const ring: [number, number][] = [];
  for (const rawCoordinate of rawRing) {
    if (!Array.isArray(rawCoordinate) || rawCoordinate.length < 2) continue;
    const longitude = parseCoordinate(rawCoordinate[0]);
    const latitude = parseCoordinate(rawCoordinate[1]);
    if (longitude === null || latitude === null) continue;
    ring.push([longitude, latitude]);
  }

  if (ring.length < 4) return null;
  return ring;
}

function haversineDistanceKm(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
) {
  const earthRadiusKm = 6371;
  const startLatitudeRadians = (startLatitude * Math.PI) / 180;
  const endLatitudeRadians = (endLatitude * Math.PI) / 180;
  const deltaLatitudeRadians = ((endLatitude - startLatitude) * Math.PI) / 180;
  const deltaLongitudeRadians = ((endLongitude - startLongitude) * Math.PI) / 180;
  const haversineTerm =
    Math.sin(deltaLatitudeRadians / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(deltaLongitudeRadians / 2) ** 2;
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversineTerm), Math.sqrt(1 - haversineTerm));
  return earthRadiusKm * angularDistance;
}

function estimateHazardRadiusKm(hazard: HazardRecord) {
  const baseBySeverity: Record<HazardRecord["severity"], number> = {
    Low: 1.6,
    Moderate: 2.4,
    High: 3.2,
    Critical: 4.2,
  };
  const leadTimeFactor = Math.max(0, hazard.forecastLeadHours) / 24;
  const radius = Math.min(
    HAZARD_MAX_RADIUS_KM,
    baseBySeverity[hazard.severity] + leadTimeFactor * 0.55
  );
  return Math.max(HAZARD_MIN_RADIUS_KM, Math.round(radius * 10) / 10);
}

function pointInsideHazardCoverage(
  record: PopulationRecord,
  hazard: HazardRecord
) {
  const byGeometry = parseHazardRing(hazard.isochroneGeometry);
  if (byGeometry) {
    return pointInRing([record.longitude, record.latitude], byGeometry);
  }

  const fallbackRadius = estimateHazardRadiusKm(hazard);
  const distance = haversineDistanceKm(
    record.latitude,
    record.longitude,
    hazard.latitude,
    hazard.longitude
  );

  return distance <= fallbackRadius;
}

function buildHazardDerivedAtRisk(
  records: PopulationRecord[],
  hazard: HazardRecord | null
) {
  if (!hazard) return new Map<string, number>();

  const affectedRecords = records.filter((record) => {
    const matchesMunicipality =
      normalizeText(record.municipalityCity) === normalizeText(hazard.municipalityCity);
    if (matchesMunicipality) return true;
    return pointInsideHazardCoverage(record, hazard);
  });

  const totalPopulation = affectedRecords.reduce((sum, record) => sum + record.totalPopulation, 0);
  const byId = new Map<string, number>();

  if (affectedRecords.length === 0 || totalPopulation === 0) {
    return byId;
  }

  const estimated = Math.min(
    hazard.estimatedAffectedPopulation,
    affectedRecords.reduce((sum, record) => sum + record.totalPopulation, 0)
  );

  let assignedTotal = 0;
  affectedRecords.forEach((record, index) => {
    const isLast = index === affectedRecords.length - 1;
    if (isLast) {
      byId.set(
        record.id,
        Math.min(Math.max(0, estimated - assignedTotal), record.totalPopulation)
      );
      return;
    }

    const share = record.totalPopulation / totalPopulation;
    const allocated = Math.max(0, Math.round(estimated * share));
    byId.set(record.id, Math.min(allocated, record.totalPopulation));
    assignedTotal += byId.get(record.id) ?? 0;
  });

  return byId;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Box className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <Text as="div" size="1" color="gray">
        {label}
      </Text>
      <Text as="div" size="4" weight="bold">
        {value}
      </Text>
    </Box>
  );
}

function DemographicSlider({
  label,
  value,
  onChange,
  remaining,
  locked,
  onToggleLock,
}: {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
  remaining: number;
  locked: boolean;
  onToggleLock: () => void;
}) {
  return (
    <Box className="rounded-md border border-neutral-200 p-2">
      <Flex align="center" justify="between" className="mb-2">
        <Text size="2" weight="medium">
          {label}
        </Text>
        <Flex align="center" gap="1">
          <TextField.Root
            size="2"
            value={String(value)}
            onChange={(event) => {
              const parsed = parsePositiveInteger(event.target.value);
              onChange(parsed);
            }}
            type="number"
            className="w-16 text-right"
            disabled={locked}
          />
          <button
            type="button"
            className="shelter-inline-button"
            onClick={onToggleLock}
            aria-pressed={locked}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
          <Text size="1" color="gray">
            %
          </Text>
        </Flex>
      </Flex>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={locked}
        onChange={(event) => onChange(Number(event.target.value))}
        step={1}
        className="w-full"
      />
      <Text size="1" color="gray" className="mt-1">
        Remaining: {remaining}%
      </Text>
    </Box>
  );
}

function Population({
  shelters,
  selectedHazard,
  onPopulationCardFocus,
}: PopulationProps) {
  const [records, setRecords] = useState<PopulationRecord[]>(
    () => loadPopulationFromStorage() ?? initialPopulationRecords
  );
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordDraft, setEditingRecordDraft] = useState<PopulationRecordDraft | null>(null);
  const [newRecordDraft, setNewRecordDraft] = useState<PopulationRecordDraft>(() =>
    createEmptyPopulationDraft()
  );
  const [scenarioNameInput, setScenarioNameInput] = useState("");
  const [scenarioNameToLoad, setScenarioNameToLoad] = useState("");
  const [scenarios, setScenarios] = useState<PopulationScenarioSnapshot[]>(() =>
    loadPopulationScenariosFromStorage()
  );
  const [selectedRegion, setSelectedRegion] = useState<"all" | Region>("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [populationResolutionMode, setPopulationResolutionMode] =
    useState<PopulationResolutionMode>(
      () => loadPopulationResolutionModeFromStorage() ?? "municipality"
    );
  const [populationSubzoneCount, setPopulationSubzoneCount] = useState<number>(
    () => loadPopulationSubzoneCountFromStorage()
  );
  const [evacuationRate, setEvacuationRate] = useState(65);
  const [isHazardAutoMode, setIsHazardAutoMode] = useState(false);
  const [demographicMix, setDemographicMix] = useState<PopulationDemographicMix>(
    () => loadPopulationDemographicMixFromStorage() ?? DEFAULT_DEMOGRAPHIC_MIX
  );
  const [demographicLocks, setDemographicLocks] = useState<PopulationDemographicLocks>(() =>
    buildLockedStateValue(loadPopulationDemographicLocksFromStorage() ?? DEFAULT_DEMOGRAPHIC_LOCKS)
  );

  const municipalityOptions = useMemo(() => {
    const scoped =
      selectedRegion === "all"
        ? records
        : records.filter((record) => record.region === selectedRegion);

    return [...new Set(scoped.map((record) => record.municipalityCity))].sort();
  }, [records, selectedRegion]);

  const hazardDerivedAtRisk = useMemo(
    () => buildHazardDerivedAtRisk(records, isHazardAutoMode ? selectedHazard : null),
    [isHazardAutoMode, records, selectedHazard]
  );

  const filteredRecords = useMemo(() => {
    const query = municipalityFilter.trim().toLowerCase();

    return records.filter((record) => {
      const matchesRegion = selectedRegion === "all" || record.region === selectedRegion;
      const matchesMunicipality =
        query.length === 0 || record.municipalityCity.toLowerCase() === query;

      return matchesRegion && matchesMunicipality;
    });
  }, [municipalityFilter, records, selectedRegion]);

  const filteredShelters = useMemo(() => {
    const query = municipalityFilter.trim().toLowerCase();

    return shelters.filter((shelter) => {
      const matchesRegion = selectedRegion === "all" || shelter.region === selectedRegion;
      const matchesMunicipality =
        query.length === 0 || shelter.municipalityCity.toLowerCase() === query;

      return matchesRegion && matchesMunicipality;
    });
  }, [municipalityFilter, shelters, selectedRegion]);

  const totals = useMemo(() => {
    const totalPopulation = filteredRecords.reduce(
      (sum, record) => sum + record.totalPopulation,
      0
    );
    const atRiskPopulation = filteredRecords.reduce((sum, record) => {
      const value =
        isHazardAutoMode && selectedHazard
          ? hazardDerivedAtRisk.get(record.id) ?? record.atRiskPopulation
          : record.atRiskPopulation;
      return sum + value;
    }, 0);
    const expectedEvacuees = Math.round((atRiskPopulation * evacuationRate) / 100);
    const shelterAvailableCapacity = filteredShelters.reduce(
      (sum, shelter) => sum + Math.max(0, shelter.capacity - shelter.occupancy),
      0
    );
    const shelterTotalCapacity = filteredShelters.reduce((sum, shelter) => sum + shelter.capacity, 0);
    const shortfall = expectedEvacuees - shelterAvailableCapacity;
    const exposedPercent =
      totalPopulation > 0 ? Math.round((atRiskPopulation / totalPopulation) * 100) : 0;
    const expectedByDemographic = computeExpectedByDemographic(
      expectedEvacuees,
      demographicMix
    );

    return {
      totalPopulation,
      atRiskPopulation,
      exposedPercent,
      expectedEvacuees,
      shelterAvailableCapacity,
      shelterTotalCapacity,
      shortfall,
      expectedByDemographic,
    };
  }, [
    filteredRecords,
    filteredShelters,
    evacuationRate,
    demographicMix,
    hazardDerivedAtRisk,
    isHazardAutoMode,
    selectedHazard,
  ]);

  const hazardIntersectionSummary = useMemo(() => {
    if (!selectedHazard) return null;

    const impacted = filteredRecords.filter((record) => pointInsideHazardCoverage(record, selectedHazard));
    const impactedSet = new Set(impacted.map((record) => record.id));
    const impactedPopulation = impacted.reduce((sum, record) => sum + record.totalPopulation, 0);
    const impactedAtRisk = impacted.reduce((sum, record) => {
      const value =
        isHazardAutoMode && selectedHazard
          ? hazardDerivedAtRisk.get(record.id) ?? record.atRiskPopulation
          : record.atRiskPopulation;
      return sum + value;
    }, 0);

    const municipalityMatchCount = filteredRecords.filter(
      (record) =>
        normalizeText(record.municipalityCity) === normalizeText(selectedHazard.municipalityCity)
    ).length;

    return {
      impactedCount: impactedSet.size,
      impactedPopulation,
      impactedAtRisk,
      municipalityMatchCount,
      coveragePercent:
        totals.totalPopulation > 0 ? Math.round((impactedPopulation / totals.totalPopulation) * 100) : 0,
    };
  }, [
    filteredRecords,
    hazardDerivedAtRisk,
    isHazardAutoMode,
    selectedHazard,
    totals.totalPopulation,
  ]);

  const shelterAllocation = useMemo(() => {
    const shelterPool = filteredShelters
      .map((shelter) => ({
        ...shelter,
        remainingCapacity: Math.max(0, shelter.capacity - shelter.occupancy),
      }))
      .sort((a, b) => b.remainingCapacity - a.remainingCapacity);

    const recordDemand = filteredRecords
      .map((record) => {
        const atRiskValue =
          isHazardAutoMode && selectedHazard
            ? hazardDerivedAtRisk.get(record.id) ?? record.atRiskPopulation
            : record.atRiskPopulation;
        const demand = Math.round(atRiskValue * (evacuationRate / 100));
        return { record, demand };
      })
      .filter((entry) => entry.demand > 0)
      .sort((a, b) => b.demand - a.demand);

    let totalAssigned = 0;
    const suggestions = recordDemand.map(({ record, demand }) => {
      const shelterCandidates = shelterPool
        .filter((candidate) => candidate.remainingCapacity > 0)
        .map((candidate) => ({
          shelter: candidate,
          distanceKm: haversineDistanceKm(
            record.latitude,
            record.longitude,
            candidate.latitude,
            candidate.longitude
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      let remainingDemand = demand;
      const assignments: Array<{
        shelterName: string;
        municipalityCity: string;
        distanceKm: number;
        allocated: number;
      }> = [];

      for (const candidate of shelterCandidates) {
        if (remainingDemand <= 0) break;
        if (candidate.shelter.remainingCapacity <= 0) continue;
        const allocated = Math.min(remainingDemand, candidate.shelter.remainingCapacity);
        if (allocated <= 0) continue;
        candidate.shelter.remainingCapacity -= allocated;
        remainingDemand -= allocated;
        assignments.push({
          shelterName: candidate.shelter.name,
          municipalityCity: candidate.shelter.municipalityCity,
          distanceKm: Math.round(candidate.distanceKm * 10) / 10,
          allocated,
        });
      }

      const assigned = demand - remainingDemand;
      totalAssigned += assigned;

      return {
        recordId: record.id,
        municipalityCity: record.municipalityCity,
        demand,
        assigned,
        shortfall: remainingDemand,
        assignments,
      };
    });

    const totalDemand = recordDemand.reduce((sum, entry) => sum + entry.demand, 0);
    const totalShortfall = Math.max(0, totalDemand - totalAssigned);

    return {
      suggestions,
      totalDemand,
      totalAssigned,
      totalShortfall,
    };
  }, [
    evacuationRate,
    filteredRecords,
    filteredShelters,
    hazardDerivedAtRisk,
    isHazardAutoMode,
    selectedHazard,
  ]);

  function updateAtRisk(id: string, value: number) {
    if (isHazardAutoMode && selectedHazard) return;
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        const nextAtRisk = Math.min(value, record.totalPopulation);
        return { ...record, atRiskPopulation: nextAtRisk };
      })
    );
  }

  function resetFilters() {
    setSelectedRegion("all");
    setMunicipalityFilter("");
  }

  useEffect(() => {
    if (!selectedHazard) {
      setIsHazardAutoMode(false);
      return;
    }

    setIsHazardAutoMode(true);
    setSelectedRegion(selectedHazard.region);
    const hasMatchingMunicipality = records.some(
      (record) =>
        normalizeText(record.municipalityCity) === normalizeText(selectedHazard.municipalityCity)
    );
    if (hasMatchingMunicipality) {
      setMunicipalityFilter(selectedHazard.municipalityCity);
    }
  }, [records, selectedHazard?.id, selectedHazard?.region, selectedHazard?.municipalityCity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_POPULATION, JSON.stringify(records));
    notifyPopulationDataUpdated();
  }, [records]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY_POPULATION_RESOLUTION_MODE,
      populationResolutionMode
    );
    window.localStorage.setItem(
      STORAGE_KEY_POPULATION_SUBZONE_COUNT,
      String(populationSubzoneCount)
    );
    notifyPopulationDataUpdated();
  }, [populationResolutionMode, populationSubzoneCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY_POPULATION_DEMOGRAPHIC_MIX,
      JSON.stringify(demographicMix)
    );
  }, [demographicMix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY_POPULATION_DEMOGRAPHIC_LOCKS,
      JSON.stringify(demographicLocks)
    );
  }, [demographicLocks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_POPULATION_SCENARIOS, JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    if (scenarios.length === 0) {
      setScenarioNameToLoad("");
      return;
    }
    if (scenarios.some((scenario) => scenario.name === scenarioNameToLoad)) return;
    setScenarioNameToLoad(scenarios[0].name);
  }, [scenarioNameToLoad, scenarios]);

  function resetPopulationRecords() {
    const confirmed = window.confirm(
      "Reset population records to the default seed data? This will discard current edits."
    );
    if (!confirmed) return;

    setRecords(
      initialPopulationRecords.map((record) => ({
        ...record,
      }))
    );
  }

  function updateDemographicShare(nextKey: DemographicGroupKey, nextValue: number) {
    setDemographicMix((current) =>
      buildDemographicMixByAdjustingOne(current, nextKey, nextValue, demographicLocks)
    );
  }

  function notifyPopulationDataUpdated() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(POPULATION_UPDATE_EVENT));
  }

  function toggleDemographicLock(nextKey: DemographicGroupKey) {
    setDemographicLocks((current) => ({
      ...current,
      [nextKey]: !current[nextKey],
    }));
  }

  function applyDemographicPreset(preset: PopulationDemographicMix) {
    setDemographicMix((current) => buildDemographicMixFromPreset(current, preset, demographicLocks));
  }

  function updatePopulationSubzoneCount(value: number) {
    const clamped = Math.max(
      POPULATION_SUBZONE_COUNT_MIN,
      Math.min(POPULATION_SUBZONE_COUNT_MAX, Math.floor(value))
    );
    setPopulationSubzoneCount(clamped);
  }

  function beginEditRecord(record: PopulationRecord) {
    setEditingRecordId(record.id);
    setEditingRecordDraft(createPopulationDraftFromRecord(record));
  }

  function cancelEditRecord() {
    setEditingRecordId(null);
    setEditingRecordDraft(null);
  }

  function updateEditingDraft(
    key: keyof PopulationRecordDraft,
    value: string | Region
  ) {
    setEditingRecordDraft((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  }

  function saveEditingRecord() {
    if (!editingRecordId || !editingRecordDraft) return;
    const nextRecord = buildPopulationRecordFromDraft(editingRecordDraft, editingRecordId);
    if (!nextRecord) {
      window.alert("Please complete municipality, region, latitude, and longitude.");
      return;
    }

    setRecords((current) =>
      current.map((record) => (record.id === editingRecordId ? nextRecord : record))
    );
    cancelEditRecord();
  }

  function deleteRecord(recordId: string) {
    const confirmed = window.confirm("Delete this population record?");
    if (!confirmed) return;
    setRecords((current) => current.filter((record) => record.id !== recordId));
    if (editingRecordId === recordId) cancelEditRecord();
  }

  function updateNewRecordDraft(
    key: keyof PopulationRecordDraft,
    value: string | Region
  ) {
    setNewRecordDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addRecord() {
    const nextRecord = buildPopulationRecordFromDraft(newRecordDraft);
    if (!nextRecord) {
      window.alert("Please complete municipality, region, latitude, and longitude.");
      return;
    }

    setRecords((current) => [nextRecord, ...current]);
    setNewRecordDraft(createEmptyPopulationDraft());
  }

  function saveScenarioSnapshot() {
    const scenarioName = scenarioNameInput.trim();
    if (!scenarioName) {
      window.alert("Enter a scenario name first.");
      return;
    }

    const snapshot: PopulationScenarioSnapshot = {
      name: scenarioName,
      records: records.map((record) => ({ ...record })),
      evacuationRate,
      demographicMix: { ...demographicMix },
      demographicLocks: { ...demographicLocks },
      updatedAt: new Date().toISOString(),
    };

    setScenarios((current) => {
      const index = current.findIndex((entry) => normalizeText(entry.name) === normalizeText(scenarioName));
      if (index < 0) {
        return [snapshot, ...current].sort((a, b) => a.name.localeCompare(b.name));
      }

      const next = [...current];
      next[index] = snapshot;
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setScenarioNameToLoad(scenarioName);
  }

  function loadScenarioSnapshot() {
    if (!scenarioNameToLoad) return;
    const scenario = scenarios.find((entry) => entry.name === scenarioNameToLoad);
    if (!scenario) return;

    setRecords(scenario.records.map((record) => ({ ...record })));
    setEvacuationRate(scenario.evacuationRate);
    setDemographicMix({ ...scenario.demographicMix });
    setDemographicLocks({ ...scenario.demographicLocks });
    cancelEditRecord();
  }

  function deleteScenarioSnapshot() {
    if (!scenarioNameToLoad) return;
    const confirmed = window.confirm(`Delete scenario '${scenarioNameToLoad}'?`);
    if (!confirmed) return;
    setScenarios((current) => current.filter((scenario) => scenario.name !== scenarioNameToLoad));
  }

  const demographicMixTotal = useMemo(
    () => Object.values(demographicMix).reduce((sum, value) => sum + value, 0),
    [demographicMix]
  );

  return (
    <Flex direction="column" gap="3" className="max-h-[88vh] overflow-y-auto pr-1">
      <Heading size="8">Population</Heading>
      <Text size="2" color="gray">
        Use this panel to track planning population figures, estimate exposed people, and
        compare demand against shelter capacity.
      </Text>

      <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <Text as="div" size="2" weight="bold">
          Planning Note
        </Text>
        <Text as="div" size="1" color="gray">
          Numbers are planning estimates and should be reconciled with local response updates.
        </Text>
      </Box>

      {selectedHazard && (
        <Box className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <Text as="div" size="2" weight="bold">
            Hazard Link
          </Text>
          <Text as="div" size="1" color="gray" className="mt-1">
            Using hazard: {selectedHazard.name} ({selectedHazard.municipalityCity},{" "}
            {selectedHazard.region})
          </Text>
          <Text as="div" size="1" color="gray" className="mt-1">
            At-risk and evacuation estimates are currently {isHazardAutoMode ? "auto" : "manual"}{" "}
            for this hazard.
          </Text>
          {isHazardAutoMode && (
            <button
              type="button"
              className="shelter-inline-button mt-1"
              onClick={() => setIsHazardAutoMode(false)}
            >
              Switch to manual values
            </button>
          )}
          {!isHazardAutoMode && (
            <button
              type="button"
              className="shelter-inline-button mt-1"
              onClick={() => setIsHazardAutoMode(true)}
            >
              Re-apply auto values from selected hazard
            </button>
          )}
        </Box>
      )}

      <Grid columns="2" gap="2">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Region
          </Text>
          <Select.Root
            value={selectedRegion}
            onValueChange={(value) => setSelectedRegion(value as "all" | Region)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="all">All Regions</Select.Item>
              {regionOptions.map((region) => (
                <Select.Item key={region} value={region}>
                  {region}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Municipality / City
          </Text>
          <TextField.Root
            value={municipalityFilter}
            onChange={(event) => setMunicipalityFilter(event.target.value)}
            placeholder="Type exact municipality/city"
          />
          <Text size="1" color="gray">
            Existing entries: {municipalityOptions.join(", ") || "none"}
          </Text>
        </Flex>
      </Grid>

      <Grid columns="2" gap="2">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Population Map View
          </Text>
          <Select.Root
            value={populationResolutionMode}
            onValueChange={(value) =>
              setPopulationResolutionMode(value as PopulationResolutionMode)
            }
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="municipality">Municipality</Select.Item>
              <Select.Item value="subzones">Barangay-like Subzones</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Subzone Count (per municipality)
          </Text>
          <TextField.Root
            value={String(populationSubzoneCount)}
            type="number"
            min={String(POPULATION_SUBZONE_COUNT_MIN)}
            max={String(POPULATION_SUBZONE_COUNT_MAX)}
            disabled={populationResolutionMode !== "subzones"}
            onChange={(event) =>
              updatePopulationSubzoneCount(parsePositiveInteger(event.target.value))
            }
          />
          <Text size="1" color="gray">
            {populationResolutionMode === "subzones"
              ? `Each municipality is split into ${populationSubzoneCount} map zones.`
              : "Enable Subzones to view granular population sectors."}
          </Text>
        </Flex>
      </Grid>

      <Box className="rounded-lg border border-neutral-200 p-3">
        <Text as="div" size="2" weight="bold">
          Scenario Snapshots
        </Text>
        <Text as="div" size="1" color="gray" className="mt-1">
          Save and restore population assumptions, evacuation rate, and demographic split.
        </Text>
        <Grid columns="2" gap="2" className="mt-2">
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              Snapshot Name
            </Text>
            <TextField.Root
              value={scenarioNameInput}
              onChange={(event) => setScenarioNameInput(event.target.value)}
              placeholder="e.g. Flood Morning Shift"
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              Saved Snapshots
            </Text>
            {scenarios.length > 0 && (
              <Select.Root value={scenarioNameToLoad} onValueChange={setScenarioNameToLoad}>
                <Select.Trigger />
                <Select.Content>
                  {scenarios.map((scenario) => (
                    <Select.Item key={scenario.name} value={scenario.name}>
                      {scenario.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}
            {scenarios.length === 0 && (
              <Text size="1" color="gray">
                No snapshots yet
              </Text>
            )}
          </Flex>
        </Grid>
        <Flex gap="2" className="mt-2">
          <button type="button" className="shelter-inline-button" onClick={saveScenarioSnapshot}>
            Save Snapshot
          </button>
          <button
            type="button"
            className="shelter-inline-button"
            onClick={loadScenarioSnapshot}
            disabled={!scenarioNameToLoad || scenarios.length === 0}
          >
            Load Snapshot
          </button>
          <button
            type="button"
            className="shelter-inline-button"
            onClick={deleteScenarioSnapshot}
            disabled={!scenarioNameToLoad || scenarios.length === 0}
          >
            Delete Snapshot
          </button>
        </Flex>
      </Box>

      {selectedHazard && hazardIntersectionSummary && (
        <Box className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Text as="div" size="2" weight="bold">
            Hazard Intersection
          </Text>
          <Text as="div" size="1" color="gray" className="mt-1">
            Impact summary for hazard: {selectedHazard.name}
          </Text>
          <Grid columns="2" gap="2" className="mt-2">
            <MetricCard label="Impacted Municipalities" value={hazardIntersectionSummary.impactedCount.toString()} />
            <MetricCard label="Coverage Share" value={`${hazardIntersectionSummary.coveragePercent}%`} />
            <MetricCard
              label="Impacted Population"
              value={hazardIntersectionSummary.impactedPopulation.toLocaleString()}
            />
            <MetricCard
              label="Impacted At-Risk"
              value={hazardIntersectionSummary.impactedAtRisk.toLocaleString()}
            />
          </Grid>
          <Text as="div" size="1" color="gray" className="mt-2">
            Municipality match count: {hazardIntersectionSummary.municipalityMatchCount}
          </Text>
        </Box>
      )}

      <Grid columns="2" gap="2">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Evacuation Rate (%)
          </Text>
          <TextField.Root
            value={String(evacuationRate)}
            type="number"
            onChange={(event) =>
              setEvacuationRate(Math.min(100, parsePositiveInteger(event.target.value)))
            }
          />
        </Flex>

        <Flex direction="column" justify="end" gap="1">
          <button type="button" className="shelter-inline-button" onClick={resetFilters}>
            Reset Filters
          </button>
          <button type="button" className="shelter-inline-button" onClick={resetPopulationRecords}>
            Reset Population Data
          </button>
        </Flex>
      </Grid>

      <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <Text as="div" size="2" weight="bold">
          Demographic Mix
        </Text>
        <Text as="div" size="1" color="gray" className="mt-1">
          Distribution used for projected evacuee estimates. The shares auto-balance to total 100%.
        </Text>
        <Text as="div" size="1" color="gray" className="mt-2">
          Presets
        </Text>
        <Flex className="mt-1 flex-wrap gap-2">
          {DEMOGRAPHIC_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="shelter-inline-button"
              onClick={() => applyDemographicPreset(preset.mix)}
            >
              {preset.label}
            </button>
          ))}
        </Flex>
        <Flex justify="between" align="center" className="mt-2">
          <Text size="1" weight="bold">
            Total: {demographicMixTotal}%
          </Text>
          <Text size="1" color="gray">
            Adjust any group to rebalance the remaining distribution
          </Text>
        </Flex>
        <DemographicSplitBar mix={demographicMix} />
        <Grid columns="2" gap="2" className="mt-2">
          {DEMOGRAPHIC_GROUPS.map((group) => (
            <DemographicSlider
              key={group.key}
              label={group.label}
              value={demographicMix[group.key]}
              onChange={(nextValue) => updateDemographicShare(group.key, nextValue)}
              remaining={Math.max(0, 100 - demographicMixTotal + demographicMix[group.key])}
              locked={demographicLocks[group.key]}
              onToggleLock={() => toggleDemographicLock(group.key)}
            />
          ))}
        </Grid>
      </Box>

      <Grid columns="2" gap="2">
        <MetricCard label="Total Population" value={totals.totalPopulation.toLocaleString()} />
        <MetricCard label="Population at Risk" value={totals.atRiskPopulation.toLocaleString()} />
        <MetricCard label="At Risk Share" value={`${totals.exposedPercent.toLocaleString()}%`} />
        <MetricCard label="Expected Evacuees" value={totals.expectedEvacuees.toLocaleString()} />
        <MetricCard
          label="Shelter Available Seats"
          value={totals.shelterAvailableCapacity.toLocaleString()}
        />
        <MetricCard
          label="Total Shelter Capacity"
          value={totals.shelterTotalCapacity.toLocaleString()}
        />
        <MetricCard
          label="Shortfall"
          value={totals.shortfall > 0 ? `${totals.shortfall.toLocaleString()} seats` : "Adequate"}
        />
      </Grid>

      <Box className="rounded-lg border border-neutral-200 p-3">
        <Text size="2" weight="bold">
          Shelter Allocation Suggestions
        </Text>
        <Text size="1" color="gray" className="mt-1">
          Suggested nearest-capacity assignments based on current filtered shelters.
        </Text>
        <Grid columns="3" gap="2" className="mt-2">
          <MetricCard label="Evacuee Demand" value={shelterAllocation.totalDemand.toLocaleString()} />
          <MetricCard label="Allocated" value={shelterAllocation.totalAssigned.toLocaleString()} />
          <MetricCard
            label="Remaining Shortfall"
            value={
              shelterAllocation.totalShortfall > 0
                ? shelterAllocation.totalShortfall.toLocaleString()
                : "0"
            }
          />
        </Grid>
        <Flex direction="column" gap="2" className="mt-3 max-h-[220px] overflow-y-auto pr-1">
          {shelterAllocation.suggestions.slice(0, 8).map((suggestion) => (
            <Box key={suggestion.recordId} className="rounded-md border border-neutral-200 p-2">
              <Text as="div" size="2" weight="medium">
                {suggestion.municipalityCity}
              </Text>
              <Text as="div" size="1" color="gray">
                Demand {suggestion.demand.toLocaleString()} • Assigned {suggestion.assigned.toLocaleString()} •
                Shortfall {suggestion.shortfall.toLocaleString()}
              </Text>
              {suggestion.assignments.length > 0 && (
                <Text as="div" size="1" color="gray" className="mt-1">
                  {suggestion.assignments
                    .slice(0, 3)
                    .map(
                      (assignment) =>
                        `${assignment.shelterName} (${assignment.municipalityCity}, ${assignment.distanceKm} km): ${assignment.allocated.toLocaleString()}`
                    )
                    .join(" | ")}
                </Text>
              )}
            </Box>
          ))}
          {shelterAllocation.suggestions.length === 0 && (
            <Text size="1" color="gray">
              No demand rows available for allocation in the current filters.
            </Text>
          )}
        </Flex>
      </Box>

      <Box className="rounded-lg border border-neutral-200 p-3">
        <Text size="2" weight="bold">
          Expected Evacuee Mix
        </Text>
        <DemographicSplitBar mix={demographicMix} />
        <Grid columns="2" gap="2" className="mt-2">
          <MetricCard
            label={`Adults (${demographicMix.adults}%)`}
            value={totals.expectedByDemographic.adults.toLocaleString()}
          />
          <MetricCard
            label={`Children (${demographicMix.children}%)`}
            value={totals.expectedByDemographic.children.toLocaleString()}
          />
          <MetricCard
            label={`PWDs (${demographicMix.pwd}%)`}
            value={totals.expectedByDemographic.pwd.toLocaleString()}
          />
          <MetricCard
            label={`Others (${demographicMix.others}%)`}
            value={totals.expectedByDemographic.others.toLocaleString()}
          />
        </Grid>
      </Box>

      <Box className="rounded-lg border border-neutral-200 p-3">
        <Flex align="start" direction="column" gap="2">
          <Text size="2" weight="bold">
            Population records
          </Text>
          <Text size="1" color="gray">
            {isHazardAutoMode && selectedHazard
              ? "At-risk values are auto-derived for municipalities in selected hazard impact."
              : "Edit the at-risk values below to reflect latest barangay/city assessments."}
          </Text>
        </Flex>

        <Box className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <Text as="div" size="2" weight="bold">
            Add Record
          </Text>
          <Grid columns="2" gap="2" className="mt-2">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Region
              </Text>
              <Select.Root
                value={newRecordDraft.region}
                onValueChange={(value) => updateNewRecordDraft("region", value as Region)}
              >
                <Select.Trigger />
                <Select.Content>
                  {regionOptions.map((region) => (
                    <Select.Item key={region} value={region}>
                      {region}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Municipality / City
              </Text>
              <TextField.Root
                value={newRecordDraft.municipalityCity}
                onChange={(event) => updateNewRecordDraft("municipalityCity", event.target.value)}
                placeholder="e.g. Tacloban City"
              />
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Total Population
              </Text>
              <TextField.Root
                type="number"
                value={newRecordDraft.totalPopulation}
                onChange={(event) => updateNewRecordDraft("totalPopulation", event.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                At-Risk Population
              </Text>
              <TextField.Root
                type="number"
                value={newRecordDraft.atRiskPopulation}
                onChange={(event) => updateNewRecordDraft("atRiskPopulation", event.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Latitude
              </Text>
              <TextField.Root
                type="number"
                value={newRecordDraft.latitude}
                onChange={(event) => updateNewRecordDraft("latitude", event.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Longitude
              </Text>
              <TextField.Root
                type="number"
                value={newRecordDraft.longitude}
                onChange={(event) => updateNewRecordDraft("longitude", event.target.value)}
              />
            </Flex>
          </Grid>
          <Flex direction="column" gap="1" className="mt-2">
            <Text size="1" color="gray">
              Notes
            </Text>
            <TextField.Root
              value={newRecordDraft.notes}
              onChange={(event) => updateNewRecordDraft("notes", event.target.value)}
              placeholder="Optional planning notes"
            />
          </Flex>
          <Flex gap="2" className="mt-2">
            <button type="button" className="shelter-inline-button" onClick={addRecord}>
              Add Population Record
            </button>
            <button
              type="button"
              className="shelter-inline-button"
              onClick={() => setNewRecordDraft(createEmptyPopulationDraft())}
            >
              Clear Form
            </button>
          </Flex>
        </Box>

        <Flex direction="column" gap="2" className="mt-3">
          {filteredRecords.map((record) => {
            const expectedForRecord = Math.round(
              (isHazardAutoMode && selectedHazard
                ? hazardDerivedAtRisk.get(record.id) ?? record.atRiskPopulation
                : record.atRiskPopulation) * (evacuationRate / 100)
            );
            const atRiskValue =
              isHazardAutoMode && selectedHazard
                ? hazardDerivedAtRisk.get(record.id) ?? record.atRiskPopulation
                : record.atRiskPopulation;
            const expectedByDemographic = computeExpectedByDemographic(
              expectedForRecord,
              demographicMix
            );
            const isEditing = editingRecordId === record.id && editingRecordDraft !== null;
            const canFocusOnMap =
              !isEditing && Number.isFinite(record.latitude) && Number.isFinite(record.longitude);

            return (
              <Box
                key={record.id}
                role={canFocusOnMap ? "button" : undefined}
                tabIndex={canFocusOnMap ? 0 : undefined}
                onClick={() => {
                  if (!canFocusOnMap || !onPopulationCardFocus) return;
                  onPopulationCardFocus(
                    record.municipalityCity,
                    record.latitude,
                    record.longitude
                  );
                }}
                onKeyDown={(event) => {
                  if (!canFocusOnMap || !onPopulationCardFocus) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPopulationCardFocus(
                      record.municipalityCity,
                      record.latitude,
                      record.longitude
                    );
                  }
                }}
                className={`rounded-md border border-neutral-200 p-3 ${
                  canFocusOnMap ? "cursor-pointer transition hover:bg-neutral-50" : ""
                }`}
              >
                {!isEditing && (
                  <Grid columns="2" gap="2">
                    <Flex align="start" justify="between" className="col-span-2">
                      <Text as="div" size="2" weight="bold">
                        {record.region} - {record.municipalityCity}
                      </Text>
                      <Flex gap="2">
                        <button
                          type="button"
                          className="shelter-inline-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEditRecord(record);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="shelter-inline-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteRecord(record.id);
                          }}
                        >
                          Delete
                        </button>
                      </Flex>
                    </Flex>
                    <Text as="div" size="1" color="gray" className="col-span-2">
                      {record.notes || "No notes provided."}
                    </Text>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        Total Population
                      </Text>
                      <TextField.Root value={String(record.totalPopulation)} disabled />
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        At-Risk Population {isHazardAutoMode && selectedHazard ? "(auto)" : ""}
                      </Text>
                      <TextField.Root
                        value={String(atRiskValue)}
                        type="number"
                        disabled={isHazardAutoMode && !!selectedHazard}
                        onChange={(event) =>
                          updateAtRisk(record.id, parsePositiveInteger(event.target.value))
                        }
                      />
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        Share of Local Population
                      </Text>
                      <Text size="2" weight="medium">
                        {record.totalPopulation === 0
                          ? "0"
                          : Math.round((atRiskValue / record.totalPopulation) * 100)}
                        %
                      </Text>
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        Expected Evacuees
                      </Text>
                      <Text size="2" weight="medium">
                        {expectedForRecord.toLocaleString()}
                      </Text>
                      <Text size="1" color="gray">
                        Adults {expectedByDemographic.adults.toLocaleString()} • Children{" "}
                        {expectedByDemographic.children.toLocaleString()} • PWDs{" "}
                        {expectedByDemographic.pwd.toLocaleString()} • Others{" "}
                        {expectedByDemographic.others.toLocaleString()}
                      </Text>
                    </Flex>
                  </Grid>
                )}

                {isEditing && editingRecordDraft && (
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">
                      Edit Record
                    </Text>
                    <Grid columns="2" gap="2">
                      <Select.Root
                        value={editingRecordDraft.region}
                        onValueChange={(value) => updateEditingDraft("region", value as Region)}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          {regionOptions.map((region) => (
                            <Select.Item key={region} value={region}>
                              {region}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                      <TextField.Root
                        value={editingRecordDraft.municipalityCity}
                        onChange={(event) =>
                          updateEditingDraft("municipalityCity", event.target.value)
                        }
                        placeholder="Municipality / City"
                      />
                      <TextField.Root
                        type="number"
                        value={editingRecordDraft.totalPopulation}
                        onChange={(event) =>
                          updateEditingDraft("totalPopulation", event.target.value)
                        }
                        placeholder="Total Population"
                      />
                      <TextField.Root
                        type="number"
                        value={editingRecordDraft.atRiskPopulation}
                        onChange={(event) =>
                          updateEditingDraft("atRiskPopulation", event.target.value)
                        }
                        placeholder="At-Risk Population"
                      />
                      <TextField.Root
                        type="number"
                        value={editingRecordDraft.latitude}
                        onChange={(event) => updateEditingDraft("latitude", event.target.value)}
                        placeholder="Latitude"
                      />
                      <TextField.Root
                        type="number"
                        value={editingRecordDraft.longitude}
                        onChange={(event) => updateEditingDraft("longitude", event.target.value)}
                        placeholder="Longitude"
                      />
                    </Grid>
                    <TextField.Root
                      value={editingRecordDraft.notes}
                      onChange={(event) => updateEditingDraft("notes", event.target.value)}
                      placeholder="Notes"
                    />
                    <Flex gap="2">
                      <button type="button" className="shelter-inline-button" onClick={saveEditingRecord}>
                        Save
                      </button>
                      <button type="button" className="shelter-inline-button" onClick={cancelEditRecord}>
                        Cancel
                      </button>
                    </Flex>
                  </Flex>
                )}
              </Box>
            );
          })}

          {filteredRecords.length === 0 && (
            <Box className="rounded-md border border-dashed border-neutral-300 px-3 py-5 text-center">
              <Text size="2" color="gray">
                No population records found for the selected filters.
              </Text>
            </Box>
          )}
        </Flex>
      </Box>
    </Flex>
  );
}

export default Population;
