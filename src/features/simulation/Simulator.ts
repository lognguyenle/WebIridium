import type { Category } from "../category";

/**
 * Information about what the simulator can do.
 */
export type SimulatorCapabilities = {
  readonly canRunSteadyState: boolean;
};

export type TimeCourseParameters = {
  startTime: number;
  endTime: number;
  numberOfPoints: number;
  resetInitialConditions: boolean;
  /** List of variables you want to include in the results. */
  includedVariables: Variable[];
};

// nothing for now...
export type SteadyStateParameters = null;

export type ParameterScanOptions = {
  varyingParameter: string;
  varyingParameterValue: number;
};

type VariableBase = {
  /** Default display name. */
  defaultDisplayName: string;
  /** General name used internally by the simulator */
  name: string;
  category: Category;
};

export type NormalVariable = VariableBase & {
  type: "normal";
};

export type SettableVariable = VariableBase & {
  type: "settable";
  /**
   * Internal name of the variable used for scanning and sliders.
   * This is necessary because, in Copasi,
   * to scan with species named "A", you set the value for "[A]_0"
   */
  setName: string;
  defaultValue: number;
};

export type Variable = NormalVariable | SettableVariable;

/** Record of user-set variable values. Used by sliders. */
export type VariableValues = { [variableName: string]: number };

/* RESULT STUFF */

export type TimeCourseResult = {
  type: "timeCourse";
  // title -> values
  columns: {
    title: string;
    values: number[];
  }[];
};

export type SteadyStateResultItem = {
  columns: string[];
  rows: string[];
  values: number[][];
};

export type SteadyStateResult = {
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

export type ParameterScanExtras = {
  /** The value of the parameter that was used for the scan. */
  parameterValue: number;
  /**
   * Number from [0-1] representing what percentage the all the scans was completed when this scan was ran.
   * So, for the scan range [0, 100], if the parameterValue is 50 and its linear,
   * the scanPercent will be 0.5.
   */
  scanPercent: number;
};

export type TimeCourseParameterScanResult = {
  type: "parameterScan";
  mode: "timeCourse";
  parameter: string;
  // parameter value -> result
  scans: (TimeCourseResult & ParameterScanExtras)[];
};

export type SteadyStateParameterScanResult = {
  type: "parameterScan";
  mode: "steadyState";
  parameter: string;
  // parameter value -> result
  scans: (ParameterScanExtras & {
    concentrations: {
      name: string;
      value: number;
    }[];
  })[];
};

export type ParameterScanResult =
  | TimeCourseParameterScanResult
  | SteadyStateParameterScanResult;

export type SimulationResult =
  | TimeCourseResult
  | SteadyStateResult
  | ParameterScanResult;

export type SimulateTimeCourseOptions = {
  parameters: TimeCourseParameters;
  variableValues: VariableValues;
  parameterScanOptions?: ParameterScanOptions;
};

export type ComputeSteadyStateOptions = {
  parameters: SteadyStateParameters;
  variableValues: VariableValues;
  parameterScanOptions?: ParameterScanOptions;
};

export abstract class Simulator {
  abstract readonly defaultIndependentVariableName: string;
  abstract readonly scanIndependentVariableName: string;

  abstract readonly capabilities: SimulatorCapabilities;

  abstract simulateTimeCourse(
    antimonyCode: string,
    {
      parameters,
      variableValues,
      parameterScanOptions,
    }: SimulateTimeCourseOptions,
    abortSignal?: AbortSignal,
  ): Promise<TimeCourseResult>;

  abstract computeSteadyState(
    antimonyCode: string,
    {
      parameters,
      variableValues,
      parameterScanOptions,
    }: ComputeSteadyStateOptions,
    abortSignal?: AbortSignal,
  ): Promise<SteadyStateResult>;

  /**
   * NOTE: when switching beteween simulators, make sure to reset the variable list as it is not compatible between variables
   * @returns List of variables the simulator has for the model. These are the default
   *          values for the variables, but the user may modify theme.
   */
  abstract loadModel(
    antimonyCode: string,
    abortSignal?: AbortSignal,
  ): Promise<Variable[]>;
}
