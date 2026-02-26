import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Select,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { runSimulation } from "./simulation/engine";
import {
  defaultSimulationScenario,
  SimulationScenario,
  typhoonStrengthOptions,
} from "./simulation/scenario";

function parseNumberInput(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "critical";
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-neutral-50";

  return (
    <Box className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <Text as="div" size="1" color="gray">
        {label}
      </Text>
      <Text as="div" size="4" weight="bold">
        {value}
      </Text>
    </Box>
  );
}

function SimulationPanel() {
  const [draft, setDraft] = useState<SimulationScenario>(defaultSimulationScenario);
  const [scenario, setScenario] = useState<SimulationScenario>(defaultSimulationScenario);
  const [lastRunAt, setLastRunAt] = useState<Date>(new Date());

  const result = useMemo(() => runSimulation(scenario), [scenario]);

  function updateDraft<K extends keyof SimulationScenario>(
    key: K,
    value: SimulationScenario[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleRunSimulation() {
    setScenario({ ...draft });
    setLastRunAt(new Date());
  }

  function handleResetDefaults() {
    setDraft(defaultSimulationScenario);
    setScenario(defaultSimulationScenario);
    setLastRunAt(new Date());
  }

  return (
    <Flex direction="column" gap="3">
      <Heading size="8">Typhoon Flood Simulation</Heading>
      <Text size="2" color="gray">
        Explore evacuation, shelter occupancy, and return-home impacts for flood
        scenarios commonly triggered by typhoons in the Philippines.
      </Text>

      <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <Text as="div" size="2" weight="bold">
          Planning Note
        </Text>
        <Text as="div" size="1" color="gray">
          Outputs are decision-support insights, not exact or authoritative
          predictions. Validate with local field data when available.
        </Text>
      </Box>

      <Box className="max-h-[64vh] overflow-y-auto rounded-lg border border-neutral-200 p-3">
        <Flex direction="column" gap="3">
          <Box>
            <Text size="2" weight="bold">
              Hazard Setup (Typhoon to Flood)
            </Text>
            <Grid columns="2" gap="2" className="mt-2">
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Typhoon Strength
                </Text>
                <Select.Root
                  value={draft.typhoonStrength}
                  onValueChange={(value) =>
                    updateDraft("typhoonStrength", value as SimulationScenario["typhoonStrength"])
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    {typhoonStrengthOptions.map((level) => (
                      <Select.Item key={level} value={level}>
                        {level}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Forecast Lead Time (hours)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.forecastLeadHours)}
                  onChange={(event) =>
                    updateDraft("forecastLeadHours", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Rainfall in 24h (mm)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.rainfallMm24h)}
                  onChange={(event) =>
                    updateDraft("rainfallMm24h", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Avg Flood Depth (meters)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.floodDepthMeters)}
                  onChange={(event) =>
                    updateDraft("floodDepthMeters", parseNumberInput(event.target.value))
                  }
                />
              </Flex>
            </Grid>
          </Box>

          <Box>
            <Text size="2" weight="bold">
              Evacuation and Shelter Inputs
            </Text>
            <Grid columns="2" gap="2" className="mt-2">
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Population at Risk
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.atRiskPopulation)}
                  onChange={(event) =>
                    updateDraft("atRiskPopulation", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Exposed Barangays
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.barangaysExposed)}
                  onChange={(event) =>
                    updateDraft("barangaysExposed", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Evacuation Compliance (%)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.evacuationCompliancePercent)}
                  onChange={(event) =>
                    updateDraft(
                      "evacuationCompliancePercent",
                      parseNumberInput(event.target.value)
                    )
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Public School Shelters
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.publicSchoolShelters)}
                  onChange={(event) =>
                    updateDraft("publicSchoolShelters", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Community Shelters
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.communityShelters)}
                  onChange={(event) =>
                    updateDraft("communityShelters", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Avg Capacity per Shelter
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.avgShelterCapacity)}
                  onChange={(event) =>
                    updateDraft("avgShelterCapacity", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Avg Students per School
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.avgSchoolEnrollment)}
                  onChange={(event) =>
                    updateDraft("avgSchoolEnrollment", parseNumberInput(event.target.value))
                  }
                />
              </Flex>
            </Grid>
          </Box>

          <Box>
            <Text size="2" weight="bold">
              Shelter Stay and Return Inputs
            </Text>
            <Grid columns="2" gap="2" className="mt-2">
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Average Shelter Stay (days)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.averageStayDays)}
                  onChange={(event) =>
                    updateDraft("averageStayDays", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Road Accessibility (%)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.roadAccessibilityPercent)}
                  onChange={(event) =>
                    updateDraft("roadAccessibilityPercent", parseNumberInput(event.target.value))
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Homes Needing Repair (%)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.homesNeedingRepairPercent)}
                  onChange={(event) =>
                    updateDraft(
                      "homesNeedingRepairPercent",
                      parseNumberInput(event.target.value)
                    )
                  }
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="1" color="gray">
                  Daily Return Rate (%)
                </Text>
                <TextField.Root
                  type="number"
                  value={String(draft.dailyReturnPercent)}
                  onChange={(event) =>
                    updateDraft("dailyReturnPercent", parseNumberInput(event.target.value))
                  }
                />
              </Flex>
            </Grid>
          </Box>

          <Flex
            align="center"
            justify="between"
            className="rounded-md border border-neutral-200 px-3 py-2"
          >
            <Text size="2" weight="medium">
              Use Assumptions for Missing Data
            </Text>
            <Switch
              checked={draft.useAssumptionsForMissingData}
              onCheckedChange={(checked) =>
                updateDraft("useAssumptionsForMissingData", checked)
              }
            />
          </Flex>

          <Flex gap="2">
            <Button onClick={handleRunSimulation}>Run Simulation</Button>
            <Button variant="soft" color="gray" onClick={handleResetDefaults}>
              <ReloadIcon />
              Reset Defaults
            </Button>
            <Badge color="gray" variant="soft">
              Last run: {lastRunAt.toLocaleTimeString()}
            </Badge>
          </Flex>
        </Flex>
      </Box>

      <Box className="rounded-lg border border-neutral-200 p-3">
        <Text as="div" size="2" weight="bold">
          Scenario Insights
        </Text>
        <Grid columns="2" gap="2" className="mt-3">
          <Metric
            label="Estimated Evacuees"
            value={result.estimatedEvacuees.toLocaleString()}
          />
          <Metric
            label="Peak Evacuation Window"
            value={`${result.peakEvacuationHours} hours`}
            tone={result.peakEvacuationHours > 8 ? "warning" : "neutral"}
          />
          <Metric
            label="Shelter Occupancy"
            value={`${result.occupancyPercent}%`}
            tone={result.occupancyPercent > 95 ? "critical" : "neutral"}
          />
          <Metric
            label="Overflow Beyond Capacity"
            value={result.overflowPeople.toLocaleString()}
            tone={result.overflowPeople > 0 ? "critical" : "neutral"}
          />
          <Metric
            label="Estimated Shelters Needed"
            value={result.estimatedSheltersNeeded.toLocaleString()}
          />
          <Metric
            label="Students Potentially Disrupted"
            value={result.schoolDisruptionStudents.toLocaleString()}
            tone={result.schoolDisruptionStudents > 3000 ? "warning" : "neutral"}
          />
          <Metric
            label="Likely Served Barangays"
            value={result.servedBarangays.toLocaleString()}
          />
          <Metric
            label="Estimated Full Return Period"
            value={`${result.estimatedReturnDays} days`}
          />
          <Metric
            label="Still Displaced After 7 Days"
            value={result.displacedAfter7Days.toLocaleString()}
            tone={result.displacedAfter7Days > 0 ? "warning" : "neutral"}
          />
        </Grid>

        {result.assumptions.length > 0 && (
          <Box className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <Text as="div" size="1" weight="bold" color="amber">
              Assumptions Applied
            </Text>
            <Flex direction="column" gap="1" className="mt-1">
              {result.assumptions.map((assumption, index) => (
                <Text key={assumption} size="1" color="gray">
                  {index + 1}. {assumption}
                </Text>
              ))}
            </Flex>
          </Box>
        )}
      </Box>
    </Flex>
  );
}

export default SimulationPanel;
