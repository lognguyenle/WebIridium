type TimeCourseResult = {
  type: "timeCourse";
  columns: {
    title: string;
    values: number[];
  }[];
};

type SteadyStateResultItem = {
  columns: string[];
  rows: string[];
  values: number[][];
};

type SteadyStateResult = {
  type: "steadyState";
  value: number;
  concentrations: {
    name: string;
    value: number;
  }[];
  eigenValues: number[][];
  jacobian: SteadyStateResultItem;
  concentrationControl: SteadyStateResultItem;
  fluxControl: SteadyStateResultItem;
  elasticities: SteadyStateResultItem;
};

type ParameterScanExtras = {
  parameterValue: number;
  scanPercent: number;
};

type TimeCourseParameterScanResult = {
  type: "parameterScan";
  mode: "timeCourse";
  parameter: string;
  scans: (TimeCourseResult & ParameterScanExtras)[];
};

type SteadyStateParameterScanResult = {
  type: "parameterScan";
  mode: "steadyState";
  parameter: string;
  scans: (ParameterScanExtras & {
    concentrations: {
      name: string;
      value: number;
    }[];
  })[];
};

type ParameterScanResult =
  | TimeCourseParameterScanResult
  | SteadyStateParameterScanResult;

type SimulationResult =
  | TimeCourseResult
  | SteadyStateResult
  | ParameterScanResult;

type HistoryRecord = {
  modelName: string;
  code: string;
  simulationResult: SimulationResult;
  unixTimestampMs: number;
};

export type ResultsDataV1 = {
  versionTag: 1;
  records: HistoryRecord[];
};
