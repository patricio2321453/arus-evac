import type { ShelterRecord } from "../../shelterData";

export const STATUS_OPTIONS: ShelterRecord["status"][] = [
  "Open",
  "Limited",
  "Full",
];

export type LayerKind =
  | "shelterPins"
  | "shelterStatusHalo"
  | "selectedShelterHighlight"
  | "hazardFill"
  | "hazardOutline"
  | "populationPolygons"
  | "populationOutlines"
  | "populationSelection";

export type LayerGroup = "Shelters" | "Hazards" | "Population";

export type LayerFilters = {
  region: "all" | ShelterRecord["region"];
  municipalityCity: string;
  statuses: ShelterRecord["status"][];
};

export type LayerStyle = {
  opacity: number;
  iconSize: number;
  radius: number;
  strokeWidth: number;
};

export type LayerConfig = {
  id: string;
  kind: LayerKind;
  name: string;
  group: LayerGroup;
  visible: boolean;
  order: number;
  filters: LayerFilters;
  style: LayerStyle;
  timeSync: boolean;
};

export const RENDER_COST_HINT_BY_KIND: Record<LayerKind, string> = {
  shelterPins: "Low",
  shelterStatusHalo: "Medium",
  selectedShelterHighlight: "Low",
  hazardFill: "Medium",
  hazardOutline: "Low",
  populationPolygons: "Medium",
  populationOutlines: "Low",
  populationSelection: "Low",
};
