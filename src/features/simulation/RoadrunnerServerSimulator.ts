import { SocketTaskPool } from "../taskPool";
import {
  Simulator,
  type TimeCourseResult,
  type SteadyStateResult,
  type ParameterScanOptions,
  type Variable,
  type ComputeSteadyStateOptions,
  type SimulateTimeCourseOptions,
} from "./Simulator";

type TimeCourseAction = {
  startTime: number;
  endTime: number;
  numberOfPoints: number;
  resetInitialConditions: boolean;
  selectionList: string[];
  variableValues: Record<string, number>;
  parameterScanOptions?: ParameterScanOptions;
};

type SteadyStateAction = {
  variableValues: Record<string, number>;
  parameterScanOptions?: ParameterScanOptions;
};

// type SteadyStateAction = {
//   variableValues: Record<string, number>;
//   parameterScanOptions?: ParameterScanOptions;
// };

type LoadModelResponse = {
  floatingSpecies: Record<string, number>;
  boundarySpecies: Record<string, number>;
  reactions: string[];
  parameters: Record<string, number>;
};

type TimeCourseResponse = {
  type: "timeCourse";
  columnNames: string[];
  rows: number[][];
};

type SteadyStateResponseItem = {
  columns: string[];
  rows: string[];
  values: number[][];
};

type SteadyStateResponse = {
  value: number;
  concentrations: {
    name: string;
    value: number;
  }[];
  eigenValues: number[][];
  jacobian: SteadyStateResponseItem;
  concentrationControl: SteadyStateResponseItem;
  fluxControl: SteadyStateResponseItem;
  elasticities: SteadyStateResponseItem;
};

/**
 * Simulator that uses external RoadRunner WebSocket server.
 */
export class RoadrunnerServerSimulator extends Simulator {
  defaultIndependentVariableName = "time";
  scanIndependentVariableName = "time";

  capabilities = {
    canRunSteadyState: true,
  };

  #socketTaskPool: SocketTaskPool;

  constructor() {
    super();
    this.#socketTaskPool = new SocketTaskPool();
    this.#socketTaskPool.connect("ws://localhost:47137");
  }

  async simulateTimeCourse(
    antimonyCode: string,
    {
      parameters,
      variableValues,
      parameterScanOptions,
    }: SimulateTimeCourseOptions,
    abortSignal?: AbortSignal,
  ): Promise<TimeCourseResult> {
    const result = (await this.#socketTaskPool.runTask(
      "timeCourse",
      {
        startTime: parameters.startTime,
        endTime: parameters.endTime,
        numberOfPoints: parameters.numberOfPoints,
        resetInitialConditions: parameters.resetInitialConditions,
        selectionList: parameters.includedVariables.map((v) => v.name),
        variableValues: variableValues,
        parameterScanOptions: parameterScanOptions,
      } satisfies TimeCourseAction,
      antimonyCode,
      abortSignal,
    )) as TimeCourseResponse;

    return {
      type: "timeCourse",
      columns: result.columnNames.map((name, i) => ({
        title: name,
        values: result.rows.map((row) => row[i]),
      })),
    };
  }

  async computeSteadyState(
    antimonyCode: string,
    { variableValues, parameterScanOptions }: ComputeSteadyStateOptions,
    abortSignal?: AbortSignal,
  ): Promise<SteadyStateResult> {
    const result = (await this.#socketTaskPool.runTask(
      "steadyState",
      {
        variableValues: variableValues,
        parameterScanOptions: parameterScanOptions,
      } satisfies SteadyStateAction,
      antimonyCode,
      abortSignal,
    )) as SteadyStateResponse;

    return {
      type: "steadyState",
      value: result.value,
      concentrations: result.concentrations,
      eigenValues: result.eigenValues,
      jacobian: result.jacobian,
      concentrationControl: result.concentrationControl,
      fluxControl: result.fluxControl,
      elasticities: result.elasticities,
    };
  }

  async loadModel(antimonyCode: string, abortSignal?: AbortSignal) {
    const result = (await this.#socketTaskPool.runTask(
      "loadModel",
      null,
      antimonyCode,
      abortSignal,
    )) as LoadModelResponse;

    const variables: Variable[] = [];

    variables.push({
      type: "normal",
      defaultDisplayName: "Time",
      name: "time",
      category: "Time",
    });

    for (const [name, value] of Object.entries(result.floatingSpecies)) {
      variables.push({
        type: "settable",
        defaultDisplayName: name,
        name: name,
        category: "Floating Species",

        setName: `init([${name}])`,
        defaultValue: value,
      });

      variables.push({
        type: "normal",
        defaultDisplayName: `${name}'`,
        name: `${name}'`,
        category: "Rate of Changes",
      });
    }

    for (const [name, value] of Object.entries(result.boundarySpecies)) {
      variables.push({
        type: "settable",
        defaultDisplayName: name,
        name: name,
        category: "Boundary Species",

        setName: `init([${name}])`,
        defaultValue: value,
      });
    }

    for (const [name, value] of Object.entries(result.parameters)) {
      variables.push({
        type: "settable",
        defaultDisplayName: name,
        name: name,
        category: "Parameters",

        setName: name,
        defaultValue: value,
      });
    }

    for (const name of result.reactions) {
      variables.push({
        type: "normal",
        defaultDisplayName: name,
        name: name,
        category: "Reaction Rates",
      });
    }

    return variables;
  }
}
