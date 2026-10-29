import {
  migrateGraphSettings,
  migrateIridiumData,
  migrateMetadata,
  migrateResultsData,
  type IridiumData,
  type Metadata,
  type ResultsData,
  type UnknownGraphSettings,
  type UnknownIridiumData,
  type UnknownMetadata,
  type UnknownResultsData,
} from "@/features/savedData";
import { defaultGraphSettings } from "@/globals/graphPresets";
import {
  defaultParameterScanOptions,
  defaultTimeCourseParameters,
} from "@/globals/settings";
import { describe, it, expect } from "vitest";
import type { GraphSettingsV1 } from "../graphSettings/v1";
import type { GraphSettingsV2 } from "../graphSettings/v2_steadyState3D";

const graphSettingsV1: GraphSettingsV1 = {
  versionTag: 1,

  backgroundColor: "#ffffff",
  drawingAreaColor: "#f1e7f4",

  includeTitle: true,
  title: "Transition of substances in chemical reaction",
  titleColor: "#000000",

  includeBorder: true,
  borderColor: "#000000",
  borderThickness: 0.5,

  globalWidth: 1,

  isAutoscaledX: true,
  minX: 0,
  maxX: 10,

  isAutoscaledY: true,
  minY: 0,
  maxY: 10,

  margin: 70,

  xAxis: {
    includeTitle: true,
    title: "", // empty means use placeholder
    color: "#000",
  },

  yAxis: {
    includeTitle: true,
    title: "", // empty means use placeholder
    color: "#000",
  },

  majorGrid: {
    enabled: { x: false, y: false },
    xColor: "#888",
    yColor: "#888",
    xWidth: 0.5,
    yWidth: 0.5,
    numXGrids: 4,
    numYGrids: 4,
  },

  minorGrid: {
    enabled: { x: false, y: false },
    xColor: "#888",
    yColor: "#888",
    xWidth: 0.5,
    yWidth: 0.5,
    numXGrids: 4,
    numYGrids: 4,
  },

  legend: {
    visible: true,
    isFloating: true,

    textColor: "#000",
    backgroundColor: "#fff",
    borderColor: "#000",
    borderThickness: 1,
    padding: 15,
    lineLength: 50,
  },
};

const graphSettingsV2: GraphSettingsV2 = {
  ...graphSettingsV1,
  versionTag: 2,
  steadyState3d: {
    isAutoScaledZ: true,
    minZ: 0,
    maxZ: 20,
    colorScheme: "BlueRed",
  },
};

describe("graph settings", () => {
  const olderVersions: UnknownGraphSettings[] = [
    graphSettingsV1,
    graphSettingsV2,
  ];

  it("should migrate gracefully", () => {
    for (const data of olderVersions) {
      expect(migrateGraphSettings(data)).toEqual(defaultGraphSettings);
    }
  });
});

describe("iridium data", () => {
  const olderVersions: UnknownIridiumData[] = [
    {
      versionTag: 1,
      graphSettings: graphSettingsV1,
      variableSettings: {},
    },
    {
      versionTag: 2,
      graphSettings: graphSettingsV1,
      variableSettings: {},
      timeCourseParameters: defaultTimeCourseParameters,
      parameterScanOptions: defaultParameterScanOptions,
    },
    {
      versionTag: 3,
      currentGraphPreset: "Custom",
      graphSettings: graphSettingsV1,
      variableSettings: {},
      timeCourseParameters: defaultTimeCourseParameters,
      parameterScanOptions: defaultParameterScanOptions,
    },
    {
      versionTag: 2,
      graphSettings: defaultGraphSettings,
      variableSettings: {},
      timeCourseParameters: defaultTimeCourseParameters,
      parameterScanOptions: defaultParameterScanOptions,
    },
  ];

  const finalVersion: IridiumData = {
    versionTag: 4,
    currentGraphPreset: "Custom",
    graphSettings: defaultGraphSettings,
    variableSettings: {},
    timeCourseParameters: defaultTimeCourseParameters,
    parameterScanOptions: defaultParameterScanOptions,
  };

  it("should migrate gracefully", () => {
    for (const data of olderVersions) {
      expect(migrateIridiumData(data)).toEqual(finalVersion);
    }
  });
});

describe("metadata", () => {
  const olderVersions: UnknownMetadata[] = [
    {
      versionTag: 1,
      name: "test",
      created: 0,
      updated: 0,
      icon: {
        color: "blue",
      },
    },
  ];

  const finalVersion: Metadata = {
    versionTag: 1,
    name: "test",
    created: 0,
    updated: 0,
    icon: {
      color: "blue",
    },
  };

  it("should migrate gracefully", () => {
    for (const data of olderVersions) {
      expect(migrateMetadata(data)).toEqual(finalVersion);
    }
  });
});

describe("results data", () => {
  const olderVersions: UnknownResultsData[] = [];

  const finalVersion: ResultsData = {
    versionTag: 1,
    records: [
      {
        modelName: "test",
        code: "",
        unixTimestampMs: 0,
        simulationResult: {
          type: "timeCourse",
          columns: [
            {
              title: "A",
              values: [0, 1, 2],
            },
            {
              title: "B",
              values: [0, 1, 2],
            },
          ],
        },
      },
      {
        modelName: "test",
        code: "",
        unixTimestampMs: 0,
        simulationResult: {
          type: "steadyState",
          value: 1,
          concentrations: [
            { name: "A", value: 2 },
            { name: "B", value: 2 },
          ],
          eigenValues: [
            [0, 1],
            [2, 3],
          ],
          jacobian: {
            columns: ["A", "B"],
            rows: ["A", "B"],
            values: [
              [0, 1],
              [2, 3],
            ],
          },
          concentrationControl: {
            columns: ["A", "B"],
            rows: ["A", "B"],
            values: [
              [0, 1],
              [2, 3],
            ],
          },
          fluxControl: {
            columns: ["A", "B"],
            rows: ["A", "B"],
            values: [
              [0, 1],
              [2, 3],
            ],
          },
          elasticities: {
            columns: ["A", "B"],
            rows: ["A", "B"],
            values: [
              [0, 1],
              [2, 3],
            ],
          },
        },
      },
      {
        modelName: "test",
        code: "test",
        unixTimestampMs: 0,
        simulationResult: {
          type: "parameterScan",
          mode: "timeCourse",
          parameter: "C",
          scans: [
            {
              type: "timeCourse",
              parameterValue: 0,
              scanPercent: 0,
              columns: [
                {
                  title: "A",
                  values: [0, 1, 2],
                },
                {
                  title: "B",
                  values: [0, 1, 2],
                },
              ],
            },
            {
              type: "timeCourse",
              parameterValue: 1,
              scanPercent: 0.5,
              columns: [
                {
                  title: "A",
                  values: [0, 1, 2],
                },
                {
                  title: "B",
                  values: [0, 1, 2],
                },
              ],
            },
            {
              type: "timeCourse",
              parameterValue: 2,
              scanPercent: 1,
              columns: [
                {
                  title: "A",
                  values: [0, 1, 2],
                },
                {
                  title: "B",
                  values: [0, 1, 2],
                },
              ],
            },
          ],
        },
      },
      {
        modelName: "stub",
        code: "test",
        unixTimestampMs: 0,
        simulationResult: {
          type: "parameterScan",
          mode: "steadyState",
          parameter: "C",
          scans: [
            {
              parameterValue: 0,
              scanPercent: 0,
              concentrations: [
                {
                  name: "A",
                  value: 4,
                },
                {
                  name: "B",
                  value: 4,
                },
              ],
            },
            {
              parameterValue: 0.5,
              scanPercent: 0.5,
              concentrations: [
                {
                  name: "A",
                  value: 4,
                },
                {
                  name: "B",
                  value: 4,
                },
              ],
            },
            {
              parameterValue: 1,
              scanPercent: 1,
              concentrations: [
                {
                  name: "A",
                  value: 4,
                },
                {
                  name: "B",
                  value: 4,
                },
              ],
            },
          ],
        },
      },
    ],
  };

  it("should migrate gracefully", () => {
    for (const data of olderVersions) {
      expect(migrateResultsData(data)).toEqual(finalVersion);
    }
  });
});
