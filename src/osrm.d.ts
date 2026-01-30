export interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
  waypoints: {
    hint: string;
    distance: number;
    name: string;
    location: [number, number];
  }[];
}

export interface OSRMRoute {
  legs: OSRMLeg[];
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
  geometry: {
    coordinates: [number, number][];
    type: "LineString";
  };
}

export interface OSRMLeg {
  steps: OSRMStep[];
  summary: string;
  weight: number;
  duration: number;
  distance: number;
}

export interface OSRMStep {
  geometry: {
    coordinates: [number, number][];
    type: "LineString";
  };
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    bearing_before?: number;
    bearing_after?: number;
  };
  name: string;
  duration: number;
  distance: number;
  driving_side?: string;
  mode?: string;
}