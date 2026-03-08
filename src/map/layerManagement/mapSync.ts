import type { FeatureCollection, Point } from "geojson";
import MapLibre, { type GeoJSONSource } from "maplibre-gl";
import type { ShelterRecord } from "../../shelterData";
import pinIcon from "../../assets/icons/pin.png";
import { getLayerIdForKind } from "./config";
import { STATUS_OPTIONS, type LayerConfig, type LayerFilters, type LayerKind } from "./types";

export const SHELTER_SOURCE_ID = "shelter-locations";
const SHELTER_PIN_IMAGE_ID = "shelter-pin-image";

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
  return shelters.filter((shelter) => {
    const matchesRegion = filters.region === "all" || shelter.region === filters.region;
    const municipalityQuery = normalizeLocation(filters.municipalityCity);
    const matchesMunicipality =
      municipalityQuery.length === 0 ||
      normalizeLocation(shelter.municipalityCity) === municipalityQuery;
    const matchesStatus = filters.statuses.includes(shelter.status);
    const matchesSelected =
      kind !== "selectedShelterHighlight" ||
      (selectedShelterId !== null && shelter.id === selectedShelterId);

    return matchesRegion && matchesMunicipality && matchesStatus && matchesSelected;
  });
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

  if (layerConfig.filters.statuses.length < STATUS_OPTIONS.length) {
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
  } else {
    map.setPaintProperty(layerId, "circle-opacity", layerConfig.style.opacity);
    map.setPaintProperty(layerId, "circle-radius", layerConfig.style.radius);
    map.setPaintProperty(layerId, "circle-stroke-width", layerConfig.style.strokeWidth);
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
  (["shelterPins", "shelterStatusHalo", "selectedShelterHighlight"] as LayerKind[]).forEach(
    (kind) => {
      if (!configuredKinds.has(kind)) {
        removeManagedLayerIfExists(map, kind);
      }
    }
  );

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
        (layerConfig.kind === "shelterPins" || layerConfig.kind === "shelterStatusHalo")
    )
    .map((layerConfig) => getLayerIdForKind(layerConfig.kind))
    .filter((layerId) => map.getLayer(layerId));
}
