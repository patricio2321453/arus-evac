import { ArrowLeftIcon, PlusIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  hazardSeverityOptions,
  hazardStatusOptions,
  hazardTypeOptions,
  type HazardRecord,
  type HazardSeverity,
  type HazardStatus,
  type HazardType,
} from "./hazardData";
import { regionOptions, type Region } from "./shelterData";
import editIcon from "./assets/icons/editing.png";
import trashIcon from "./assets/icons/trash.png";

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

function HazardDetail({ label, value }: { label: string; value: string }) {
  return (
    <Flex justify="between" gap="2">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="1" weight="medium">
        {value}
      </Text>
    </Flex>
  );
}

function parsePositiveNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function parseSeverityColor(severity: HazardSeverity) {
  if (severity === "Low") return "green";
  if (severity === "Moderate") return "blue";
  if (severity === "High") return "orange";
  return "red";
}

function createBlankHazardDraft(region: Region): Omit<HazardRecord, "id" | "lastUpdated"> {
  return {
    name: "",
    type: "Flood",
    status: "Monitoring",
    severity: "Low",
    region,
    municipalityCity: "",
    forecastLeadHours: 24,
    affectedBarangays: 0,
    estimatedAffectedPopulation: 0,
    expectedEvacueeNeed: 0,
    sourceAgency: "",
    notes: "",
    latitude: 0,
    longitude: 0,
  };
}

function normalizeLocation(value: string) {
  return value.trim().toLowerCase();
}

function HazardManagement({
  onHazardCardFocus,
  editingHazardId,
  onEditingHazardIdChange,
  hazards,
  setHazards,
}: {
  onHazardCardFocus: (hazardId: string, latitude: number, longitude: number) => void;
  editingHazardId: string | null;
  onEditingHazardIdChange: (hazardId: string | null) => void;
  hazards: HazardRecord[];
  setHazards: Dispatch<SetStateAction<HazardRecord[]>>;
}) {
  const [panel, setPanel] = useState<"list" | "form">("list");
  const [searchValue, setSearchValue] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<"all" | Region>("all");
  const [selectedType, setSelectedType] = useState<"all" | HazardType>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | HazardStatus>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | HazardSeverity>("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Omit<HazardRecord, "id" | "lastUpdated">>(() =>
    createBlankHazardDraft(regionOptions[0])
  );
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  useEffect(() => {
    const availableIds = new Set(hazards.map((hazard) => hazard.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
    if (editingHazardId && !availableIds.has(editingHazardId)) {
      onEditingHazardIdChange(null);
    }
  }, [hazards, editingHazardId]);

  const municipalityOptions = useMemo(() => {
    const scopedHazards =
      selectedRegion === "all"
        ? hazards
        : hazards.filter((hazard) => hazard.region === selectedRegion);
    return [...new Set(scopedHazards.map((hazard) => hazard.municipalityCity))].sort();
  }, [hazards, selectedRegion]);

  const filteredHazards = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const municipalityQuery = municipalityFilter.trim().toLowerCase();

    return hazards.filter((hazard) => {
      const matchesSearch =
        query.length === 0 ||
        hazard.name.toLowerCase().includes(query) ||
        hazard.notes.toLowerCase().includes(query) ||
        hazard.sourceAgency.toLowerCase().includes(query);

      const matchesRegion = selectedRegion === "all" || hazard.region === selectedRegion;
      const matchesType = selectedType === "all" || hazard.type === selectedType;
      const matchesStatus = selectedStatus === "all" || hazard.status === selectedStatus;
      const matchesSeverity = selectedSeverity === "all" || hazard.severity === selectedSeverity;
      const matchesMunicipality =
        municipalityQuery.length === 0 ||
        normalizeLocation(hazard.municipalityCity) === municipalityQuery;

      return (
        matchesSearch &&
        matchesRegion &&
        matchesType &&
        matchesStatus &&
        matchesSeverity &&
        matchesMunicipality
      );
    });
  }, [
    hazards,
    municipalityFilter,
    searchValue,
    selectedRegion,
    selectedSeverity,
    selectedStatus,
    selectedType,
  ]);

  const totals = useMemo(() => {
    const totalAffectedPopulation = filteredHazards.reduce(
      (sum, hazard) => sum + hazard.estimatedAffectedPopulation,
      0
    );
    const totalEvacueeNeed = filteredHazards.reduce(
      (sum, hazard) => sum + hazard.expectedEvacueeNeed,
      0
    );
    const totalBarangays = filteredHazards.reduce(
      (sum, hazard) => sum + hazard.affectedBarangays,
      0
    );
    const highPriority = filteredHazards.filter(
      (hazard) => hazard.severity === "High" || hazard.severity === "Critical"
    ).length;

    return {
      totalHazards: filteredHazards.length,
      totalAffectedPopulation,
      totalEvacueeNeed,
      totalBarangays,
      highPriority,
    };
  }, [filteredHazards]);

  const isDraftNameValid = draft.name.trim().length > 0;
  const isDraftMunicipalityValid = draft.municipalityCity.trim().length > 0;
  const isDraftValid = isDraftNameValid && isDraftMunicipalityValid;

  const visibleIds = filteredHazards.map((hazard) => hazard.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelectHazard(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id]
    );
  }

  function toggleSelectVisible() {
    if (visibleIds.length === 0) return;
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return [...next];
    });
  }

  function resetFormDraft(nextRegion: "all" | Region = "all") {
    const region = nextRegion === "all" ? regionOptions[0] : nextRegion;
    setDraft(createBlankHazardDraft(region));
  }

  function openAddForm() {
    onEditingHazardIdChange(null);
    setFormSubmitAttempted(false);
    resetFormDraft(selectedRegion);
    setPanel("form");
  }

  function beginEdit(hazard: HazardRecord) {
    onEditingHazardIdChange(hazard.id);
    setDraft({
      name: hazard.name,
      type: hazard.type,
      status: hazard.status,
      severity: hazard.severity,
      region: hazard.region,
      municipalityCity: hazard.municipalityCity,
      forecastLeadHours: hazard.forecastLeadHours,
      affectedBarangays: hazard.affectedBarangays,
      estimatedAffectedPopulation: hazard.estimatedAffectedPopulation,
      expectedEvacueeNeed: hazard.expectedEvacueeNeed,
      sourceAgency: hazard.sourceAgency,
      notes: hazard.notes,
      latitude: hazard.latitude,
      longitude: hazard.longitude,
    });
    setFormSubmitAttempted(false);
    setPanel("form");
  }

  function updateDraft(changes: Partial<HazardRecord>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function saveDraft() {
    setFormSubmitAttempted(true);
    const trimmedName = draft.name.trim();
    if (!isDraftValid) return;

    if (!editingHazardId) {
      const nextHazard: HazardRecord = {
        ...draft,
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        lastUpdated: "just now",
      };
      setHazards((current) => [nextHazard, ...current]);
      setPanel("list");
      setFormSubmitAttempted(false);
      return;
    }

    setHazards((current) =>
      current.map((hazard) =>
        hazard.id === editingHazardId
          ? { ...hazard, ...draft, id: hazard.id, name: trimmedName, lastUpdated: "just now" }
          : hazard
      )
    );
    onEditingHazardIdChange(null);
    setFormSubmitAttempted(false);
    setPanel("list");
  }

  function cancelForm() {
    onEditingHazardIdChange(null);
    setFormSubmitAttempted(false);
    resetFormDraft(selectedRegion);
    setPanel("list");
  }

  function deleteHazard(id: string) {
    setHazards((current) => current.filter((hazard) => hazard.id !== id));
    setSelectedIds((current) => current.filter((currentId) => currentId !== id));
    if (editingHazardId === id) {
      onEditingHazardIdChange(null);
      setPanel("list");
    }
  }

  function deleteSelectedHazards() {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    setHazards((current) => current.filter((hazard) => !selectedSet.has(hazard.id)));
    setSelectedIds([]);
    if (editingHazardId && selectedSet.has(editingHazardId)) {
      onEditingHazardIdChange(null);
      setPanel("list");
    }
  }

  return (
    <>
      {panel === "list" && (
        <Flex direction="column" gap="3">
          <Heading size="8">Hazard Management</Heading>
          <Text size="2" color="gray">
            Track hazards, coordinate operational watch levels, and estimate response
            impact by region.
          </Text>

          <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Text as="div" size="2" weight="bold">
              Planning Note
            </Text>
            <Text as="div" size="1" color="gray">
              Hazard entries are planning inputs and should be synchronized with
              latest incident reports.
            </Text>
          </Box>

          <Button onClick={openAddForm}>
            <PlusIcon />
            Add Hazard
          </Button>

          <TextField.Root
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name, notes, or source agency"
          />

          <Grid columns="2" gap="2">
            <div>
              <Text size="1" color="gray" className="mb-3">
                Region
              </Text>
              <Select.Root
                value={selectedRegion}
                onValueChange={(value) => setSelectedRegion(value as "all" | Region)}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  <Select.Item value="all">All Regions</Select.Item>
                  {regionOptions.map((region) => (
                    <Select.Item key={region} value={region}>
                      {region}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>

            <div>
              <Text size="1" color="gray" className="mb-3">
                Hazard Type
              </Text>
              <Select.Root
                value={selectedType}
                onValueChange={(value) => setSelectedType(value as "all" | HazardType)}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  <Select.Item value="all">All Types</Select.Item>
                  {hazardTypeOptions.map((hazardType) => (
                    <Select.Item value={hazardType} key={hazardType}>
                      {hazardType}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          </Grid>

          <Grid columns="2" gap="2">
            <div>
              <Text size="1" color="gray" className="mb-3">
                Status
              </Text>
              <Select.Root
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as "all" | HazardStatus)}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  <Select.Item value="all">All Statuses</Select.Item>
                  {hazardStatusOptions.map((status) => (
                    <Select.Item value={status} key={status}>
                      {status}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>

            <div>
              <Text size="1" color="gray" className="mb-3">
                Severity
              </Text>
              <Select.Root
                value={selectedSeverity}
                onValueChange={(value) => setSelectedSeverity(value as "all" | HazardSeverity)}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  <Select.Item value="all">All Severity</Select.Item>
                  {hazardSeverityOptions.map((severity) => (
                    <Select.Item value={severity} key={severity}>
                      {severity}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          </Grid>

          <Flex direction="column" gap="2">
            <Text size="1" color="gray">
              Municipality/City
            </Text>
            <TextField.Root
              value={municipalityFilter}
              onChange={(event) => setMunicipalityFilter(event.target.value)}
              placeholder="Filter by municipality/city"
            />
            <Text size="1" color="gray">
              Existing entries: {municipalityOptions.join(", ") || "None"}
            </Text>
          </Flex>

          <Flex align="center" justify="between">
            <Text size="2" weight="bold">
              {filteredHazards.length} hazard
              {filteredHazards.length > 1 ? "s" : ""} shown
            </Text>
            <button
              type="button"
              className="shelter-inline-button"
              onClick={toggleSelectVisible}
            >
              {allVisibleSelected ? "Unselect visible" : "Select visible"}
            </button>
          </Flex>

          {selectedIds.length > 0 && (
            <Box className="rounded-lg border border-red-200 bg-red-50 p-2">
              <Flex align="center" justify="between" gap="2">
                <Text size="2" weight="medium">
                  {selectedIds.length} selected
                </Text>
                <Flex gap="2">
                  <Button
                    size="1"
                    variant="soft"
                    color="gray"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </Button>
                  <Button size="1" color="red" onClick={deleteSelectedHazards}>
                    Delete Selected
                  </Button>
                </Flex>
              </Flex>
            </Box>
          )}

          <Box className="rounded-lg border border-neutral-200 p-3">
            <Text as="div" size="2" weight="bold">
              Metrics Summary
            </Text>
            <Grid columns="2" gap="2" className="mt-3">
              <MetricCard label="Hazards" value={`${totals.totalHazards}`} />
              <MetricCard
                label="Affected Population"
                value={totals.totalAffectedPopulation.toLocaleString()}
              />
              <MetricCard
                label="Evacuee Need"
                value={totals.totalEvacueeNeed.toLocaleString()}
              />
              <MetricCard
                label="Affected Barangays"
                value={totals.totalBarangays.toLocaleString()}
              />
              <MetricCard label="High/Critical" value={`${totals.highPriority}`} />
            </Grid>
          </Box>

            <Flex direction="column" gap="2" className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filteredHazards.map((hazard) => {
              const isSelected = selectedIds.includes(hazard.id);
              const canFocusOnMap =
                Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude);

              return (
                <Box
                  key={hazard.id}
                  role={canFocusOnMap ? "button" : undefined}
                  tabIndex={canFocusOnMap ? 0 : undefined}
                  onClick={() => {
                    if (!canFocusOnMap) return;
                    onHazardCardFocus(hazard.id, hazard.latitude, hazard.longitude);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (!canFocusOnMap) return;
                      onHazardCardFocus(hazard.id, hazard.latitude, hazard.longitude);
                    }
                  }}
                  className={`rounded-lg border p-3 shadow-sm ${
                    isSelected ? "border-blue-300 bg-blue-50/50" : "border-neutral-200"
                  } ${canFocusOnMap ? "cursor-pointer" : ""}`}
                >
                  <Flex gap="2" align="start">
                  <input
                    type="checkbox"
                    className="shelter-select-checkbox mt-1"
                    checked={isSelected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleSelectHazard(hazard.id)}
                    aria-label={`Select ${hazard.name}`}
                  />

                    <Box className="w-full">
                      <Flex align="start" justify="between" gap="2" className="items-start">
                        <Box>
                          <Text as="div" weight="bold">
                            {hazard.name}
                          </Text>
                          <Text as="div" size="1" color="gray">
                            {hazard.type} • {hazard.region} • {hazard.municipalityCity}
                          </Text>
                        </Box>
                        <Flex align="center" gap="2" className="shrink-0">
                          <Badge color={parseSeverityColor(hazard.severity)}>
                            {hazard.severity}
                          </Badge>
                          <button
                            type="button"
                            className="shelter-action-icon-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              beginEdit(hazard);
                            }}
                            aria-label={`Edit ${hazard.name}`}
                          >
                            <img
                              src={editIcon}
                              alt=""
                              className="shelter-action-icon"
                            />
                          </button>
                          <button
                            type="button"
                            className="shelter-action-icon-button shelter-delete-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteHazard(hazard.id);
                            }}
                            aria-label={`Delete ${hazard.name}`}
                          >
                            <img
                              src={trashIcon}
                              alt=""
                              className="shelter-action-icon"
                            />
                          </button>
                        </Flex>
                      </Flex>

                      <Text size="1" className="mt-2">
                        {hazard.notes}
                      </Text>
                      <Flex direction="column" gap="1" className="mt-2">
                        <HazardDetail label="Status" value={hazard.status} />
                        <HazardDetail
                          label="Forecast lead"
                          value={`${hazard.forecastLeadHours} hrs`}
                        />
                        <HazardDetail
                          label="Source"
                          value={hazard.sourceAgency || "—"}
                        />
                      </Flex>
                      <Text size="1" color="gray" className="mt-2">
                        Last updated: {hazard.lastUpdated}
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              );
            })}

            {filteredHazards.length === 0 && (
              <Box className="rounded-md border border-dashed border-neutral-300 px-3 py-5 text-center">
                <Text size="2" color="gray">
                  No hazards found for the selected filters.
                </Text>
              </Box>
            )}
          </Flex>
        </Flex>
      )}

      {panel === "form" && (
        <Flex direction="column" gap="3" className="min-h-0 flex-1 overflow-y-auto">
          <Flex align="center" gap="2">
            <button type="button" onClick={cancelForm}>
              <ArrowLeftIcon width="20" height="20" />
            </button>
            <Flex direction="column" gap="2">
              <Heading size="6">
                {editingHazardId ? "Edit Hazard" : "Add Hazard"}
              </Heading>
              <Text size="1" color="gray">
                Fill in the required details and save the flood-related hazard record.
              </Text>
            </Flex>
          </Flex>

          {!isDraftValid && formSubmitAttempted && (
            <Box className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <Text size="1" color="red">
                Please complete all required fields: Hazard Name and Municipality/City.
              </Text>
            </Box>
          )}

          <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Text as="div" size="2" weight="bold">
              Hazard Identity
            </Text>
            <Text as="div" size="1" color="gray">
              Use this section for flood incident context.
            </Text>
          </Box>

          <Flex direction="column" gap="2">
            <Text size="1" color="gray">
              Hazard Name *
            </Text>
            <TextField.Root
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="e.g., Pasig River Flood Watch"
            />
          </Flex>

          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Hazard Type
              </Text>
              <Select.Root
                value={draft.type}
                onValueChange={(value) => updateDraft({ type: value as HazardType })}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  {hazardTypeOptions.map((hazardType) => (
                    <Select.Item key={hazardType} value={hazardType}>
                      {hazardType}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Status
              </Text>
              <Select.Root
                value={draft.status}
                onValueChange={(value) => updateDraft({ status: value as HazardStatus })}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  {hazardStatusOptions.map((status) => (
                    <Select.Item key={status} value={status}>
                      {status}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Grid>

          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Severity
              </Text>
              <Select.Root
                value={draft.severity}
                onValueChange={(value) => updateDraft({ severity: value as HazardSeverity })}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  {hazardSeverityOptions.map((severity) => (
                    <Select.Item value={severity} key={severity}>
                      {severity}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Forecast Lead (hours)
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.forecastLeadHours)}
                onChange={(event) =>
                  updateDraft({ forecastLeadHours: parsePositiveNumber(event.target.value) })
                }
              />
            </Flex>
          </Grid>

          <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Text as="div" size="2" weight="bold">
              Location and Exposure
            </Text>
            <Text as="div" size="1" color="gray">
              Pinpoint affected area for quick operational filtering.
            </Text>
          </Box>

          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Region
              </Text>
              <Select.Root
                value={draft.region}
                onValueChange={(value) => updateDraft({ region: value as Region })}
                
              >
                <Select.Trigger className="mt-2" />
                <Select.Content>
                  {regionOptions.map((region) => (
                    <Select.Item key={region} value={region}>
                      {region}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Municipality/City *
              </Text>
              <TextField.Root
                value={draft.municipalityCity}
                onChange={(event) => updateDraft({ municipalityCity: event.target.value })}
                placeholder="Municipality / City"
              />
            </Flex>
          </Grid>

          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Affected Barangays
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.affectedBarangays)}
                onChange={(event) =>
                  updateDraft({ affectedBarangays: parsePositiveNumber(event.target.value) })
                }
              />
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Estimated Affected Population
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.estimatedAffectedPopulation)}
                onChange={(event) =>
                  updateDraft({
                    estimatedAffectedPopulation: parsePositiveNumber(event.target.value),
                  })
                }
              />
            </Flex>
          </Grid>

          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Expected Evacuee Need
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.expectedEvacueeNeed)}
                onChange={(event) =>
                  updateDraft({ expectedEvacueeNeed: parsePositiveNumber(event.target.value) })
                }
              />
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Source Agency
              </Text>
              <TextField.Root
                value={draft.sourceAgency}
                onChange={(event) => updateDraft({ sourceAgency: event.target.value })}
                placeholder="e.g., MDRRMO, PAGASA"
              />
            </Flex>
          </Grid>

          <Text as="div" size="2" weight="bold">
            Coordinates (Optional)
          </Text>
          <Grid columns="2" gap="2">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Latitude
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.latitude)}
                onChange={(event) => updateDraft({ latitude: parsePositiveNumber(event.target.value) })}
                placeholder="e.g., 14.1234"
              />
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Longitude
              </Text>
              <TextField.Root
                type="number"
                value={String(draft.longitude)}
                onChange={(event) =>
                  updateDraft({ longitude: parsePositiveNumber(event.target.value) })
                }
                placeholder="e.g., 121.1234"
              />
            </Flex>
          </Grid>

          <Flex direction="column" gap="2">
            <Text size="1" color="gray">
              Notes
            </Text>
            <TextArea
              value={draft.notes}
              onChange={(event) => updateDraft({ notes: event.target.value })}
              placeholder="Notes (roads, barriers, vulnerable zones)"
            />
          </Flex>

          <Flex gap="2">
            <Button variant="soft" color="gray" onClick={cancelForm}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={!isDraftValid}>
              {editingHazardId ? "Save changes" : "Save hazard"}
            </Button>
          </Flex>
        </Flex>
      )}
    </>
  );
}

export default HazardManagement;
