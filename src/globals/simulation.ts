/**
 * Atoms for running simulations and current simulation
 * status.
 */

import { atom, type Getter } from "jotai";

import type {
  ParameterScanResult,
  SettableVariable,
  SimulationResult,
  TimeCourseParameters,
} from "@/features/simulation/Simulator";
import {
  getLinearDistribution,
  getLogarithmicDistribution,
} from "@/features/distribution";

import type { Setter } from "jotai";
import { simulatorAtom } from "./simulator";
import {
  editorContentAtom,
  modelStatusAtom,
  variablesAtom,
  variablesMapAtom,
} from "./model";
import { parameterScanOptionsAtom, timeCourseParametersAtom } from "./settings";
import { variableSliderStatesAtom, areSlidersActiveAtom } from "./slider";
import { currentRightPanelAtom } from "./layout";
import { TaskTermination } from "@/features/taskPool";
import { tryAddToHistoryAtom } from "./history";
import { metadataAtom } from "./project";

export type SimulationOperationResult =
  | { type: "success" }
  | { type: "cancel" }
  | { type: "failure"; message: string };

// internal atoms

type SimulationInternalState = {
  type: string;
  abortController: AbortController;
};

const _simulationInternalStateAtom = atom<SimulationInternalState | null>(null);

// exported atoms

export const simulationResultAtom = atom<SimulationResult | null>(null);
export const isSimulatingAtom = atom((get) =>
  Boolean(get(_simulationInternalStateAtom)),
);

// exported simulation action atoms

const getVariableValues = (get: Getter): Record<string, number> => {
  // if sliders panel is not open, do not use them
  if (!get(areSlidersActiveAtom)) return {};

  const sliderStates = get(variableSliderStatesAtom);
  const variableMap = get(variablesMapAtom);

  const values: Record<string, number> = {};
  for (const [name, state] of Object.entries(sliderStates)) {
    const variable = variableMap.get(name) as SettableVariable;
    if (state.value === variable.defaultValue) {
      // ignore it if the value is the same
      continue;
    }
    values[variable.setName] = state.value;
  }
  return values;
};

export interface RunSimulationOptions {
  /**
   * default: false
   * Whether or not to delay the simulations end.
   * This is used by slider so it doesn't flash as you drag.
   */
  delayEnd?: boolean; // TODO: add test for this feature (test by moving sliders and making sure the simulation buttons stay disabled for some time)
}

const SIMULATION_DELAY_END_DURATION = 500;

const runSimulation = async (
  simulationType: string,
  options: RunSimulationOptions,
  get: Getter,
  set: Setter,
  run: (abortSignal: AbortSignal) => Promise<SimulationResult>,
): Promise<SimulationOperationResult> => {
  const modelStatus = get(modelStatusAtom);

  if (modelStatus.type === "loading") {
    return {
      type: "failure",
      message: "Model is still loading. Please wait.",
    };
  } else if (modelStatus.type === "error") {
    return { type: "failure", message: modelStatus.message };
  } else {
    const abortController = new AbortController();
    set(_simulationInternalStateAtom, {
      type: simulationType,
      abortController,
    });

    let canceled = false;
    try {
      const metadata = get(metadataAtom);
      const code = get(editorContentAtom);

      const result = await run(abortController.signal);
      set(simulationResultAtom, result);
      set(currentRightPanelAtom, "Results");
      set(tryAddToHistoryAtom, {
        modelName: metadata.name,
        code,
        result,
      });

      return { type: "success" };
    } catch (err) {
      if (err instanceof TaskTermination) {
        canceled = true;
        return { type: "cancel" };
      } else {
        if (err instanceof Error && err.message !== "mock fail") {
          console.error(err);
        }

        return {
          type: "failure",
          message: err instanceof Error ? err.message : "Unknown error",
        };
      }
    } finally {
      const reset = () => {
        if (
          get(_simulationInternalStateAtom)?.abortController === abortController
        ) {
          set(_simulationInternalStateAtom, null);
        }
      };

      // even if delayEnd is true, when the user presses
      // cancel we want it to be instantaneous
      if (!options.delayEnd || canceled) {
        reset();
      } else {
        setTimeout(reset, SIMULATION_DELAY_END_DURATION);
      }
    }
  }
};

export interface SimulateTimeCourseOptions {
  /* default: true */
  resetInitialConditions?: boolean;
}

export const simulateTimeCourseAtom = atom(
  null,
  async (
    get,
    set,
    {
      resetInitialConditions = true,
      ...rest
    }: SimulateTimeCourseOptions & RunSimulationOptions = {},
  ) => {
    return await runSimulation(
      "timeCourse",
      rest,
      get,
      set,
      async (abortSignal: AbortSignal) => {
        const variables = get(variablesAtom);
        return await get(simulatorAtom).simulateTimeCourse(
          get(editorContentAtom),
          {
            parameters: {
              ...get(timeCourseParametersAtom),
              resetInitialConditions,
              includedVariables: variables,
            },
            variableValues: getVariableValues(get),
          },
          abortSignal,
        );
      },
    );
  },
);

export const computeSteadyStateAtom = atom(
  null,
  async (get, set, options: RunSimulationOptions = {}) => {
    return await runSimulation(
      "steadyState",
      options,
      get,
      set,
      async (abortSignal: AbortSignal) => {
        return await get(simulatorAtom).computeSteadyState(
          get(editorContentAtom),
          {
            parameters: null,
            variableValues: getVariableValues(get),
          },
          abortSignal,
        );
      },
    );
  },
);

export const runParameterScanAtom = atom(
  null,
  async (get, set, options: RunSimulationOptions = {}) => {
    const simulator = get(simulatorAtom);
    const parameterScanOptions = get(parameterScanOptionsAtom);
    const variables = get(variablesAtom);
    const editorContent = get(editorContentAtom);
    const variablesMap = get(variablesMapAtom);

    return await runSimulation(
      "parameterScan",
      options,
      get,
      set,
      async (abortSignal: AbortSignal) => {
        const parameter = parameterScanOptions.varyingParameter;
        if (!parameter) {
          throw new Error("select parameter to scan with");
        }

        let scanValues: number[];
        const resultPromises = [];

        if (parameterScanOptions.useNumberList) {
          // TODO: unit test this path
          const numbers = parameterScanOptions.numberList
            .split(" ")
            .filter((n) => n.trim().length > 0)
            .map((n) => +n.trim());
          if (numbers.length === 0 || numbers.some((n) => isNaN(n))) {
            throw new Error(
              "Number list should be a list of numbers separate by spaces.",
            );
          }

          scanValues = numbers;
        } else {
          const getDistribution =
            parameterScanOptions.useLogarithmicDistribution
              ? getLogarithmicDistribution
              : getLinearDistribution;
          scanValues = getDistribution(
            parameterScanOptions.min,
            parameterScanOptions.max,
            parameterScanOptions.numberOfValues,
          );
        }

        const parameterSetName = (
          variablesMap.get(parameter) as SettableVariable
        ).setName;
        const variableValues = getVariableValues(get);

        if (parameterScanOptions.mode === "timeCourse") {
          const scanTimeCourseParameters: TimeCourseParameters = {
            ...parameterScanOptions.timeCourseParameters,
            resetInitialConditions: true,
            includedVariables: variables,
          };

          for (const value of scanValues) {
            resultPromises.push(
              simulator.simulateTimeCourse(
                editorContent,
                {
                  parameters: scanTimeCourseParameters,
                  variableValues,
                  parameterScanOptions: {
                    varyingParameter: parameterSetName,
                    varyingParameterValue: value,
                  },
                },
                abortSignal,
              ),
            );
          }

          const results = await Promise.all(resultPromises);
          const scans = [];
          for (const [i, result] of results.entries()) {
            scans.push({
              parameterValue: scanValues[i],
              // special case if there is only one value, have scan percent be 0% instead of 100% since it looks better for Custom palette
              scanPercent:
                scanValues.length === 1 ? 0 : i / (scanValues.length - 1),
              ...result,
            });
          }

          return {
            type: "parameterScan",
            mode: "timeCourse",
            parameter,
            scans,
          } satisfies ParameterScanResult;
        } else {
          const resultPromises = [];
          for (const value of scanValues) {
            resultPromises.push(
              simulator.computeSteadyState(
                editorContent,
                {
                  parameters: null,
                  variableValues,
                  parameterScanOptions: {
                    varyingParameter: parameterSetName,
                    varyingParameterValue: value,
                  },
                },
                abortSignal,
              ),
            );
          }

          const results = await Promise.all(resultPromises);
          const scans = [];
          for (const [i, result] of results.entries()) {
            scans.push({
              parameterValue: scanValues[i],
              scanPercent: i / (scanValues.length - 1),
              concentrations: result.concentrations,
            });
          }

          return {
            type: "parameterScan",
            mode: "steadyState",
            parameter,
            scans,
          } satisfies ParameterScanResult;
        }
      },
    );
  },
);

export const cancelSimulationAtom = atom(null, (get) => {
  const internalState = get(_simulationInternalStateAtom);
  if (internalState?.abortController) {
    internalState.abortController.abort();
  }
});
