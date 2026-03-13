import { useEffect, useMemo, useRef, useState } from "react";
import type { MapGeoJSONFeature } from "maplibre-gl";
import MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import { type ShelterRecord } from "./shelterData";
import { type HazardRecord } from "./hazardData";
import LayerManagementPanel from "./map/layerManagement/LayerManagementPanel";
import {
  cloneLayerConfigs,
  createDefaultLayerStack,
  createLayerConfig,
  createDefaultLayerStyle,
  ALL_LAYER_KINDS,
  normalizeLayerOrder,
  getLayerLabelForKind,
} from "./map/layerManagement/config";
import {
  getFilteredShelters,
  getInteractiveLayerIds,
  syncManagedLayers,
} from "./map/layerManagement/mapSync";
import { STATUS_OPTIONS, type LayerConfig, type LayerKind } from "./map/layerManagement/types";
import minimizeIcon from "./assets/icons/minimize.png";

const STORAGE_KEY_LAYER_PRESET = "arus-evac-layer-management.saved-preset.v1";
const STORAGE_KEY_LAYER_STACK = "arus-evac-layer-management.layer-stack.v1";
const STORAGE_KEY_LAYER_VISIBILITY_PRESETS = "arus-evac-layer-management.layer-visibility-presets.v1";
const DEFAULT_VISIBILITY_PRESET_PURPOSE = "General";
const HAZARD_SOURCE_ID = "hazard-isochrones-source";
const HAZARD_FILL_LAYER_ID = "hazard-isochrones-fill-layer";
const HAZARD_OUTLINE_LAYER_ID = "hazard-isochrones-outline-layer";
const POPULATION_SOURCE_ID = "population-points-source";
const POPULATION_POLYGON_LAYER_ID = "population-polygons-layer";
const POPULATION_OUTLINE_LAYER_ID = "population-polygons-outline-layer";
const POPULATION_SUBZONE_LABEL_LAYER_ID = "population-subzone-label-layer";
const POPULATION_SELECTED_LAYER_ID = "population-points-selected-layer";
const HAZARD_MIN_RADIUS_KM = 0.2;
const HAZARD_MAX_RADIUS_KM = 5.6;
const HAZARD_MIN_GAP_KM = 0.9;
const HAZARD_FREEFORM_SEGMENTS = 16;
const HAZARD_FREEFORM_JITTER = 0.34;
const HAZARD_RADIUS_GROWTH_RATE = 0.45;
const HAZARD_RADIUS_GROWTH_OFFSET_KM = 0.25;
const POPULATION_MIN_RADIUS_KM = 0.35;
const POPULATION_MAX_RADIUS_KM = 4.4;
const POPULATION_MIN_GAP_KM = 0.6;
const POPULATION_SEGMENTS = 10;
const POPULATION_JITTER = 0.3;
const POPULATION_STORAGE_KEY = "arus-evac.population.v1";
const POPULATION_UPDATE_EVENT = "arus-evac:population-updated";
const POPULATION_RESOLUTION_MODE_STORAGE_KEY = "arus-evac.population.resolution-mode.v1";
const POPULATION_SUBZONE_COUNT_STORAGE_KEY = "arus-evac.population.subzone-count.v1";
const POPULATION_SUBZONE_COUNT_MIN = 2;
const POPULATION_SUBZONE_COUNT_MAX = 8;

type HazardIsochroneSource = {
  hazardId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  baseRadiusKm: number;
};

function sanitizeStatus(value: unknown): ShelterRecord["status"] {
  if (value === "Open" || value === "Limited" || value === "Full") return value;
  return "Open";
}

type PopulationRecord = {
  id: string;
  region: string;
  municipalityCity: string;
  totalPopulation: number;
  atRiskPopulation: number;
  latitude: number;
  longitude: number;
  notes?: string;
};

type PopulationResolutionMode = "municipality" | "subzones";

type PopulationIsochroneSource = {
  populationId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  baseRadiusKm: number;
};

function sanitizeLayerKind(value: unknown): LayerKind | null {
  if (typeof value === "string" && ALL_LAYER_KINDS.includes(value as LayerKind)) {
    return value as LayerKind;
  }
  return null;
}

function sanitizeLayerConfig(value: unknown): LayerConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const kind = sanitizeLayerKind(candidate.kind);
  if (!kind) return null;

  const filters = candidate.filters && typeof candidate.filters === "object" ? candidate.filters : {};
  const filterRegion =
    typeof (filters as Record<string, unknown>).region === "string"
      ? String((filters as Record<string, unknown>).region)
      : "all";
  const filterMunicipalityCity =
    typeof (filters as Record<string, unknown>).municipalityCity === "string"
      ? String((filters as Record<string, unknown>).municipalityCity)
      : "";
  const filterStatuses = Array.isArray((filters as Record<string, unknown>).statuses)
    ? ((filters as Record<string, unknown>).statuses as unknown[]).map((status) =>
        sanitizeStatus(status)
      )
    : [...STATUS_OPTIONS];

  const normalizedFilters = {
    region: filterRegion as LayerConfig["filters"]["region"],
    municipalityCity: filterMunicipalityCity,
    statuses:
      filterStatuses.length === 0 ? ([...STATUS_OPTIONS] as ShelterRecord["status"][]) : Array.from(
        new Set(filterStatuses)
      ),
  };
  const normalizedGroup =
    candidate.group === "Hazards"
      ? "Hazards"
      : candidate.group === "Population"
      ? "Population"
      : "Shelters";

  const style = candidate.style && typeof candidate.style === "object" ? candidate.style : {};
  const normalizedStyle = {
    ...createDefaultLayerStyle(kind),
    ...(style as Record<string, unknown>),
  };
  const normalizedStyleWithNumbers = {
    opacity: Number.isFinite(normalizedStyle.opacity as number) ? (normalizedStyle.opacity as number) : 0,
    iconSize: Number.isFinite(normalizedStyle.iconSize as number)
      ? (normalizedStyle.iconSize as number)
      : 0,
    radius: Number.isFinite(normalizedStyle.radius as number) ? (normalizedStyle.radius as number) : 0,
    strokeWidth: Number.isFinite(normalizedStyle.strokeWidth as number)
      ? (normalizedStyle.strokeWidth as number)
      : 0,
  };

  return {
    id:
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name:
      typeof candidate.name === "string" && candidate.name.length > 0
        ? candidate.name
        : getLayerLabelForKind(kind),
    group: normalizedGroup,
    visible:
      typeof candidate.visible === "boolean" ? candidate.visible : true,
    order:
      typeof candidate.order === "number" && Number.isFinite(candidate.order)
        ? candidate.order
        : 0,
    filters: {
      region: normalizedFilters.region,
      municipalityCity: filterMunicipalityCity,
      statuses: normalizedFilters.statuses,
    },
    style: normalizedStyleWithNumbers,
    timeSync:
      typeof candidate.timeSync === "boolean" ? candidate.timeSync : false,
  };
}

type LayerVisibilityPreset = Partial<Record<LayerKind, boolean>>;
type LayerVisibilityPresetStore = Record<string, LayerVisibilityPreset>;
type ActivePanel = "home" | "typhoon" | "hazardManagement" | "population";

function createVisibilityPresetWithVisibleKinds(visibleKinds: LayerKind[]) {
  const visibleKindSet = new Set(visibleKinds);
  return ALL_LAYER_KINDS.reduce<LayerVisibilityPreset>((acc, kind) => {
    acc[kind] = visibleKindSet.has(kind);
    return acc;
  }, {});
}

const BUILTIN_LAYER_VISIBILITY_PRESETS: LayerVisibilityPresetStore = {
  General: createVisibilityPresetWithVisibleKinds(ALL_LAYER_KINDS),
  Shelter: createVisibilityPresetWithVisibleKinds([
    "shelterPins",
    "shelterStatusHalo",
    "selectedShelterHighlight",
  ]),
  Hazards: createVisibilityPresetWithVisibleKinds(["hazardFill", "hazardOutline"]),
  Population: createVisibilityPresetWithVisibleKinds([
    "populationPolygons",
    "populationOutlines",
    "populationSelection",
  ]),
};

function getVisibilityPurposeForPanel(activePanel: ActivePanel) {
  if (activePanel === "home") return "Shelter";
  if (activePanel === "population") return "Population";
  if (activePanel === "hazardManagement" || activePanel === "typhoon") return "Hazards";
  return "General";
}

function sanitizeLayerVisibilityPresetStore(value: unknown): LayerVisibilityPresetStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: LayerVisibilityPresetStore = {};
  const candidates = value as Record<string, unknown>;

  Object.entries(candidates).forEach(([purpose, rawPreset]) => {
    if (typeof purpose !== "string") return;
    const normalizedPurpose = purpose.trim();
    if (!normalizedPurpose) return;

    if (!rawPreset || typeof rawPreset !== "object" || Array.isArray(rawPreset)) return;
    const preset: LayerVisibilityPreset = {};
    const entries = rawPreset as Record<string, unknown>;

    Object.entries(entries).forEach(([kindValue, visibility]) => {
      const kind = sanitizeLayerKind(kindValue);
      if (!kind || typeof visibility !== "boolean") return;
      preset[kind] = visibility;
    });

    if (Object.keys(preset).length > 0) {
      result[normalizedPurpose] = preset;
    }
  });

  return result;
}

function toSortedPresetPurposeList(presetStore: LayerVisibilityPresetStore) {
  return Object.keys(presetStore).sort((a, b) => a.localeCompare(b));
}

function snapshotLayerVisibility(layerConfigs: LayerConfig[]) {
  return layerConfigs.reduce<LayerVisibilityPreset>((acc, layerConfig) => {
    acc[layerConfig.kind] = layerConfig.visible;
    return acc;
  }, {});
}

function applyLayerVisibilitySnapshot(
  layerConfigs: LayerConfig[],
  snapshot: LayerVisibilityPreset | null
) {
  if (!snapshot) return layerConfigs;

  return layerConfigs.map((layerConfig) => {
    if (!(layerConfig.kind in snapshot)) return layerConfig;
    const visible = snapshot[layerConfig.kind];
    if (typeof visible !== "boolean") return layerConfig;
    return {
      ...layerConfig,
      visible,
    };
  });
}

function loadLayerStackFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_STACK);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const sanitized = parsed
      .map((item) => sanitizeLayerConfig(item))
      .filter((item): item is LayerConfig => item !== null);
    if (sanitized.length === 0) return null;

    return normalizeLayerOrder(sanitized);
  } catch {
    return null;
  }
}

function loadLayerPresetFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_PRESET);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const sanitized = parsed
      .map((item) => sanitizeLayerConfig(item))
      .filter((item): item is LayerConfig => item !== null);
    if (sanitized.length === 0) return null;
    return normalizeLayerOrder(sanitized);
  } catch {
    return null;
  }
}

function loadLayerVisibilityPresetsFromStorage() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_VISIBILITY_PRESETS);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return sanitizeLayerVisibilityPresetStore(parsed);
  } catch {
    return {};
  }
}

function persistLayerVisibilityPresetsToStorage(layerVisibilityPresets: LayerVisibilityPresetStore) {
  if (typeof window === "undefined") return;
  if (Object.keys(layerVisibilityPresets).length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_VISIBILITY_PRESETS);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY_LAYER_VISIBILITY_PRESETS,
    JSON.stringify(layerVisibilityPresets)
  );
}

function persistLayerPresetToStorage(layerConfigs: LayerConfig[] | null) {
  if (typeof window === "undefined") return;
  if (!layerConfigs || layerConfigs.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_PRESET);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_LAYER_PRESET, JSON.stringify(layerConfigs));
}

function persistLayerStackToStorage(layerConfigs: LayerConfig[] | null) {
  if (typeof window === "undefined") return;
  if (!layerConfigs || layerConfigs.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_STACK);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_LAYER_STACK, JSON.stringify(layerConfigs));
}

type AreaFilterFocusRequest = {
  shelterIds: string[];
  requestId: number;
};

type HazardCardFocusRequest = {
  hazardId: string | null;
  latitude: number | null;
  longitude: number | null;
  requestId: number;
};

type PopulationCardFocusRequest = {
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  requestId: number;
};

type MapProps = {
  activePanel: ActivePanel;
  shelters: ShelterRecord[];
  hazards: HazardRecord[];
  editingHazardId: string | null;
  onHazardGeometryChange?: (hazardId: string, isochroneGeometry: GeoJSON.Polygon) => void;
  onHazardSelectionChange?: (hazardId: string | null) => void;
  areaFilterFocusRequest: AreaFilterFocusRequest;
  shelterCardFocusRequest: {
    shelterId: string | null;
    requestId: number;
  };
  hazardCardFocusRequest: HazardCardFocusRequest;
  populationCardFocusRequest: PopulationCardFocusRequest;
};

function fitMapToShelters(map: MapLibre.Map, shelters: ShelterRecord[]) {
  if (shelters.length === 0) return;
  fitMapToCoordinates(
    map,
    shelters.map((shelter) => ({
      latitude: shelter.latitude,
      longitude: shelter.longitude,
    }))
  );
}

function fitMapToCoordinates(
  map: MapLibre.Map,
  coordinates: Array<{ latitude: number; longitude: number }>
) {
  if (coordinates.length === 0) return;

  const bounds = new MapLibre.LngLatBounds(
    [coordinates[0].longitude, coordinates[0].latitude],
    [coordinates[0].longitude, coordinates[0].latitude]
  );

  for (let i = 1; i < coordinates.length; i += 1) {
    bounds.extend([coordinates[i].longitude, coordinates[i].latitude]);
  }

  map.fitBounds(bounds, {
    padding: 96,
    maxZoom: 12,
    duration: 750,
  });
}

function flyToShelter(map: MapLibre.Map, shelter: ShelterRecord) {
  map.flyTo({
    center: [shelter.longitude, shelter.latitude],
    zoom: 13,
    duration: 900,
    essential: true,
  });
}

function flyToHazard(map: MapLibre.Map, latitude: number, longitude: number) {
  map.flyTo({
    center: [longitude, latitude],
    zoom: 13,
    duration: 900,
    essential: true,
  });
}

function flyToPopulation(
  map: MapLibre.Map,
  latitude: number,
  longitude: number
) {
  map.flyTo({
    center: [longitude, latitude],
    zoom: 13,
    duration: 900,
    essential: true,
  });
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
  return Math.round(radius * 10) / 10;
}

function closePolygonRing(ring: [number, number][]) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function buildIsochroneRing(
  latitude: number,
  longitude: number,
  radiusKm: number,
  seed: string,
  segments = HAZARD_FREEFORM_SEGMENTS
) {
  const earthRadiusKm = 6371;
  const radiusKmNormalized = Math.max(HAZARD_MIN_RADIUS_KM, radiusKm);
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const ring: [number, number][] = [];
  const seedBase = hashString(seed);
  const orientation = deterministicRandom(seedBase, 1) * Math.PI * 2;

  for (let i = 0; i <= segments; i += 1) {
    const bearing = (i / segments) * 2 * Math.PI + orientation;
    const rawPrev = deterministicRandom(seedBase, i + 16);
    const rawCurrent = deterministicRandom(seedBase, i + 17);
    const rawNext = deterministicRandom(seedBase, i + 18);
    const jitter = ((rawPrev + rawCurrent + rawNext) / 3 - 0.5) * 2;
    const localRadiusKm = Math.max(
      HAZARD_MIN_RADIUS_KM,
      radiusKmNormalized * (1 + jitter * HAZARD_FREEFORM_JITTER)
    );
    const angularDistance = localRadiusKm / earthRadiusKm;
    const sinDistance = Math.sin(angularDistance);
    const cosDistance = Math.cos(angularDistance);
    const latRadians = Math.asin(
      sinLatitude * cosDistance + cosLatitude * sinDistance * Math.cos(bearing)
    );
    const lonRadians =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) * sinDistance * cosLatitude,
        cosDistance - sinLatitude * Math.sin(latRadians)
      );
    ring.push([(lonRadians * 180) / Math.PI, (latRadians * 180) / Math.PI]);
  }

  return closePolygonRing(ring);
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

function resolveHazardRadiusKm(
  latitude: number,
  longitude: number,
  baseRadiusKm: number,
  placedHazards: HazardIsochroneSource[]
) {
  if (placedHazards.length === 0) return Math.max(HAZARD_MIN_RADIUS_KM, baseRadiusKm);

  let resolvedRadiusKm = baseRadiusKm;
  for (const placedHazard of placedHazards) {
    const centerDistanceKm = haversineDistanceKm(
      latitude,
      longitude,
      placedHazard.latitude,
      placedHazard.longitude
    );
    const maxNonOverlapRadiusKm =
      centerDistanceKm - placedHazard.radiusKm - HAZARD_MIN_GAP_KM;
    resolvedRadiusKm = Math.min(resolvedRadiusKm, maxNonOverlapRadiusKm);
  }

  return Math.max(HAZARD_MIN_RADIUS_KM, resolvedRadiusKm);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicRandom(seed: number, index: number) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getHazardPolygonRing(geometry?: GeoJSON.Polygon): [number, number][] | null {
  if (!geometry) return null;
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
  const rawRing = geometry.coordinates[0];
  if (!Array.isArray(rawRing) || rawRing.length < 4) return null;

  const ring: [number, number][] = [];
  for (const rawCoordinate of rawRing) {
    if (!Array.isArray(rawCoordinate) || rawCoordinate.length < 2) continue;
    const longitude = Number(rawCoordinate[0]);
    const latitude = Number(rawCoordinate[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    ring.push([longitude, latitude]);
  }

  if (ring.length < 4) return null;
  return closePolygonRing(ring);
}

function buildHazardGeoJSON(hazards: HazardRecord[]): GeoJSON.FeatureCollection {
  return buildHazardGeoJSONWithRadii(hazards).collection;
}

function buildHazardGeoJSONWithRadii(
  hazards: HazardRecord[],
  previousResolvedRadiusByHazardId: Record<string, number> = {}
): {
  collection: GeoJSON.FeatureCollection;
  resolvedRadiusByHazardId: Record<string, number>;
} {
  const placedHazards: HazardIsochroneSource[] = [];
  const resolvedRadiusByHazardId: Record<string, number> = {};
  const sortedHazards = hazards
    .filter((hazard) => Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude))
    .map((hazard) => ({ hazard, baseRadiusKm: estimateHazardRadiusKm(hazard) }))
    .sort((a, b) => b.baseRadiusKm - a.baseRadiusKm);
  const features: GeoJSON.Feature[] = [];

  for (const { hazard, baseRadiusKm } of sortedHazards) {
    const ringFromGeometry = getHazardPolygonRing(hazard.isochroneGeometry);
    let resolvedRadiusKm = ringFromGeometry
      ? baseRadiusKm
      : resolveHazardRadiusKm(hazard.latitude, hazard.longitude, baseRadiusKm, placedHazards);

    // Prevent abrupt growth when nearby hazards are removed.
    const previousRadius = previousResolvedRadiusByHazardId[hazard.id];
    if (Number.isFinite(previousRadius) && resolvedRadiusKm > previousRadius) {
      const maxStepUpKm =
        previousRadius * HAZARD_RADIUS_GROWTH_RATE + HAZARD_RADIUS_GROWTH_OFFSET_KM;
      resolvedRadiusKm = Math.min(resolvedRadiusKm, previousRadius + maxStepUpKm);
    }

    const ring =
      ringFromGeometry ??
      buildIsochroneRing(hazard.latitude, hazard.longitude, resolvedRadiusKm, hazard.id);
    resolvedRadiusByHazardId[hazard.id] = resolvedRadiusKm;
    placedHazards.push({
      hazardId: hazard.id,
      latitude: hazard.latitude,
      longitude: hazard.longitude,
      radiusKm: resolvedRadiusKm,
      baseRadiusKm,
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
      properties: {
        id: hazard.id,
        name: hazard.name,
        type: hazard.type,
        status: hazard.status,
        severity: hazard.severity,
        region: hazard.region,
        radiusKm: resolvedRadiusKm,
        baseRadiusKm,
      },
    });
  }

  return {
    collection: {
      type: "FeatureCollection",
      features,
    },
    resolvedRadiusByHazardId,
  };
}

function ensureHazardLayer(map: MapLibre.Map) {
  if (!map.getSource(HAZARD_SOURCE_ID)) {
    map.addSource(HAZARD_SOURCE_ID, {
      type: "geojson",
      data: buildHazardGeoJSON([]),
    });
  }

  if (!map.getLayer(HAZARD_FILL_LAYER_ID)) {
    map.addLayer({
      id: HAZARD_FILL_LAYER_ID,
      type: "fill",
      source: HAZARD_SOURCE_ID,
      paint: {
        "fill-color": [
          "match",
          ["get", "severity"],
          "Low",
          "#22c55e",
          "Moderate",
          "#3b82f6",
          "High",
          "#f97316",
          "#ef4444",
        ],
        "fill-opacity": 0.22,
      },
    });
  }

  if (!map.getLayer(HAZARD_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: HAZARD_OUTLINE_LAYER_ID,
      type: "line",
      source: HAZARD_SOURCE_ID,
      paint: {
        "line-color": [
          "match",
          ["get", "severity"],
          "Low",
          "#15803d",
          "Moderate",
          "#1d4ed8",
          "High",
          "#c2410c",
          "#b91c1c",
        ],
        "line-width": 2,
        "line-opacity": 0.9,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }
}

function getFeatureShelterId(feature: MapGeoJSONFeature): string | null {
  const rawId = feature.properties?.id;
  if (typeof rawId !== "string") return null;
  return rawId;
}

function getFeatureHazardId(feature: MapGeoJSONFeature): string | null {
  const rawId = feature.properties?.id;
  if (typeof rawId !== "string") return null;
  return rawId;
}

function findShelterByFeature(
  shelters: ShelterRecord[],
  feature: MapGeoJSONFeature
): ShelterRecord | null {
  const shelterId = getFeatureShelterId(feature);
  if (!shelterId) return null;
  return shelters.find((shelter) => shelter.id === shelterId) ?? null;
}

function findHazardByFeature(
  hazards: HazardRecord[],
  feature: MapGeoJSONFeature | null | undefined
): HazardRecord | null {
  if (!feature) return null;
  const hazardId = getFeatureHazardId(feature);
  if (!hazardId) return null;
  return hazards.find((hazard) => hazard.id === hazardId) ?? null;
}

function getStatusColorTokens(status: ShelterRecord["status"]) {
  if (status === "Open") {
    return {
      text: "#166534",
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (status === "Limited") {
    return {
      text: "#9a3412",
      background: "#fef3c7",
      border: "#fcd34d",
    };
  }

  return {
    text: "#991b1b",
    background: "#fee2e2",
    border: "#fca5a5",
  };
}

function getLayerMeaning(kind: LayerKind) {
  if (kind === "shelterPins") {
    return "Pin marks exact shelter location.";
  }

  if (kind === "shelterStatusHalo") {
    return "Halo shows status with color and opacity.";
  }

  if (kind === "selectedShelterHighlight") {
    return "Highlights only the selected shelter.";
  }

  if (kind === "hazardFill" || kind === "hazardOutline") {
    return "Visualizes flood extent and severity footprints.";
  }

  if (kind === "populationPolygons" || kind === "populationOutlines") {
    return "Visualizes population footprint and exposure intensity.";
  }

  return "Highlights the selected population footprint.";
}

function normalizeLayerText(value: string) {
  return value.trim().toLowerCase();
}

function matchesLayerLocationFilter<T extends { region: string; municipalityCity: string }>(
  record: T,
  filters: LayerConfig["filters"]
) {
  if (filters.region !== "all" && record.region !== filters.region) return false;

  const municipalityQuery = normalizeLayerText(filters.municipalityCity);
  if (municipalityQuery.length === 0) return true;

  return normalizeLayerText(record.municipalityCity) === municipalityQuery;
}

function getRelevantLayerKindsForPanel(activePanel: ActivePanel) {
  if (activePanel === "home") {
    return new Set<LayerKind>([
      "shelterPins",
      "shelterStatusHalo",
      "selectedShelterHighlight",
    ]);
  }

  if (activePanel === "hazardManagement" || activePanel === "typhoon") {
    return new Set<LayerKind>(["hazardFill", "hazardOutline"]);
  }

  if (activePanel === "population") {
    return new Set<LayerKind>([
      "populationPolygons",
      "populationOutlines",
      "populationSelection",
    ]);
  }

  return new Set<LayerKind>(ALL_LAYER_KINDS);
}

function LayerLegendPanel({
  activePanel,
  layerConfigs,
  sortedLayerConfigs,
  hasSelectedShelter,
  hasSelectedHazard,
  hasSelectedPopulation,
  isCollapsed,
  onToggleCollapsed,
}: {
  activePanel: ActivePanel;
  layerConfigs: LayerConfig[];
  sortedLayerConfigs: LayerConfig[];
  hasSelectedShelter: boolean;
  hasSelectedHazard: boolean;
  hasSelectedPopulation: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const relevantKinds = getRelevantLayerKindsForPanel(activePanel);
  const relevantLayerConfigs = sortedLayerConfigs.filter((layerConfig) =>
    relevantKinds.has(layerConfig.kind)
  );
  const activeCount = relevantLayerConfigs.filter((layerConfig) => layerConfig.visible).length;
  const panelLabel =
    activePanel === "home"
      ? "Shelter"
      : activePanel === "population"
      ? "Population"
      : activePanel === "hazardManagement"
      ? "Hazards"
      : activePanel === "typhoon"
      ? "Typhoon"
      : "General";

  return (
      <section
        className={`shelter-legend-panel absolute right-3 top-3 z-20 ${
          isCollapsed ? "w-[240px]" : "w-[300px]"
        } rounded-lg border border-neutral-300 bg-white/95 shadow-lg backdrop-blur-[2px]`}
        aria-label="Map legend"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-3 py-2">
          <div>
            <div className="text-sm font-bold text-neutral-900">Legend</div>
            <div className="text-[11px] text-neutral-500">
              {panelLabel} interpretation for current map view
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-300 bg-white/90 p-1 hover:bg-neutral-100"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand legend panel" : "Collapse legend panel"}
          >
            <img
              src={minimizeIcon}
              alt=""
              className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

      <div className="space-y-2 p-3">
        {(activePanel === "home") && (
          <div>
            <div className="text-xs font-semibold text-neutral-700">Shelter Status</div>
            <div className="mt-1 space-y-1">
              {STATUS_OPTIONS.map((status) => {
                const statusColors = getStatusColorTokens(status);
                const label =
                  status === "Open" ? "Available" : status === "Limited" ? "Partial" : "Full";
                return (
                  <div
                    key={status}
                    className="flex items-center justify-between gap-2 text-[11px] text-neutral-700"
                  >
                    <span>{status}</span>
                    <span
                      className="inline-flex rounded-full border px-2 py-[1px] text-[11px] font-semibold"
                      style={{
                        color: statusColors.text,
                        backgroundColor: statusColors.background,
                        borderColor: statusColors.border,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] text-neutral-600">
              Pins show shelter locations. Halo color maps to current shelter status.
            </div>
          </div>
        )}

        {(activePanel === "hazardManagement" || activePanel === "typhoon") && (
          <div>
            <div className="text-xs font-semibold text-neutral-700">Hazard Severity</div>
            <div className="mt-1 space-y-1 text-[11px] text-neutral-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span>Low</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span>High</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
                <span>Critical</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-neutral-600">
              Fill shows estimated affected footprint. Outline defines hazard boundary.
            </div>
          </div>
        )}

        {(activePanel === "population") && (
          <div>
            <div className="text-xs font-semibold text-neutral-700">Population Impact</div>
            <div className="mt-1 space-y-1 text-[11px] text-neutral-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-200" />
                <span>Lower impact / exposure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span>Moderate impact</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span>Elevated impact</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span>High impact</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
                <span>Severe impact</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-neutral-600">
              Area encodes footprint; color intensity reflects exposure and impact index.
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div>
            <div className="text-xs font-semibold text-neutral-700">
              Active Layers ({activeCount})
            </div>
            <div className="mt-1 space-y-2">
              {relevantLayerConfigs.length === 0 && (
                <div className="rounded border border-dashed border-neutral-300 px-2 py-1 text-[11px] text-neutral-500">
                  No layers configured.
                </div>
              )}

              {relevantLayerConfigs.map((layerConfig) => (
                <div
                  key={layerConfig.id}
                  className="rounded border border-neutral-200 bg-neutral-50/70 px-2 py-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-neutral-800">
                      {getLayerLabelForKind(layerConfig.kind)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-[1px] text-[10px] font-semibold ${
                        layerConfig.visible
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border border-neutral-300 bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {layerConfig.visible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-600">
                    {getLayerMeaning(layerConfig.kind)}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Name: {layerConfig.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isCollapsed ? (
          <div>
            <div className="text-xs font-semibold text-neutral-700">Active Layers</div>
            <div className="mt-1 text-[11px] text-neutral-600">
              {relevantLayerConfigs.length === 0
                ? "No layers."
                : `${activeCount} of ${relevantLayerConfigs.length} visible`}
            </div>
            <div className="text-[11px] text-neutral-500">
              Expand to inspect names, meaning, and visibility state.
            </div>
          </div>
        ) : (
          <div>
          <div className="text-xs font-semibold text-neutral-700">Quick Interpretation</div>
          <div className="mt-1 text-[11px] leading-relaxed text-neutral-600">
            {layerConfigs.length === 0
              ? "Enable at least one layer to visualize map data."
              : activePanel === "home"
              ? hasSelectedShelter
                ? "Click visible shelter pins or halos to inspect and compare shelter capacity."
                : "Click any visible shelter pin or halo to inspect details."
              : activePanel === "population"
              ? hasSelectedPopulation
                ? "Selected population area is highlighted. Click other areas to compare exposure."
                : "Hover population areas for quick labels and click to open detailed population info."
              : hasSelectedHazard
              ? "Selected hazard footprint is highlighted. Compare severity and boundary spread."
              : "Hover or click hazard footprints to inspect severity and projected impact."}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

function buildHoverPopupContent(shelter: ShelterRecord): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "shelter-hover-popup-content";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "2px";
  container.style.maxWidth = "220px";

  const name = document.createElement("div");
  name.style.fontWeight = "700";
  name.style.fontSize = "12px";
  name.textContent = shelter.name;

  const location = document.createElement("div");
  location.style.fontSize = "11px";
  location.style.color = "#4b5563";
  location.textContent = `${shelter.municipalityCity}, ${shelter.region}`;

  const statusRow = document.createElement("div");
  statusRow.style.display = "flex";
  statusRow.style.alignItems = "center";
  statusRow.style.gap = "6px";

  const statusLabel = document.createElement("span");
  statusLabel.style.fontSize = "11px";
  statusLabel.style.color = "#4b5563";
  statusLabel.textContent = "Status";

  const status = document.createElement("span");
  const statusColors = getStatusColorTokens(shelter.status);
  status.style.fontSize = "11px";
  status.style.fontWeight = "600";
  status.style.color = statusColors.text;
  status.style.backgroundColor = statusColors.background;
  status.style.border = `1px solid ${statusColors.border}`;
  status.style.borderRadius = "9999px";
  status.style.padding = "1px 6px";
  status.textContent = shelter.status;

  statusRow.append(statusLabel, status);
  container.append(name, location, statusRow);
  return container;
}

function buildHazardHoverPopupContent(hazard: HazardRecord): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "hazard-hover-popup-content";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "2px";
  container.style.maxWidth = "220px";

  const name = document.createElement("div");
  name.style.fontWeight = "700";
  name.style.fontSize = "12px";
  name.textContent = hazard.name;

  const location = document.createElement("div");
  location.style.fontSize = "11px";
  location.style.color = "#4b5563";
  location.textContent = `${hazard.municipalityCity}, ${hazard.region}`;

  container.append(name, location);
  return container;
}

function parsePopulationCoordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePopulationRecord(value: unknown): PopulationRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : null;
  const region =
    typeof candidate.region === "string" && candidate.region.trim().length > 0
      ? candidate.region.trim()
      : null;
  const municipalityCity =
    typeof candidate.municipalityCity === "string" ? candidate.municipalityCity.trim() : "";
  if (!id || !region || municipalityCity.length === 0) return null;

  const totalPopulation = parsePopulationCoordinate(candidate.totalPopulation);
  const atRiskPopulation = parsePopulationCoordinate(candidate.atRiskPopulation);
  const latitude = parsePopulationCoordinate(candidate.latitude);
  const longitude = parsePopulationCoordinate(candidate.longitude);

  if (
    totalPopulation === null ||
    atRiskPopulation === null ||
    latitude === null ||
    longitude === null
  ) {
    return null;
  }

  return {
    id,
    region,
    municipalityCity,
    totalPopulation: Math.max(0, Math.floor(totalPopulation)),
    atRiskPopulation: Math.max(0, Math.floor(atRiskPopulation)),
    latitude,
    longitude,
    notes:
      typeof candidate.notes === "string" && candidate.notes.trim().length > 0
        ? candidate.notes.trim()
        : undefined,
  };
}

function loadPopulationRecordsFromStorage() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(POPULATION_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((record) => normalizePopulationRecord(record))
      .filter((record): record is PopulationRecord => record !== null);

    return normalized;
  } catch {
    return [];
  }
}

function loadPopulationResolutionModeFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(POPULATION_RESOLUTION_MODE_STORAGE_KEY);
  if (raw === "municipality" || raw === "subzones") return raw;
  return null;
}

function loadPopulationSubzoneCountFromStorage() {
  if (typeof window === "undefined") return POPULATION_SUBZONE_COUNT_MIN;
  const raw = window.localStorage.getItem(POPULATION_SUBZONE_COUNT_STORAGE_KEY);
  if (!raw) return POPULATION_SUBZONE_COUNT_MIN;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return POPULATION_SUBZONE_COUNT_MIN;
  return Math.max(
    POPULATION_SUBZONE_COUNT_MIN,
    Math.min(POPULATION_SUBZONE_COUNT_MAX, Math.floor(parsed))
  );
}

function buildPopulationSubzoneRing(
  latitude: number,
  longitude: number,
  radiusKm: number,
  seed: string,
  sectorIndex: number,
  totalSectors: number,
  segments = POPULATION_SEGMENTS + 2
) {
  if (totalSectors <= 1) {
    return buildPopulationIsochroneRing(latitude, longitude, radiusKm, seed, segments);
  }

  const seedBase = hashString(seed);
  const centerBearing =
    deterministicRandom(seedBase, 71) * Math.PI * 2 + (Math.PI * 2 * sectorIndex) / totalSectors;
  const subzoneRadiusFactor = Math.min(0.55, 0.82 / totalSectors + 0.13);
  const centerOffsetFactor = Math.max(0.18, 0.92 - subzoneRadiusFactor);
  const centerOffsetKm = radiusKm * centerOffsetFactor;
  const localRadiusKm = Math.max(
    POPULATION_MIN_RADIUS_KM * 0.6,
    radiusKm *
      subzoneRadiusFactor *
      (1 + (deterministicRandom(seedBase, sectorIndex + 81) - 0.5) * 0.16)
  );

  const earthRadiusKm = 6371;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const angularOffset = centerOffsetKm / earthRadiusKm;
  const sinOffset = Math.sin(angularOffset);
  const cosOffset = Math.cos(angularOffset);
  const subzoneCenterLatRadians = Math.asin(
    sinLatitude * cosOffset + cosLatitude * sinOffset * Math.cos(centerBearing)
  );
  const subzoneCenterLonRadians =
    longitudeRadians +
    Math.atan2(
      Math.sin(centerBearing) * sinOffset * cosLatitude,
      cosOffset - sinLatitude * Math.sin(subzoneCenterLatRadians)
    );
  const subzoneCenterLatitude = (subzoneCenterLatRadians * 180) / Math.PI;
  const subzoneCenterLongitude = (subzoneCenterLonRadians * 180) / Math.PI;

  return buildPopulationIsochroneRing(
    subzoneCenterLatitude,
    subzoneCenterLongitude,
    localRadiusKm,
    `${seed}-blob-${sectorIndex}`,
    segments
  );
}

function buildPopulationGeoJSON(
  records: PopulationRecord[],
  resolutionMode: PopulationResolutionMode,
  subzoneCount: number
) {
  const maxPopulation = Math.max(
    1,
    ...records.map((record) => Math.max(1, record.totalPopulation))
  );
  const prepared = records
    .filter((record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude))
    .map((record) => {
      const normalizedPop = record.totalPopulation / maxPopulation;
      const atRiskRatio =
        record.totalPopulation === 0 ? 0 : record.atRiskPopulation / record.totalPopulation;
      const baseRadiusKm = Math.max(
        POPULATION_MIN_RADIUS_KM,
        Math.min(
          POPULATION_MAX_RADIUS_KM,
          POPULATION_MIN_RADIUS_KM + Math.pow(normalizedPop, 0.62) * 2.4 + atRiskRatio * 1.1
        )
      );

      return {
        record,
        baseRadiusKm,
      };
    })
    .sort((a, b) => b.baseRadiusKm - a.baseRadiusKm);

  const placedPopulations: PopulationIsochroneSource[] = [];
  const features = prepared.map(({ record, baseRadiusKm }) => {
    const resolvedRadiusKm = resolvePopulationRadiusKm(
      record.latitude,
      record.longitude,
      baseRadiusKm,
      placedPopulations
    );
    const ring = buildPopulationIsochroneRing(
      record.latitude,
      record.longitude,
      resolvedRadiusKm,
      record.id
    );
    const normalizedZoneCount = resolutionMode === "subzones"
      ? Math.max(1, Math.min(POPULATION_SUBZONE_COUNT_MAX, Math.max(POPULATION_SUBZONE_COUNT_MIN, subzoneCount)))
      : 1;
    const zoneWeights =
      resolutionMode === "subzones"
        ? Array.from({ length: normalizedZoneCount }, (_, zoneIndex) => {
            return (
              0.65 +
              deterministicRandom(hashString(`${record.id}-zone-weight`), zoneIndex + 1) * 0.95
            );
          })
        : Array.from({ length: normalizedZoneCount }, () => 1);
    const zoneWeightTotal = zoneWeights.reduce((sum, weight) => sum + weight, 0);

    placedPopulations.push({
      populationId: record.id,
      latitude: record.latitude,
      longitude: record.longitude,
      radiusKm: resolvedRadiusKm,
      baseRadiusKm,
    });

    let assignedPopulation = 0;
    let assignedAtRisk = 0;
    return Array.from({ length: normalizedZoneCount }, (_, zoneIndex) => {
      const zoneRing =
        resolutionMode === "subzones"
          ? buildPopulationSubzoneRing(
              record.latitude,
              record.longitude,
              resolvedRadiusKm,
              `${record.id}-${zoneIndex}`,
              zoneIndex,
              normalizedZoneCount
            )
          : ring;
      const isLastZone = zoneIndex === normalizedZoneCount - 1;
      const zoneWeightRatio = zoneWeights[zoneIndex] / Math.max(1, zoneWeightTotal);
      const zonePopulation = isLastZone
        ? Math.max(1, record.totalPopulation - assignedPopulation)
        : Math.max(1, Math.round(record.totalPopulation * zoneWeightRatio));
      assignedPopulation += zonePopulation;
      const rawZoneAtRisk = isLastZone
        ? Math.max(0, record.atRiskPopulation - assignedAtRisk)
        : Math.max(
            0,
            Math.round(
              record.atRiskPopulation *
                zoneWeightRatio *
                (0.88 + deterministicRandom(hashString(`${record.id}-zone-risk`), zoneIndex + 11) * 0.28)
            )
          );
      const zoneAtRisk = Math.min(zonePopulation, rawZoneAtRisk);
      assignedAtRisk += zoneAtRisk;
      const zoneDensity = Math.round((zonePopulation / maxPopulation) * 100);
      const zoneExposure = Math.round((zoneAtRisk / Math.max(1, zonePopulation)) * 100);
      const zoneVariance = Math.round(
        (deterministicRandom(hashString(`${record.id}-zone-impact`), zoneIndex + 21) - 0.5) * 18
      );
      const zoneImpactIndex = Math.max(
        1,
        Math.min(
          100,
          Math.round(Math.min(100, zoneDensity * 0.62 + zoneExposure * 0.38)) + zoneVariance
        )
      );

      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [zoneRing],
        },
        properties: {
          id:
            resolutionMode === "subzones"
              ? `${record.id}-zone-${zoneIndex + 1}`
              : record.id,
          populationId: record.id,
          zoneName:
            resolutionMode === "subzones" ? `Zone ${zoneIndex + 1}` : undefined,
          resolutionMode,
          zoneCount: normalizedZoneCount,
          region: record.region,
          municipalityCity: record.municipalityCity,
          totalPopulation: zonePopulation,
          atRiskPopulation: zoneAtRisk,
          exposurePercent: zoneExposure,
          densityScore: zoneDensity,
          impactIndex: zoneImpactIndex,
          radiusKm: resolvedRadiusKm,
        },
      };
    });
  });

  return {
    type: "FeatureCollection",
    features: features.flat() as GeoJSON.Feature[],
  } as GeoJSON.FeatureCollection;
}

function resolvePopulationRadiusKm(
  latitude: number,
  longitude: number,
  baseRadiusKm: number,
  placedPopulations: PopulationIsochroneSource[]
) {
  if (placedPopulations.length === 0) return Math.max(POPULATION_MIN_RADIUS_KM, baseRadiusKm);

  let resolvedRadiusKm = baseRadiusKm;
  for (const placedPopulation of placedPopulations) {
    const centerDistanceKm = haversineDistanceKm(
      latitude,
      longitude,
      placedPopulation.latitude,
      placedPopulation.longitude
    );
    const maxNonOverlapRadiusKm = centerDistanceKm - placedPopulation.radiusKm - POPULATION_MIN_GAP_KM;
    resolvedRadiusKm = Math.min(resolvedRadiusKm, maxNonOverlapRadiusKm);
  }

  return Math.max(POPULATION_MIN_RADIUS_KM, resolvedRadiusKm);
}

function buildPopulationIsochroneRing(
  latitude: number,
  longitude: number,
  radiusKm: number,
  seed: string,
  segments = POPULATION_SEGMENTS
) {
  const earthRadiusKm = 6371;
  const radiusKmNormalized = Math.max(POPULATION_MIN_RADIUS_KM, radiusKm);
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const ring: [number, number][] = [];
  const seedBase = hashString(seed);
  const orientation = deterministicRandom(seedBase, 11) * Math.PI * 2;

  for (let i = 0; i <= segments; i += 1) {
    const bearing = (i / segments) * 2 * Math.PI + orientation;
    const jitter = (deterministicRandom(seedBase, i + 22) - 0.5) * 2;
    const localRadiusKm = Math.max(
      POPULATION_MIN_RADIUS_KM,
      radiusKmNormalized * (1 + jitter * POPULATION_JITTER)
    );
    const angularDistance = localRadiusKm / earthRadiusKm;
    const sinDistance = Math.sin(angularDistance);
    const cosDistance = Math.cos(angularDistance);
    const latRadians = Math.asin(
      sinLatitude * cosDistance + cosLatitude * sinDistance * Math.cos(bearing)
    );
    const lonRadians =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) * sinDistance * cosLatitude,
        cosDistance - sinLatitude * Math.sin(latRadians)
      );
    ring.push([(lonRadians * 180) / Math.PI, (latRadians * 180) / Math.PI]);
  }

  return closePolygonRing(ring);
}

function ensurePopulationLayer(map: MapLibre.Map) {
  if (!map.getSource(POPULATION_SOURCE_ID)) {
    map.addSource(POPULATION_SOURCE_ID, {
      type: "geojson",
      data: buildPopulationGeoJSON([], "municipality", POPULATION_SUBZONE_COUNT_MIN),
    });
  }

  if (!map.getLayer(POPULATION_POLYGON_LAYER_ID)) {
    map.addLayer({
      id: POPULATION_POLYGON_LAYER_ID,
      type: "fill",
      source: POPULATION_SOURCE_ID,
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          [
            "step",
            ["to-number", ["get", "impactIndex"], 0],
            "#dbeafe",
            20,
            "#93c5fd",
            40,
            "#38bdf8",
            65,
            "#22c55e",
            85,
            "#f97316",
            95,
            "#dc2626",
          ],
          [
            "step",
            ["to-number", ["get", "impactIndex"], 0],
            "#bfdbfe",
            20,
            "#60a5fa",
            40,
            "#facc15",
            65,
            "#f97316",
            85,
            "#dc2626",
            95,
            "#7f1d1d",
          ],
        ],
        "fill-opacity": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          [
            "interpolate",
            ["linear"],
            ["to-number", ["get", "impactIndex"], 0],
            0,
            0.62,
            100,
            0.82,
          ],
          [
            "interpolate",
            ["linear"],
            ["to-number", ["get", "totalPopulation"], 0],
            5000,
            0.19,
            100000,
            0.26,
            250000,
            0.32,
            500000,
            0.38,
          ],
        ],
      },
    });
  }

  if (!map.getLayer(POPULATION_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: POPULATION_OUTLINE_LAYER_ID,
      type: "line",
      source: POPULATION_SOURCE_ID,
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          "#111827",
          [
            "step",
            ["to-number", ["get", "impactIndex"], 0],
            "#334155",
            45,
            "#0369a1",
            70,
            "#ea580c",
            90,
            "#b91c1c",
          ],
        ],
        "line-width": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          2.2,
          ["interpolate", ["linear"], ["to-number", ["get", "radiusKm"], 0], 0, 0.8, 4, 1.6],
        ],
        "line-dasharray": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          ["literal", [2, 1]],
          ["literal", [1, 0]],
        ],
        "line-opacity": [
          "case",
          ["==", ["get", "resolutionMode"], "subzones"],
          0.95,
          0.45,
        ],
      },
    });
  }

  if (!map.getLayer(POPULATION_SUBZONE_LABEL_LAYER_ID)) {
    map.addLayer({
      id: POPULATION_SUBZONE_LABEL_LAYER_ID,
      type: "symbol",
      source: POPULATION_SOURCE_ID,
      filter: ["==", ["get", "resolutionMode"], "subzones"],
      minzoom: 7,
      layout: {
        "text-field": ["get", "zoneName"],
        "text-size": 11,
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.2,
        "text-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(POPULATION_SELECTED_LAYER_ID)) {
    map.addLayer({
      id: POPULATION_SELECTED_LAYER_ID,
      type: "fill",
      source: POPULATION_SOURCE_ID,
      filter: ["==", ["get", "populationId"], ""],
      paint: {
        "fill-color": "#0ea5e9",
        "fill-opacity": 0.45,
        "fill-outline-color": "#0f172a",
      },
    });
  }

  if (map.getLayer(POPULATION_SUBZONE_LABEL_LAYER_ID)) {
    map.moveLayer(POPULATION_SUBZONE_LABEL_LAYER_ID);
  }
}

function buildPopulationPopupContent(
  record: PopulationRecord,
  zoneName?: string
): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "shelter-hover-popup-content";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "2px";
  container.style.maxWidth = "220px";

  const name = document.createElement("div");
  name.style.fontWeight = "700";
  name.style.fontSize = "12px";
  name.textContent = zoneName
    ? `${record.municipalityCity} Population · ${zoneName}`
    : `${record.municipalityCity} Population`;

  const location = document.createElement("div");
  location.style.fontSize = "11px";
  location.style.color = "#4b5563";
  location.textContent = `${record.municipalityCity}, ${record.region}`;

  container.append(name, location);
  return container;
}

type PopulationFeatureMeta = {
  populationId: string;
  zoneName?: string;
};

function getFeaturePopulationId(feature: MapGeoJSONFeature): string | null {
  const rawPopulationId = feature.properties?.populationId;
  if (typeof rawPopulationId === "string") return rawPopulationId;
  const rawId = feature.properties?.id;
  if (typeof rawId === "string") return rawId;
  return null;
}

function getPopulationFeatureMeta(feature: MapGeoJSONFeature | null | undefined): PopulationFeatureMeta | null {
  if (!feature) return null;
  const populationId = getFeaturePopulationId(feature);
  if (!populationId) return null;
  const rawZoneName = feature.properties?.zoneName;
  return {
    populationId,
    zoneName: typeof rawZoneName === "string" && rawZoneName.length > 0 ? rawZoneName : undefined,
  };
}

function findPopulationByFeature(
  populationRecords: PopulationRecord[],
  feature: MapGeoJSONFeature | null | undefined
): PopulationRecord | null {
  if (!feature) return null;
  const populationId = getFeaturePopulationId(feature);
  if (!populationId) return null;
  return populationRecords.find((record) => record.id === populationId) ?? null;
}

function Map({
  activePanel,
  shelters,
  hazards,
  areaFilterFocusRequest,
  shelterCardFocusRequest,
  hazardCardFocusRequest,
  populationCardFocusRequest,
  onHazardSelectionChange,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<MapLibre.Map | null>(null);
  const sheltersRef = useRef<ShelterRecord[]>(shelters);
  const hazardsRef = useRef<HazardRecord[]>(hazards);
  const populationRecordsRef = useRef<PopulationRecord[]>(loadPopulationRecordsFromStorage());
  const hoverPopupRef = useRef<MapLibre.Popup | null>(null);
  const hoveredShelterIdRef = useRef<string | null>(null);
  const hoveredHazardIdRef = useRef<string | null>(null);
  const hoveredPopulationIdRef = useRef<string | null>(null);
  const selectedShelterIdRef = useRef<string | null>(null);
  const hazardResolvedRadiusRef = useRef<Record<string, number>>({});
  const layerConfigsRef = useRef<LayerConfig[]>(createDefaultLayerStack());

  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [selectedPopulationId, setSelectedPopulationId] = useState<string | null>(null);
  const [populationResolutionMode, setPopulationResolutionMode] = useState<PopulationResolutionMode>(
    () => loadPopulationResolutionModeFromStorage() ?? "municipality"
  );
  const [populationSubzoneCount, setPopulationSubzoneCount] = useState<number>(() =>
    loadPopulationSubzoneCountFromStorage()
  );
  const [populationRecords, setPopulationRecords] = useState<PopulationRecord[]>(
    loadPopulationRecordsFromStorage
  );
  const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>(() => {
    const savedStack = loadLayerStackFromStorage();
    return savedStack ?? createDefaultLayerStack();
  });
  const [selectedLayerConfigId, setSelectedLayerConfigId] = useState<string | null>(null);
  const [layerSearchValue, setLayerSearchValue] = useState("");
  const [layerKindToAdd, setLayerKindToAdd] = useState<LayerKind>("shelterStatusHalo");
  const [savedLayerPreset, setSavedLayerPreset] = useState<LayerConfig[] | null>(() =>
    loadLayerPresetFromStorage()
  );
  const [layerVisibilityPresets, setLayerVisibilityPresets] = useState<LayerVisibilityPresetStore>(
    () => loadLayerVisibilityPresetsFromStorage()
  );
  const [selectedVisibilityPurpose, setSelectedVisibilityPurpose] = useState<string>(
    DEFAULT_VISIBILITY_PRESET_PURPOSE
  );
  const [visibilityPurposeInput, setVisibilityPurposeInput] = useState("");
  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);
  const [legendCollapsedByPanel, setLegendCollapsedByPanel] = useState<
    Partial<Record<ActivePanel, boolean>>
  >(() => ({
    [activePanel]: false,
  }));
  const [isLayerInspectorCollapsed, setIsLayerInspectorCollapsed] = useState(false);
  const [layerDiagnosticsUpdatedAt, setLayerDiagnosticsUpdatedAt] = useState<Date>(
    new Date()
  );
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);

  const selectedShelter = useMemo(
    () => shelters.find((shelter) => shelter.id === selectedShelterId) ?? null,
    [selectedShelterId, shelters]
  );
  const selectedPopulation = useMemo(
    () => populationRecords.find((record) => record.id === selectedPopulationId) ?? null,
    [populationRecords, selectedPopulationId]
  );
  const selectedHazard = useMemo(
    () => hazards.find((hazard) => hazard.id === selectedHazardId) ?? null,
    [hazards, selectedHazardId]
  );
  const selectableLayerKinds = useMemo(
    () =>
      ALL_LAYER_KINDS.filter((kind) => !layerConfigs.some((layerConfig) => layerConfig.kind === kind)),
    [layerConfigs]
  );
  const sortedLayerConfigs = useMemo(
    () => [...layerConfigs].sort((a, b) => a.order - b.order),
    [layerConfigs]
  );
  const selectedLayerConfig = useMemo(
    () =>
      sortedLayerConfigs.find((layerConfig) => layerConfig.id === selectedLayerConfigId) ?? null,
    [selectedLayerConfigId, sortedLayerConfigs]
  );
  const selectedLayerFeatureCount = useMemo(() => {
    if (!selectedLayerConfig) return 0;
    if (
      selectedLayerConfig.kind === "shelterPins" ||
      selectedLayerConfig.kind === "shelterStatusHalo" ||
      selectedLayerConfig.kind === "selectedShelterHighlight"
    ) {
      return getFilteredShelters(
        shelters,
        selectedLayerConfig.filters,
        selectedLayerConfig.kind,
        selectedShelterId
      ).length;
    }

    if (selectedLayerConfig.kind === "hazardFill" || selectedLayerConfig.kind === "hazardOutline") {
      return hazards.filter((hazard) => matchesLayerLocationFilter(hazard, selectedLayerConfig.filters)).length;
    }

    if (
      selectedLayerConfig.kind === "populationPolygons" ||
      selectedLayerConfig.kind === "populationOutlines" ||
      selectedLayerConfig.kind === "populationSelection"
    ) {
      if (selectedLayerConfig.kind === "populationSelection") {
        const selectedPopulationRecord = populationRecords.find(
          (record) => record.id === selectedPopulationId
        );
        if (!selectedPopulationRecord) return 0;

        return matchesLayerLocationFilter(selectedPopulationRecord, selectedLayerConfig.filters)
          ? 1
          : 0;
      }

      return populationRecords.filter((record) =>
        matchesLayerLocationFilter(record, selectedLayerConfig.filters)
      ).length;
    }

    return 0;
  }, [
    selectedLayerConfig,
    selectedShelterId,
    shelters,
    hazards,
    populationRecords,
    selectedPopulationId,
  ]);
  const mergedLayerVisibilityPresets = useMemo(
    () => ({
      ...layerVisibilityPresets,
      ...BUILTIN_LAYER_VISIBILITY_PRESETS,
    }),
    [layerVisibilityPresets]
  );
  const visibilityPurposeOptions = useMemo(
    () => toSortedPresetPurposeList(mergedLayerVisibilityPresets),
    [mergedLayerVisibilityPresets]
  );
  const hasVisibilityPresetForSelectedPurpose =
    selectedVisibilityPurpose.trim().length > 0 &&
    selectedVisibilityPurpose in layerVisibilityPresets;
  const selectedShelterStatusColors = useMemo(() => {
    if (!selectedShelter) return null;
    return getStatusColorTokens(selectedShelter.status);
  }, [selectedShelter]);
  const isLegendCollapsed = legendCollapsedByPanel[activePanel] ?? true;

  useEffect(() => {
    sheltersRef.current = shelters;
  }, [shelters]);

  useEffect(() => {
    hazardsRef.current = hazards;
  }, [hazards]);

  useEffect(() => {
    populationRecordsRef.current = populationRecords;
  }, [populationRecords]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopulationDataUpdate = () => {
      const nextRecords = loadPopulationRecordsFromStorage();
      setPopulationRecords(nextRecords);
      setSelectedPopulationId((current) => {
        if (!current) return null;
        return nextRecords.some((record) => record.id === current) ? current : null;
      });
      const nextMode = loadPopulationResolutionModeFromStorage();
      if (nextMode) {
        setPopulationResolutionMode(nextMode);
      }
      setPopulationSubzoneCount(loadPopulationSubzoneCountFromStorage());
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (
        event.key === POPULATION_STORAGE_KEY ||
        event.key === POPULATION_RESOLUTION_MODE_STORAGE_KEY ||
        event.key === POPULATION_SUBZONE_COUNT_STORAGE_KEY
      ) {
        handlePopulationDataUpdate();
      }
    };
    const handlePopulationUpdateEvent = () => {
      handlePopulationDataUpdate();
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener(POPULATION_UPDATE_EVENT, handlePopulationUpdateEvent);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener(POPULATION_UPDATE_EVENT, handlePopulationUpdateEvent);
    };
  }, []);

  useEffect(() => {
    persistLayerStackToStorage(layerConfigs);
  }, [layerConfigs]);

  useEffect(() => {
    persistLayerVisibilityPresetsToStorage(layerVisibilityPresets);
  }, [layerVisibilityPresets]);

  useEffect(() => {
    selectedShelterIdRef.current = selectedShelterId;
  }, [selectedShelterId]);

  useEffect(() => {
    layerConfigsRef.current = layerConfigs;
  }, [layerConfigs]);

  useEffect(() => {
    setLayerDiagnosticsUpdatedAt(new Date());
  }, [layerConfigs, shelters]);

  useEffect(() => {
    if (layerConfigs.length === 0) {
      setSelectedLayerConfigId(null);
      return;
    }

    if (selectedLayerConfigId && layerConfigs.some((layer) => layer.id === selectedLayerConfigId)) {
      return;
    }

    setSelectedLayerConfigId(layerConfigs[0].id);
  }, [layerConfigs, selectedLayerConfigId]);

  useEffect(() => {
    if (selectableLayerKinds.length === 0) return;
    if (selectableLayerKinds.includes(layerKindToAdd)) return;
    setLayerKindToAdd(selectableLayerKinds[0]);
  }, [layerKindToAdd, selectableLayerKinds]);

  useEffect(() => {
    if (!selectedVisibilityPurpose) return;
    const snapshot = mergedLayerVisibilityPresets[selectedVisibilityPurpose];
    if (!snapshot) return;
    setLayerConfigs((current) => applyLayerVisibilitySnapshot(current, snapshot));
  }, [selectedVisibilityPurpose, mergedLayerVisibilityPresets]);

  useEffect(() => {
    const purposeInOptions = mergedLayerVisibilityPresets[selectedVisibilityPurpose];
    if (purposeInOptions) return;
    if (visibilityPurposeOptions.length === 0) {
      if (selectedVisibilityPurpose !== DEFAULT_VISIBILITY_PRESET_PURPOSE) {
        setSelectedVisibilityPurpose(DEFAULT_VISIBILITY_PRESET_PURPOSE);
      }
      return;
    }

    setSelectedVisibilityPurpose(visibilityPurposeOptions[0]);
  }, [visibilityPurposeOptions, mergedLayerVisibilityPresets, selectedVisibilityPurpose]);

  useEffect(() => {
    setLegendCollapsedByPanel((current) => {
      if (typeof current[activePanel] === "boolean") return current;
      return {
        ...current,
        [activePanel]: true,
      };
    });
  }, [activePanel]);

  useEffect(() => {
    const purpose = getVisibilityPurposeForPanel(activePanel);
    const snapshot = mergedLayerVisibilityPresets[purpose];
    if (!snapshot) return;
    setLayerConfigs((current) => applyLayerVisibilitySnapshot(current, snapshot));
    setSelectedVisibilityPurpose(purpose);
    setVisibilityPurposeInput("");
  }, [activePanel, mergedLayerVisibilityPresets]);

  function updateLayerConfig(
    layerId: string,
    updater: (layerConfig: LayerConfig) => LayerConfig
  ) {
    setLayerConfigs((current) =>
      current.map((layerConfig) =>
        layerConfig.id === layerId ? updater(layerConfig) : layerConfig
      )
    );
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    setLayerConfigs((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const currentIndex = ordered.findIndex((layerConfig) => layerConfig.id === layerId);
      if (currentIndex < 0) return current;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= ordered.length) return current;

      const nextOrdered = [...ordered];
      const [movingLayer] = nextOrdered.splice(currentIndex, 1);
      nextOrdered.splice(nextIndex, 0, movingLayer);

      return normalizeLayerOrder(nextOrdered);
    });
  }

  function handleAddLayer() {
    if (selectableLayerKinds.length === 0) return;

    setLayerConfigs((current) =>
      normalizeLayerOrder([...current, createLayerConfig(layerKindToAdd, current.length)])
    );
  }

  function handleRemoveLayer(layerId: string) {
    setLayerConfigs((current) =>
      normalizeLayerOrder(current.filter((layerConfig) => layerConfig.id !== layerId))
    );
  }

  function handleSavePreset() {
    const nextPreset = cloneLayerConfigs(layerConfigs);
    const normalizedPreset = normalizeLayerOrder(nextPreset);
    setSavedLayerPreset(normalizedPreset);
    persistLayerPresetToStorage(normalizedPreset);
  }

  function handleLoadPreset() {
    const stored = loadLayerPresetFromStorage();
    const presetToLoad = stored ?? savedLayerPreset;
    if (!presetToLoad) return;
    setLayerConfigs(normalizeLayerOrder(cloneLayerConfigs(presetToLoad)));
  }

  function resolveVisibilityPurposeForAction() {
    const normalizedInput = visibilityPurposeInput.trim();
    if (normalizedInput.length > 0 && mergedLayerVisibilityPresets[normalizedInput]) {
      return normalizedInput;
    }

    const selectedNormalized = selectedVisibilityPurpose.trim();
    if (selectedNormalized.length > 0 && mergedLayerVisibilityPresets[selectedNormalized]) {
      return selectedNormalized;
    }

    return "";
  }

  function handleSaveVisibilityPreset() {
    const purpose =
      visibilityPurposeInput.trim().length > 0
        ? visibilityPurposeInput.trim()
        : selectedVisibilityPurpose.trim();
    if (!purpose) return;

    setLayerVisibilityPresets((current) => {
      const next = {
        ...current,
        [purpose]: snapshotLayerVisibility(layerConfigs),
      };
      return next;
    });
    setSelectedVisibilityPurpose(purpose);
    setVisibilityPurposeInput("");
  }

  function handleApplyVisibilityPreset() {
    const purpose = resolveVisibilityPurposeForAction();
    if (!purpose) return;
    const snapshot = mergedLayerVisibilityPresets[purpose];
    if (!snapshot) return;
    setLayerConfigs((current) => applyLayerVisibilitySnapshot(current, snapshot));
    setSelectedVisibilityPurpose(purpose);
  }

  function handleDeleteVisibilityPreset() {
    const purpose = resolveVisibilityPurposeForAction();
    if (!purpose || !layerVisibilityPresets[purpose]) return;

    setLayerVisibilityPresets((current) => {
      if (!current[purpose]) return current;
      const next = { ...current };
      delete next[purpose];
      return next;
    });
    setSelectedVisibilityPurpose((current) => {
      if (current !== purpose) return current;
      const nextPurposes = Object.keys(layerVisibilityPresets).filter((name) => name !== purpose);
      return nextPurposes[0] ?? DEFAULT_VISIBILITY_PRESET_PURPOSE;
    });
    if (visibilityPurposeInput.trim().length > 0 && visibilityPurposeInput.trim() === purpose) {
      setVisibilityPurposeInput("");
    }
  }

  function handleVisibilityPurposeChange(nextPurpose: string) {
    setSelectedVisibilityPurpose(nextPurpose);
    setVisibilityPurposeInput("");
  }

  function handleResetLayerStack() {
    setLayerConfigs(createDefaultLayerStack());
  }

  function handleShowAllLayers() {
    setLayerConfigs((current) =>
      current.map((layerConfig) => ({ ...layerConfig, visible: true }))
    );
  }

  function handleHideAllLayers() {
    setLayerConfigs((current) =>
      current.map((layerConfig) => ({ ...layerConfig, visible: false }))
    );
  }

  function handleClearAllLayers() {
    setLayerConfigs([]);
  }

  function handleZoomToLayer(layerConfig: LayerConfig) {
    const map = mapInstance.current;
    if (!map) return;

    if (
      layerConfig.kind === "shelterPins" ||
      layerConfig.kind === "shelterStatusHalo" ||
      layerConfig.kind === "selectedShelterHighlight"
    ) {
      const layerShelters = getFilteredShelters(
        sheltersRef.current,
        layerConfig.filters,
        layerConfig.kind,
        selectedShelterIdRef.current
      );

      if (layerShelters.length === 0) return;
      if (layerShelters.length === 1) {
        flyToShelter(map, layerShelters[0]);
        return;
      }

      fitMapToShelters(map, layerShelters);
      return;
    }

    if (layerConfig.kind === "hazardFill" || layerConfig.kind === "hazardOutline") {
      const layerHazards = hazardsRef.current.filter((hazard) =>
        matchesLayerLocationFilter(hazard, layerConfig.filters)
      );

      if (layerHazards.length === 0) return;
      if (layerHazards.length === 1) {
        const target = layerHazards[0];
        flyToHazard(map, target.latitude, target.longitude);
        return;
      }

      fitMapToCoordinates(
        map,
        layerHazards.map((hazard) => ({
          latitude: hazard.latitude,
          longitude: hazard.longitude,
        }))
      );
      return;
    }

    if (
      layerConfig.kind === "populationPolygons" ||
      layerConfig.kind === "populationOutlines"
    ) {
      const layerPopulations = populationRecordsRef.current.filter((population) =>
        matchesLayerLocationFilter(population, layerConfig.filters)
      );
      if (layerPopulations.length === 0) return;
      if (layerPopulations.length === 1) {
        const target = layerPopulations[0];
        flyToPopulation(map, target.latitude, target.longitude);
        return;
      }

      fitMapToCoordinates(
        map,
        layerPopulations.map((population) => ({
          latitude: population.latitude,
          longitude: population.longitude,
        }))
      );
      return;
    }

    if (layerConfig.kind === "populationSelection") {
      const selectedPopulation = selectedPopulationId
        ? populationRecordsRef.current.find((record) => record.id === selectedPopulationId)
        : null;
      if (!selectedPopulation) return;
      flyToPopulation(map, selectedPopulation.latitude, selectedPopulation.longitude);
    }
  }

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new MapLibre.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [121, 13],
      zoom: 5,
    });

    mapInstance.current = map;

    map.on("load", () => {
      ensureHazardLayer(map);
      ensurePopulationLayer(map);
      void syncManagedLayers(
        map,
        sheltersRef.current,
        layerConfigsRef.current,
        selectedShelterIdRef.current
      );
      const hazardSource = map.getSource(HAZARD_SOURCE_ID) as MapLibre.GeoJSONSource | null;
      const hazardBuild = buildHazardGeoJSONWithRadii(
        hazardsRef.current,
        hazardResolvedRadiusRef.current
      );
      hazardResolvedRadiusRef.current = hazardBuild.resolvedRadiusByHazardId;
      hazardSource?.setData(hazardBuild.collection);

      ensurePopulationLayer(map);
      const populationSource = map.getSource(POPULATION_SOURCE_ID) as MapLibre.GeoJSONSource | null;
      const nextResolutionMode = loadPopulationResolutionModeFromStorage() ?? populationResolutionMode;
      const nextSubzoneCount = loadPopulationSubzoneCountFromStorage();
      populationSource?.setData(
        buildPopulationGeoJSON(
          populationRecordsRef.current,
          nextResolutionMode,
          nextSubzoneCount
        )
      );
      hoverPopupRef.current = new MapLibre.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: "shelter-hover-popup",
      });
      const populationLayers = [
        POPULATION_POLYGON_LAYER_ID,
        POPULATION_OUTLINE_LAYER_ID,
        POPULATION_SELECTED_LAYER_ID,
      ];
      const clearHoverState = () => {
        hoveredShelterIdRef.current = null;
        hoveredHazardIdRef.current = null;
        hoveredPopulationIdRef.current = null;
        hoverPopupRef.current?.remove();
        map.getCanvas().style.cursor = "";
      };

      map.on("mousemove", (event) => {
        const interactiveLayerIds = getInteractiveLayerIds(map, layerConfigsRef.current);
        const hoveredShelterFeature =
          interactiveLayerIds.length > 0
            ? map.queryRenderedFeatures(event.point, {
                layers: interactiveLayerIds,
              })[0]
            : null;
        const hoveredHazardFeature = map.queryRenderedFeatures(event.point, {
          layers: [HAZARD_FILL_LAYER_ID, HAZARD_OUTLINE_LAYER_ID],
        })[0];
        const hoveredPopulationFeature = map.queryRenderedFeatures(event.point, {
          layers: populationLayers,
        })[0];
        if (!hoveredShelterFeature && !hoveredHazardFeature && !hoveredPopulationFeature) {
          clearHoverState();
          return;
        }

        const hoverPopup = hoverPopupRef.current;
        if (!hoverPopup) return;

        const shelter = hoveredShelterFeature
          ? findShelterByFeature(sheltersRef.current, hoveredShelterFeature)
          : null;
        if (shelter) {
          if (hoveredShelterIdRef.current === shelter.id) return;
          hoveredShelterIdRef.current = shelter.id;
          hoveredHazardIdRef.current = null;
          hoveredPopulationIdRef.current = null;
          map.getCanvas().style.cursor = "pointer";
          hoverPopup
            .setLngLat([shelter.longitude, shelter.latitude])
            .setDOMContent(buildHoverPopupContent(shelter))
            .addTo(map);
          return;
        }

        const populationMeta = getPopulationFeatureMeta(hoveredPopulationFeature);
        const population = findPopulationByFeature(
          populationRecordsRef.current,
          hoveredPopulationFeature
        );
        if (population) {
          const hoveredPopulationKey = `${population.id}::${populationMeta?.zoneName ?? ""}`;
          if (hoveredPopulationIdRef.current === hoveredPopulationKey) return;
          hoveredShelterIdRef.current = null;
          hoveredHazardIdRef.current = null;
          hoveredPopulationIdRef.current = hoveredPopulationKey;
          map.getCanvas().style.cursor = "pointer";
          hoverPopup
            .setLngLat(event.lngLat)
            .setDOMContent(buildPopulationPopupContent(population, populationMeta?.zoneName))
            .addTo(map);
          return;
        }

        const hazard = findHazardByFeature(hazardsRef.current, hoveredHazardFeature);
        if (!hazard) {
          clearHoverState();
          return;
        }

        if (hoveredHazardIdRef.current === hazard.id) return;
        hoveredShelterIdRef.current = null;
        hoveredHazardIdRef.current = hazard.id;
        hoveredPopulationIdRef.current = null;
        map.getCanvas().style.cursor = "pointer";
        hoverPopup
          .setLngLat([hazard.longitude, hazard.latitude])
          .setDOMContent(buildHazardHoverPopupContent(hazard))
          .addTo(map);
      });

      map.on("click", (event) => {
        const interactiveLayerIds = getInteractiveLayerIds(map, layerConfigsRef.current);
        const clickedShelterFeature = map.queryRenderedFeatures(event.point, {
          layers: interactiveLayerIds,
        })[0];
        if (!clickedShelterFeature) {
          const clickedHazardFeature = map.queryRenderedFeatures(event.point, {
            layers: [HAZARD_FILL_LAYER_ID, HAZARD_OUTLINE_LAYER_ID],
          })[0];
          const clickedPopulationFeature = map.queryRenderedFeatures(event.point, {
            layers: [POPULATION_POLYGON_LAYER_ID, POPULATION_OUTLINE_LAYER_ID, POPULATION_SELECTED_LAYER_ID],
          })[0];
          const hazard = findHazardByFeature(hazardsRef.current, clickedHazardFeature);

          setSelectedShelterId(null);
          selectedShelterIdRef.current = null;
          hoveredShelterIdRef.current = null;
          hoveredHazardIdRef.current = null;
          hoveredPopulationIdRef.current = null;
          setSelectedPopulationId(null);
          setSelectedHazardId(null);

          if (!hazard) {
            const population = findPopulationByFeature(
              populationRecordsRef.current,
              clickedPopulationFeature
            );
            if (population) {
              setSelectedPopulationId(population.id);
              hoverPopupRef.current?.remove();
              flyToPopulation(map, population.latitude, population.longitude);
              return;
            }

            hoverPopupRef.current?.remove();
            return;
          }

          hoveredHazardIdRef.current = hazard.id;
          setSelectedHazardId(hazard.id);
          hoverPopupRef.current?.remove();
          flyToHazard(map, hazard.latitude, hazard.longitude);
          return;
        }

        const shelter = findShelterByFeature(sheltersRef.current, clickedShelterFeature);
        if (!shelter) return;

        setSelectedShelterId(shelter.id);
        setSelectedHazardId(null);
        selectedShelterIdRef.current = shelter.id;
        hoveredShelterIdRef.current = null;
        hoverPopupRef.current?.remove();
        flyToShelter(map, shelter);
      });

      const draw = new MaplibreTerradrawControl({
        modes: [
          "render",
          "point",
          "marker",
          "linestring",
          "polygon",
          "rectangle",
          "circle",
          "freehand",
          "freehand-linestring",
          "angled-rectangle",
          "sensor",
          "sector",
          "select",
          "delete-selection",
          "delete",
          "download",
        ],
        open: true,
        showDeleteConfirmation: false,
      });

      map.addControl(draw, "top-left");
    });

    return () => {
      hoveredShelterIdRef.current = null;
      hoveredHazardIdRef.current = null;
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;
    void syncManagedLayers(map, shelters, layerConfigs, selectedShelterId);
    const labelLayer = map.getLayer(POPULATION_SUBZONE_LABEL_LAYER_ID);
    if (labelLayer) {
      const hasVisiblePopulationLayer = layerConfigs.some(
        (layerConfig) =>
          (layerConfig.kind === "populationPolygons" ||
            layerConfig.kind === "populationOutlines" ||
            layerConfig.kind === "populationSelection") &&
          layerConfig.visible
      );
      map.setLayoutProperty(
        POPULATION_SUBZONE_LABEL_LAYER_ID,
        "visibility",
        hasVisiblePopulationLayer ? "visible" : "none"
      );
    }
  }, [layerConfigs, selectedShelterId, shelters]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    ensureHazardLayer(map);
    const hazardSource = map.getSource(HAZARD_SOURCE_ID) as MapLibre.GeoJSONSource | null;
    const hazardBuild = buildHazardGeoJSONWithRadii(
      hazards,
      hazardResolvedRadiusRef.current
    );
    hazardResolvedRadiusRef.current = hazardBuild.resolvedRadiusByHazardId;
    hazardSource?.setData(hazardBuild.collection);
  }, [hazards]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    ensurePopulationLayer(map);
    const populationSource = map.getSource(POPULATION_SOURCE_ID) as MapLibre.GeoJSONSource | null;
    populationSource?.setData(
      buildPopulationGeoJSON(populationRecords, populationResolutionMode, populationSubzoneCount)
    );
    const selectedPopulationLayer = map.getLayer(POPULATION_SELECTED_LAYER_ID);
    if (!selectedPopulationLayer) return;
    selectedPopulationLayer.setFilter([
      "==",
      ["get", "populationId"],
      selectedPopulationId ?? "",
    ]);
  }, [populationRecords, populationResolutionMode, populationSubzoneCount, selectedPopulationId]);

  useEffect(() => {
    if (areaFilterFocusRequest.requestId === 0) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const focusIdSet = new Set(areaFilterFocusRequest.shelterIds);
    const focusShelters = shelters.filter((shelter) => focusIdSet.has(shelter.id));
    if (focusShelters.length === 0) return;

    fitMapToShelters(map, focusShelters);
  }, [areaFilterFocusRequest, shelters]);

  useEffect(() => {
    if (shelterCardFocusRequest.requestId === 0) return;
    if (!shelterCardFocusRequest.shelterId) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetShelter = shelters.find(
      (shelter) => shelter.id === shelterCardFocusRequest.shelterId
    );
    if (!targetShelter) return;

    flyToShelter(map, targetShelter);
    setSelectedShelterId(targetShelter.id);
    setSelectedHazardId(null);
    selectedShelterIdRef.current = targetShelter.id;
  }, [shelterCardFocusRequest, shelters]);

  useEffect(() => {
    if (hazardCardFocusRequest.requestId === 0) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const { latitude, longitude } = hazardCardFocusRequest;
    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    flyToHazard(map, latitude, longitude);
    setSelectedShelterId(null);
    selectedShelterIdRef.current = null;
    setSelectedHazardId(hazardCardFocusRequest.hazardId ?? null);
  }, [hazardCardFocusRequest]);

  useEffect(() => {
    if (populationCardFocusRequest.requestId === 0) return;
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const { municipality, latitude, longitude } = populationCardFocusRequest;
    if (
      municipality === null ||
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    flyToPopulation(map, latitude, longitude);
    const normalizedTargetMunicipality = municipality.trim().toLowerCase();
    if (normalizedTargetMunicipality.length > 0) {
      const targetPopulation = populationRecords.find(
        (record) => record.municipalityCity.trim().toLowerCase() === normalizedTargetMunicipality
      );
      setSelectedPopulationId(targetPopulation?.id ?? null);
    } else {
      setSelectedPopulationId(null);
    }
    setSelectedShelterId(null);
    selectedShelterIdRef.current = null;
    setSelectedHazardId(null);
  }, [populationCardFocusRequest]);

  useEffect(() => {
    if (!selectedShelterId) return;
    const stillExists = shelters.some((shelter) => shelter.id === selectedShelterId);
    if (!stillExists) {
      setSelectedShelterId(null);
      selectedShelterIdRef.current = null;
    }
  }, [selectedShelterId, shelters]);

  useEffect(() => {
    if (!selectedPopulationId) return;
    const stillExists = populationRecords.some((record) => record.id === selectedPopulationId);
    if (!stillExists) {
      setSelectedPopulationId(null);
    }
  }, [selectedPopulationId, populationRecords]);

  useEffect(() => {
    if (!selectedHazardId) return;
    const stillExists = hazards.some((hazard) => hazard.id === selectedHazardId);
    if (!stillExists) {
      setSelectedHazardId(null);
    }
  }, [hazards, selectedHazardId]);

  useEffect(() => {
    onHazardSelectionChange?.(selectedHazardId);
  }, [onHazardSelectionChange, selectedHazardId]);

  function toggleLayerStatusFilter(
    layerId: string,
    status: ShelterRecord["status"],
    checked: boolean
  ) {
    const targetLayer = layerConfigs.find((layer) => layer.id === layerId);
    if (
      !targetLayer ||
      !(
        targetLayer.kind === "shelterPins" ||
        targetLayer.kind === "shelterStatusHalo" ||
        targetLayer.kind === "selectedShelterHighlight"
      )
    ) {
      return;
    }

    updateLayerConfig(layerId, (layerConfig) => {
      const currentSet = new Set(layerConfig.filters.statuses);
      if (checked) currentSet.add(status);
      else currentSet.delete(status);

      const nextStatuses = STATUS_OPTIONS.filter((option) => currentSet.has(option));
      return {
        ...layerConfig,
        filters: {
          ...layerConfig.filters,
          statuses: nextStatuses.length === 0 ? [...STATUS_OPTIONS] : nextStatuses,
        },
      };
    });
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapContainer} className="h-full w-full"></div>

      <LayerManagementPanel
        isCollapsed={isLayerPanelCollapsed}
        onToggleCollapsed={() => setIsLayerPanelCollapsed((current) => !current)}
        layerSearchValue={layerSearchValue}
        onLayerSearchValueChange={setLayerSearchValue}
        layerKindToAdd={layerKindToAdd}
        onLayerKindToAddChange={setLayerKindToAdd}
        selectableLayerKinds={selectableLayerKinds}
        onAddLayer={handleAddLayer}
        hasSavedPreset={Boolean(savedLayerPreset)}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onResetStack={handleResetLayerStack}
        onShowAllLayers={handleShowAllLayers}
        onHideAllLayers={handleHideAllLayers}
        onClearAllLayers={handleClearAllLayers}
              visibilityPresetOptions={visibilityPurposeOptions}
                selectedVisibilityPurpose={selectedVisibilityPurpose}
                visibilityPurposeInput={visibilityPurposeInput}
                onVisibilityPurposeInputChange={setVisibilityPurposeInput}
                onVisibilityPurposeChange={handleVisibilityPurposeChange}
                onSaveVisibilityPreset={handleSaveVisibilityPreset}
        onApplyVisibilityPreset={handleApplyVisibilityPreset}
        onDeleteVisibilityPreset={handleDeleteVisibilityPreset}
        hasVisibilityPresetForSelectedPurpose={hasVisibilityPresetForSelectedPurpose}
        hasAnyVisibilityPreset={visibilityPurposeOptions.length > 0}
        layerConfigs={layerConfigs}
        selectedLayerConfigId={selectedLayerConfigId}
        onSelectLayerConfig={setSelectedLayerConfigId}
        onUpdateLayer={updateLayerConfig}
        onMoveLayer={moveLayer}
        onZoomToLayer={handleZoomToLayer}
        onRemoveLayer={handleRemoveLayer}
        selectedLayerConfig={selectedLayerConfig}
        selectedLayerFeatureCount={selectedLayerFeatureCount}
        layerDiagnosticsUpdatedAt={layerDiagnosticsUpdatedAt}
        isLayerInspectorCollapsed={isLayerInspectorCollapsed}
        onToggleLayerInspectorCollapsed={() =>
          setIsLayerInspectorCollapsed((current) => !current)
        }
        onToggleLayerStatusFilter={toggleLayerStatusFilter}
      />

      <LayerLegendPanel
        activePanel={activePanel}
        layerConfigs={layerConfigs}
        sortedLayerConfigs={sortedLayerConfigs}
        hasSelectedShelter={Boolean(selectedShelter)}
        hasSelectedHazard={Boolean(selectedHazard)}
        hasSelectedPopulation={Boolean(selectedPopulation)}
        isCollapsed={isLegendCollapsed}
        onToggleCollapsed={() =>
          setLegendCollapsedByPanel((current) => ({
            ...current,
            [activePanel]: !(current[activePanel] ?? true),
          }))
        }
      />

      {selectedShelter && (
        <div className="shelter-detail-panel absolute bottom-3 left-3 z-10 w-[280px] rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-[1px]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-neutral-900">{selectedShelter.name}</div>
              <div className="text-xs text-neutral-600">
                {selectedShelter.municipalityCity}, {selectedShelter.region}
              </div>
            </div>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
              onClick={() => setSelectedShelterId(null)}
            >
              Close
            </button>
          </div>
          <div className="space-y-1 text-xs text-neutral-700">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <span
                className="inline-flex rounded-full px-2 py-[1px] text-[11px] font-semibold"
                style={{
                  color: selectedShelterStatusColors?.text,
                  backgroundColor: selectedShelterStatusColors?.background,
                  border: `1px solid ${selectedShelterStatusColors?.border ?? "transparent"}`,
                }}
              >
                {selectedShelter.status}
              </span>
            </div>
            <div>Address: {selectedShelter.address}</div>
            <div>
              Occupancy: {selectedShelter.occupancy.toLocaleString()} /{" "}
              {selectedShelter.capacity.toLocaleString()}
            </div>
            <div>
              Available:{" "}
              {(selectedShelter.capacity - selectedShelter.occupancy).toLocaleString()}
            </div>
            <div>Contact: {selectedShelter.contact}</div>
          </div>
        </div>
      )}

      {selectedHazard && !selectedShelter && (
        <div className="shelter-detail-panel absolute bottom-3 left-3 z-10 w-[300px] rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-[1px]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-neutral-900">{selectedHazard.name}</div>
              <div className="text-xs text-neutral-600">
                {selectedHazard.municipalityCity}, {selectedHazard.region}
              </div>
            </div>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
              onClick={() => setSelectedHazardId(null)}
            >
              Close
            </button>
          </div>
          <div className="space-y-1 text-xs text-neutral-700">
            <div>Type: {selectedHazard.type}</div>
            <div>Status: {selectedHazard.status}</div>
            <div>Severity: {selectedHazard.severity}</div>
            <div>Forecast lead: {selectedHazard.forecastLeadHours} hrs</div>
            <div>Affected barangays: {selectedHazard.affectedBarangays.toLocaleString()}</div>
            <div>
              Estimated affected population:{" "}
              {selectedHazard.estimatedAffectedPopulation.toLocaleString()}
            </div>
            <div>
              Expected evacuee need: {selectedHazard.expectedEvacueeNeed.toLocaleString()}
            </div>
            <div>Source: {selectedHazard.sourceAgency || "—"}</div>
            <div>Last updated: {selectedHazard.lastUpdated}</div>
            <div>Notes: {selectedHazard.notes || "—"}</div>
          </div>
        </div>
      )}

      {selectedPopulation && !selectedShelter && !selectedHazard && (
        <div className="shelter-detail-panel absolute bottom-3 left-3 z-10 w-[300px] rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-[1px]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-neutral-900">
                {selectedPopulation.municipalityCity} Population
              </div>
              <div className="text-xs text-neutral-600">
                {selectedPopulation.municipalityCity}, {selectedPopulation.region}
              </div>
            </div>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
              onClick={() => setSelectedPopulationId(null)}
            >
              Close
            </button>
          </div>
          <div className="space-y-1 text-xs text-neutral-700">
            <div>Total population: {selectedPopulation.totalPopulation.toLocaleString()}</div>
            <div>At-risk population: {selectedPopulation.atRiskPopulation.toLocaleString()}</div>
            <div>
              Exposure:{" "}
              {selectedPopulation.totalPopulation === 0
                ? "0"
                : Math.round(
                    (selectedPopulation.atRiskPopulation / selectedPopulation.totalPopulation) * 100
                  )}
              %
            </div>
            <div>Notes: {selectedPopulation.notes || "—"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
