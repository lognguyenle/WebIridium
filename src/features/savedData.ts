/**
 * Read `DEVINSTRUCTIONS/MIGRATIONS.md` for how this works/how to add your own migrations.
 */

import defaultModel from "@/assets/default.ant?raw";
import {
  defaultParameterScanOptions,
  defaultTimeCourseParameters,
} from "@/globals/settings";
import { getRandomCssGradient } from "./cssGradients";

import type { MetadataV1 } from "./migrations/metadata/v1";

import type { IridiumDataV1 } from "./migrations/iridium/v1";
import {
  migrateIridiumDataV1V2,
  type IridiumDataV2,
} from "./migrations/iridium/v2_simulationParameters";
import {
  migrateIridiumDataV2V3,
  type IridiumDataV3,
} from "./migrations/iridium/v3_graphPresets";
import {
  migrateIridiumDataV3V4,
  type IridiumDataV4,
} from "./migrations/iridium/v4_steadyState3D";

import type { ResultsDataV1 } from "./migrations/results/v1";

import type { GraphSettingsV1 } from "./migrations/graphSettings/v1";
import {
  migrateGraphSettingsV1V2,
  type GraphSettingsV2,
} from "./migrations/graphSettings/v2_steadyState3D";

import { defaultGraphSettings } from "@/globals/graphPresets";

// Should be union of every single version
export type UnknownMetadata = MetadataV1;
export type UnknownIridiumData =
  | IridiumDataV1
  | IridiumDataV2
  | IridiumDataV3
  | IridiumDataV4;
export type UnknownResultsData = ResultsDataV1;
export type UnknownGraphSettings = GraphSettingsV1 | GraphSettingsV2;

// Keep these up-to-date with the latest versions
export type Metadata = MetadataV1;
export type IridiumData = IridiumDataV4;
export type ResultsData = ResultsDataV1;
export type GraphSettings = GraphSettingsV2;

// https://www.learningtypescript.com/articles/branded-types
export type ProjectId = string & { __brand: "projectId" };

export interface UnknownProjectData {
  metadata: UnknownMetadata;
  iridium: UnknownIridiumData;
  results: UnknownResultsData;
  code: string;
}

export interface ProjectData {
  metadata: Metadata;
  iridium: IridiumData;
  results: ResultsData;
  code: string;
}

/**
 * @param metadata - Metadata of any version.
 * @returns The original metadata migrated to the latest version.
 */
export const migrateMetadata = (metadata: UnknownMetadata): Metadata => {
  switch (metadata.versionTag) {
    case 1:
      return metadata;
  }
};

/**
 * @param iridiumData - Iridium data of any version.
 * @returns The original iridium data migrated to the latest version.
 */
export const migrateIridiumData = (
  iridiumData: UnknownIridiumData,
): IridiumData => {
  switch (iridiumData.versionTag) {
    case 1:
      return migrateIridiumData(migrateIridiumDataV1V2(iridiumData));
    case 2:
      return migrateIridiumData(migrateIridiumDataV2V3(iridiumData));
    case 3:
      return migrateIridiumData(migrateIridiumDataV3V4(iridiumData));
    case 4:
      return iridiumData;
  }
};

/**
 * @param resultsData - Results data of any version.
 * @returns The original results data migrated to the latest version.
 */
export const migrateResultsData = (
  resultsData: UnknownResultsData,
): ResultsData => {
  switch (resultsData.versionTag) {
    case 1:
      return resultsData;
  }
};

/**
 * @param graphSettings - Graph settings data of any version.
 * @returns The original results data migrated to the latest version.
 */
export const migrateGraphSettings = (
  graphSettings: UnknownGraphSettings,
): GraphSettings => {
  switch (graphSettings.versionTag) {
    case 1:
      return migrateGraphSettings(migrateGraphSettingsV1V2(graphSettings));
    case 2:
      return graphSettings;
  }
};

export const migrateProjectData = ({
  code,
  metadata,
  iridium,
  results,
}: UnknownProjectData): ProjectData => {
  return {
    code: code,
    metadata: migrateMetadata(metadata),
    iridium: migrateIridiumData(iridium),
    results: migrateResultsData(results),
  };
};

export const getNewProjectId = (): ProjectId =>
  crypto.randomUUID() as ProjectId;

export const getNewProjectData = (): ProjectData => {
  return {
    code: defaultModel,
    metadata: {
      versionTag: 1,
      name: "Starter Project",
      created: Date.now(),
      updated: Date.now(),
      icon: {
        color: getRandomCssGradient(),
      },
    },
    iridium: {
      versionTag: 4,
      currentGraphPreset: "Custom",
      graphSettings: defaultGraphSettings,
      variableSettings: {},
      timeCourseParameters: defaultTimeCourseParameters,
      parameterScanOptions: defaultParameterScanOptions,
    },
    results: {
      versionTag: 1,
      records: [],
    },
  };
};
