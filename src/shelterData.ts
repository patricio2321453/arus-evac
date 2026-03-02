export const regionOptions = ["Luzon", "Visayas", "Mindanao"] as const;
export type Region = (typeof regionOptions)[number];

export type ShelterRecord = {
  id: string;
  name: string;
  region: Region;
  municipalityCity: string;
  address: string;
  capacity: number;
  occupancy: number;
  status: "Open" | "Limited" | "Full";
  contact: string;
  medicalSupport: "Yes" | "No";
  lastUpdated: string;
  latitude: number;
  longitude: number;
};

export const initialShelters: ShelterRecord[] = [
  {
    id: "s-001",
    name: "San Isidro Community Hall",
    region: "Luzon",
    municipalityCity: "Batangas City",
    address: "Blk 2 P. Gomez St., San Isidro",
    capacity: 280,
    occupancy: 162,
    status: "Open",
    contact: "0917-215-4451",
    medicalSupport: "Yes",
    lastUpdated: "10 mins ago",
    latitude: 13.7565,
    longitude: 121.0583,
  },
  {
    id: "s-002",
    name: "Riverside Elementary Gym",
    region: "Luzon",
    municipalityCity: "Calapan City",
    address: "Riverside Rd., Brgy. 12",
    capacity: 190,
    occupancy: 171,
    status: "Limited",
    contact: "0918-433-1022",
    medicalSupport: "No",
    lastUpdated: "16 mins ago",
    latitude: 13.4115,
    longitude: 121.1803,
  },
  {
    id: "s-003",
    name: "City Sports Complex",
    region: "Visayas",
    municipalityCity: "Cebu City",
    address: "Quezon Ave., City Proper",
    capacity: 540,
    occupancy: 520,
    status: "Full",
    contact: "0920-115-4777",
    medicalSupport: "Yes",
    lastUpdated: "8 mins ago",
    latitude: 10.3157,
    longitude: 123.8854,
  },
  {
    id: "s-004",
    name: "Sta. Cruz Covered Court",
    region: "Visayas",
    municipalityCity: "Iloilo City",
    address: "Mabini St., Sta. Cruz",
    capacity: 210,
    occupancy: 124,
    status: "Open",
    contact: "0919-332-6480",
    medicalSupport: "Yes",
    lastUpdated: "22 mins ago",
    latitude: 10.7202,
    longitude: 122.5621,
  },
  {
    id: "s-005",
    name: "South Bay Multipurpose Center",
    region: "Mindanao",
    municipalityCity: "Davao City",
    address: "Harbor View Dr., South Bay",
    capacity: 320,
    occupancy: 319,
    status: "Full",
    contact: "0916-775-2931",
    medicalSupport: "No",
    lastUpdated: "5 mins ago",
    latitude: 7.1907,
    longitude: 125.4553,
  },
  {
    id: "s-006",
    name: "Lakeside National High School",
    region: "Mindanao",
    municipalityCity: "Cagayan de Oro City",
    address: "Lakeside Rd., Brgy. Maligaya",
    capacity: 410,
    occupancy: 248,
    status: "Open",
    contact: "0935-228-6670",
    medicalSupport: "Yes",
    lastUpdated: "14 mins ago",
    latitude: 8.4542,
    longitude: 124.6319,
  },
];
