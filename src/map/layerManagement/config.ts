import type { LayerConfig, LayerFilters, LayerKind, LayerStyle } from "./types";
import { STATUS_OPTIONS } from "./types";

export const ALL_LAYER_KINDS: LayerKind[] = [
  "shelterPins",
  "shelterStatusHalo",
  "selectedShelterHighlight",
  "hazardFill",
  "hazardOutline",
  "populationPolygons",
  "populationOutlines",
  "populationSelection",
];

export function getLayerIdForKind(kind: LayerKind) {
  if (kind === "shelterPins") return "lm-shelter-pins";
  if (kind === "shelterStatusHalo") return "lm-shelter-status-halo";
  if (kind === "hazardFill") return "hazard-isochrones-fill-layer";
  if (kind === "hazardOutline") return "hazard-isochrones-outline-layer";
  if (kind === "populationPolygons") return "population-polygons-layer";
  if (kind === "populationOutlines") return "population-polygons-outline-layer";
  if (kind === "populationSelection") return "population-points-selected-layer";
  return "lm-selected-shelter-highlight";
}

export function getLayerLabelForKind(kind: LayerKind) {
  if (kind === "shelterPins") return "Shelter Pins";
  if (kind === "shelterStatusHalo") return "Shelter Status Halo";
  if (kind === "hazardFill") return "Hazard Isopleth Fill";
  if (kind === "hazardOutline") return "Hazard Isopleth Outline";
  if (kind === "populationPolygons") return "Population Isopleths";
  if (kind === "populationOutlines") return "Population Isopleth Outline";
  if (kind === "populationSelection") return "Selected Population Isopleth";
  return "Selected Shelter Highlight";
}

export function createDefaultLayerFilters(): LayerFilters {
  return {
    region: "all",
    municipalityCity: "",
    statuses: [...STATUS_OPTIONS],
  };
}

export function createDefaultLayerStyle(kind: LayerKind): LayerStyle {
  if (kind === "shelterPins") {
    return {
      opacity: 1,
      iconSize: 0.08,
      radius: 10,
      strokeWidth: 1.5,
    };
  }

  if (kind === "shelterStatusHalo") {
    return {
      opacity: 0.35,
      iconSize: 0.08,
      radius: 12,
      strokeWidth: 1.5,
    };
  }

  if (kind === "selectedShelterHighlight") {
    return {
      opacity: 0.85,
      iconSize: 0.08,
      radius: 16,
      strokeWidth: 3,
    };
  }

  if (kind === "hazardFill" || kind === "populationPolygons") {
    return {
      opacity: 0.22,
      iconSize: 0.08,
      radius: 14,
      strokeWidth: 1.5,
    };
  }

  if (kind === "hazardOutline" || kind === "populationOutlines") {
    return {
      opacity: 0.9,
      iconSize: 0.08,
      radius: 14,
      strokeWidth: 2,
    };
  }

  return {
    opacity: 0.45,
    iconSize: 0.08,
    radius: 14,
    strokeWidth: 3,
  };
}

export function createLayerConfig(kind: LayerKind, order: number): LayerConfig {
  const group: LayerConfig["group"] =
    kind === "hazardFill" || kind === "hazardOutline"
      ? "Hazards"
      : kind.startsWith("population")
      ? "Population"
      : "Shelters";

  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: getLayerLabelForKind(kind),
    group,
    visible: true,
    order,
    filters: createDefaultLayerFilters(),
    style: createDefaultLayerStyle(kind),
    timeSync: false,
  };
}

export function createDefaultLayerStack(): LayerConfig[] {
  return [
    createLayerConfig("shelterStatusHalo", 0),
    createLayerConfig("shelterPins", 1),
    createLayerConfig("selectedShelterHighlight", 2),
    createLayerConfig("hazardFill", 3),
    createLayerConfig("hazardOutline", 4),
    createLayerConfig("populationPolygons", 5),
    createLayerConfig("populationOutlines", 6),
    createLayerConfig("populationSelection", 7),
  ];
}

export function normalizeLayerOrder(layerConfigs: LayerConfig[]) {
  return layerConfigs.map((layerConfig, index) => ({ ...layerConfig, order: index }));
}

export function cloneLayerConfigs(layerConfigs: LayerConfig[]) {
  return layerConfigs.map((layerConfig) => ({
    ...layerConfig,
    filters: {
      ...layerConfig.filters,
      statuses: [...layerConfig.filters.statuses],
    },
    style: {
      ...layerConfig.style,
    },
  }));
}
