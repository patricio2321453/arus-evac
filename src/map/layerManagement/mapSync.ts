import type { FeatureCollection, Point } from "geojson";
import MapLibre, { type GeoJSONSource } from "maplibre-gl";
import type { ShelterRecord } from "../../shelterData";
import pinIcon from "../../assets/icons/pin.png";
import { ALL_LAYER_KINDS, getLayerIdForKind } from "./config";
import { STATUS_OPTIONS, type LayerConfig, type LayerFilters, type LayerKind } from "./types";

export const SHELTER_SOURCE_ID = "shelter-locations";
const SHELTER_PIN_IMAGE_ID = "shelter-pin-image";
const HAZARD_SOURCE_ID = "hazard-isochrones-source";
const POPULATION_SOURCE_ID = "population-points-source";

function toShelterFeatureCollection(
  shelters: ShelterRecord[]
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: shelters.map((shelter) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [shelter.longitude, shelter.latitude],
      },
      properties: {
        id: shelter.id,
        name: shelter.name,
        region: shelter.region,
        municipalityCity: shelter.municipalityCity,
        status: shelter.status,
      },
    })),
  };
}

function ensureShelterSource(map: MapLibre.Map) {
  if (!map.getSource(SHELTER_SOURCE_ID)) {
    map.addSource(SHELTER_SOURCE_ID, {
      type: "geojson",
      data: toShelterFeatureCollection([]),
    });
  }
}

async function ensureShelterPinImage(map: MapLibre.Map) {
  if (map.hasImage(SHELTER_PIN_IMAGE_ID)) return true;

  try {
    const response = await map.loadImage(pinIcon);
    if (!map.hasImage(SHELTER_PIN_IMAGE_ID)) {
      map.addImage(SHELTER_PIN_IMAGE_ID, response.data);
    }
    return true;
  } catch {
    return false;
  }
}

function ensureLayerForKind(map: MapLibre.Map, kind: LayerKind) {
  const layerId = getLayerIdForKind(kind);
  if (map.getLayer(layerId)) return;

  if (kind === "shelterPins") {
    if (!map.hasImage(SHELTER_PIN_IMAGE_ID)) return;
    map.addLayer({
      id: layerId,
      type: "symbol",
      source: SHELTER_SOURCE_ID,
      layout: {
        "icon-image": SHELTER_PIN_IMAGE_ID,
        "icon-size": 0.08,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        visibility: "visible",
      },
      paint: {
        "icon-opacity": 1,
      },
    });
    return;
  }

  if (kind === "shelterStatusHalo") {
    map.addLayer({
      id: layerId,
      type: "circle",
      source: SHELTER_SOURCE_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "status"],
          "Open",
          "#22c55e",
          "Limited",
          "#f59e0b",
          "Full",
          "#ef4444",
          "#9ca3af",
        ],
        "circle-radius": 12,
        "circle-opacity": 0.35,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
      layout: {
        visibility: "visible",
      },
    });
    return;
  }

  if (kind === "selectedShelterHighlight") {
    map.addLayer({
      id: layerId,
      type: "circle",
      source: SHELTER_SOURCE_ID,
      paint: {
        "circle-color": "rgba(59, 130, 246, 0.35)",
        "circle-radius": 16,
        "circle-opacity": 0.85,
        "circle-stroke-color": "#1d4ed8",
        "circle-stroke-width": 3,
      },
      layout: {
        visibility: "visible",
      },
      filter: ["==", ["get", "id"], "__none__"],
    });
    return;
  }

  if (!map.getSource(HAZARD_SOURCE_ID) && !map.getSource(POPULATION_SOURCE_ID)) return;

  if (kind === "hazardFill") {
    map.addLayer({
      id: layerId,
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
    return;
  }

  if (kind === "hazardOutline") {
    map.addLayer({
      id: layerId,
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
    return;
  }

  if (kind === "populationPolygons") {
    map.addLayer({
      id: layerId,
      type: "fill",
      source: POPULATION_SOURCE_ID,
      paint: {
        "fill-color": [
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
        "fill-opacity": [
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
      },
    });
    return;
  }

  if (kind === "populationOutlines") {
    map.addLayer({
      id: layerId,
      type: "line",
      source: POPULATION_SOURCE_ID,
      paint: {
        "line-color": [
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
        "line-width": ["interpolate", ["linear"], ["to-number", ["get", "radiusKm"], 0], 0, 0.8, 4, 1.6],
        "line-opacity": 0.45,
      },
    });
    return;
  }

  if (kind === "populationSelection") {
    map.addLayer({
      id: layerId,
      type: "fill",
      source: POPULATION_SOURCE_ID,
      filter: ["==", ["get", "id"], "__none__"],
      paint: {
        "fill-color": "#0ea5e9",
        "fill-opacity": 0.45,
        "fill-outline-color": "#0f172a",
      },
    });
  }
}

function removeManagedLayerIfExists(map: MapLibre.Map, kind: LayerKind) {
  const layerId = getLayerIdForKind(kind);
  if (!map.getLayer(layerId)) return;
  map.removeLayer(layerId);
}

function setShelterSourceData(map: MapLibre.Map, shelters: ShelterRecord[]) {
  ensureShelterSource(map);
  const source = map.getSource(SHELTER_SOURCE_ID);
  if (!source) return;

  (source as GeoJSONSource).setData(toShelterFeatureCollection(shelters));
}

function normalizeLocation(value: string) {
  return value.trim().toLowerCase();
}

export function getFilteredShelters(
  shelters: ShelterRecord[],
  filters: LayerFilters,
  kind: LayerKind,
  selectedShelterId: string | null
) {
  const isShelterKind = isShelterVisualLayer(kind);
  return shelters.filter((shelter) => {
    const matchesRegion = filters.region === "all" || shelter.region === filters.region;
    const municipalityQuery = normalizeLocation(filters.municipalityCity);
    const matchesMunicipality =
      municipalityQuery.length === 0 ||
      normalizeLocation(shelter.municipalityCity) === municipalityQuery;
    const matchesStatus = isShelterKind ? filters.statuses.includes(shelter.status) : true;
    const matchesSelected =
      kind !== "selectedShelterHighlight" ||
      (selectedShelterId !== null && shelter.id === selectedShelterId);

    return matchesRegion && matchesMunicipality && matchesStatus && matchesSelected;
  });
}

function isShelterVisualLayer(kind: LayerKind) {
  return (
    kind === "shelterPins" || kind === "shelterStatusHalo" || kind === "selectedShelterHighlight"
  );
}

function buildLayerFilter(
  layerConfig: LayerConfig,
  selectedShelterId: string | null
): unknown {
  const clauses: unknown[] = ["all"];

  if (layerConfig.filters.region !== "all") {
    clauses.push(["==", ["get", "region"], layerConfig.filters.region]);
  }

  const municipalityQuery = layerConfig.filters.municipalityCity.trim();
  if (municipalityQuery.length > 0) {
    clauses.push(["==", ["get", "municipalityCity"], municipalityQuery]);
  }

  if (isShelterVisualLayer(layerConfig.kind) && layerConfig.filters.statuses.length < STATUS_OPTIONS.length) {
    clauses.push(["in", ["get", "status"], ["literal", layerConfig.filters.statuses]]);
  }

  if (layerConfig.kind === "selectedShelterHighlight") {
    if (!selectedShelterId) {
      clauses.push(["==", ["get", "id"], "__none__"]);
    } else {
      clauses.push(["==", ["get", "id"], selectedShelterId]);
    }
  }

  return clauses.length === 1 ? null : clauses;
}

function applyLayerStyle(
  map: MapLibre.Map,
  layerConfig: LayerConfig,
  selectedShelterId: string | null
) {
  const layerId = getLayerIdForKind(layerConfig.kind);
  if (!map.getLayer(layerId)) return;

  map.setLayoutProperty(layerId, "visibility", layerConfig.visible ? "visible" : "none");

  if (layerConfig.kind === "shelterPins") {
    map.setLayoutProperty(layerId, "icon-size", layerConfig.style.iconSize);
    map.setPaintProperty(layerId, "icon-opacity", layerConfig.style.opacity);
  } else if (
    layerConfig.kind === "shelterStatusHalo" ||
    layerConfig.kind === "selectedShelterHighlight"
  ) {
    map.setPaintProperty(layerId, "circle-opacity", layerConfig.style.opacity);
    map.setPaintProperty(layerId, "circle-radius", layerConfig.style.radius);
    map.setPaintProperty(layerId, "circle-stroke-width", layerConfig.style.strokeWidth);
  } else if (
    layerConfig.kind === "hazardFill" ||
    layerConfig.kind === "populationPolygons" ||
    layerConfig.kind === "populationSelection"
  ) {
    map.setPaintProperty(layerId, "fill-opacity", layerConfig.style.opacity);
  } else if (layerConfig.kind === "hazardOutline" || layerConfig.kind === "populationOutlines") {
    map.setPaintProperty(layerId, "line-opacity", layerConfig.style.opacity);
    map.setPaintProperty(layerId, "line-width", layerConfig.style.strokeWidth);
  }

  const filter = buildLayerFilter(layerConfig, selectedShelterId);
  map.setFilter(layerId, filter as never);
}

export async function syncManagedLayers(
  map: MapLibre.Map,
  shelters: ShelterRecord[],
  layerConfigs: LayerConfig[],
  selectedShelterId: string | null
) {
  setShelterSourceData(map, shelters);
  await ensureShelterPinImage(map);

  const configuredKinds = new Set(layerConfigs.map((layerConfig) => layerConfig.kind));
  ALL_LAYER_KINDS.forEach((kind) => {
    if (!configuredKinds.has(kind)) {
      removeManagedLayerIfExists(map, kind);
    }
  });

  layerConfigs.forEach((layerConfig) => {
    ensureLayerForKind(map, layerConfig.kind);
    applyLayerStyle(map, layerConfig, selectedShelterId);
  });

  const orderedLayerConfigs = [...layerConfigs].sort((a, b) => a.order - b.order);
  orderedLayerConfigs.forEach((layerConfig) => {
    const layerId = getLayerIdForKind(layerConfig.kind);
    if (!map.getLayer(layerId)) return;
    map.moveLayer(layerId);
  });
}

export function getInteractiveLayerIds(map: MapLibre.Map, layerConfigs: LayerConfig[]) {
  return layerConfigs
    .filter(
      (layerConfig) =>
        layerConfig.visible &&
        isShelterVisualLayer(layerConfig.kind) &&
        ["shelterPins", "shelterStatusHalo", "selectedShelterHighlight"].includes(
          layerConfig.kind
        )
    )
    .map((layerConfig) => getLayerIdForKind(layerConfig.kind))
    .filter((layerId) => map.getLayer(layerId));
}
