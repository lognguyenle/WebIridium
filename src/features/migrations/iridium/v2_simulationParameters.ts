import {
  defaultParameterScanOptions,
  defaultTimeCourseParameters,
} from "@/globals/settings";
import type { IridiumDataV1 } from "./v1";

interface TimeCourseParameters {
  startTime: number;
  endTime: number;
  numberOfPoints: number;
}

interface ParameterScanOptions {
  mode: "timeCourse" | "steadyState";
  varyingParameter: string | null | undefined;
  timeCourseParameters: TimeCourseParameters;

  // range properties
  min: number;
  max: number;
  numberOfValues: number;
  useLogarithmicDistribution: boolean;

  // list properties
  useNumberList: boolean;
  numberList: string;
}

export type IridiumDataV2 = Omit<IridiumDataV1, "versionTag"> & {
  versionTag: 2;
  timeCourseParameters: TimeCourseParameters;
  parameterScanOptions: ParameterScanOptions;
};

export const migrateIridiumDataV1V2 = (data: IridiumDataV1): IridiumDataV2 => {
  return {
    ...data,
    versionTag: 2,
    timeCourseParameters: defaultTimeCourseParameters,
    parameterScanOptions: defaultParameterScanOptions,
  };
};
