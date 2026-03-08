import type { LayerConfig, LayerFilters, LayerKind, LayerStyle } from "./types";
import { STATUS_OPTIONS } from "./types";

export function getLayerIdForKind(kind: LayerKind) {
  if (kind === "shelterPins") return "lm-shelter-pins";
  if (kind === "shelterStatusHalo") return "lm-shelter-status-halo";
  return "lm-selected-shelter-highlight";
}

export function getLayerLabelForKind(kind: LayerKind) {
  if (kind === "shelterPins") return "Shelter Pins";
  if (kind === "shelterStatusHalo") return "Shelter Status Halo";
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

  return {
    opacity: 0.85,
    iconSize: 0.08,
    radius: 16,
    strokeWidth: 3,
  };
}

export function createLayerConfig(kind: LayerKind, order: number): LayerConfig {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: getLayerLabelForKind(kind),
    group: "Shelters",
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
