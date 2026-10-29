import { atom } from "jotai";
import {
  computeSteadyStateAtom,
  runParameterScanAtom,
  simulateTimeCourseAtom,
  simulationResultAtom,
} from "./simulation";
import { type SettableVariable } from "@/features/simulation/Simulator";
import { variablesMapAtom } from "./model";
import { currentBottomPanelAtom } from "./layout";

export interface VariableSliderState {
  value: number;
  min: number;
  max: number;
}

export const variableSliderStatesAtom = atom<
  Record<string, VariableSliderState>
>({});

export type UpdateVariableSliderValueOptions = {
  variableName: string;
  value: number;
};

export const getInitialSliderState = (
  variable: SettableVariable,
): VariableSliderState => {
  const baseScale = variable.defaultValue || 1;
  let result;
  if (variable.defaultValue >= 0) {
    result = {
      value: variable.defaultValue,
      min: Math.round(100 * (0.1 * baseScale)) / 100,
      max: Math.round(100 * (5 * baseScale)) / 100,
    };
  } else {
    result = {
      value: variable.defaultValue,
      min: Math.round(100 * (5 * baseScale)) / 100,
      max: Math.round(100 * (0.1 * baseScale)) / 100,
    };
  }

  // sometimes the baseScale is so small, min and max get rounded to zero
  if (result.min === result.max) {
    result.max += 1;
  }

  return result;
};

const _setSlidersAndSimulateAtom = atom(
  null,
  (
    get,
    set,
    {
      sliderStates,
    }: {
      sliderStates: Record<string, VariableSliderState>;
    },
  ) => {
    set(variableSliderStatesAtom, sliderStates);

    switch (get(simulationResultAtom)?.type) {
      case "steadyState":
        void set(computeSteadyStateAtom, { delayEnd: true });
        break;
      case "parameterScan":
        void set(runParameterScanAtom, { delayEnd: true });
        break;
      case "timeCourse":
      default:
        void set(simulateTimeCourseAtom, { delayEnd: true });
        break;
    }
  },
);

export const updateSliderAndSimulateAtom = atom(
  null,
  (get, set, { id, value }: { id: string; value: number }) => {
    const sliderStates = get(variableSliderStatesAtom);
    set(_setSlidersAndSimulateAtom, {
      sliderStates: {
        ...sliderStates,
        [id]: {
          ...sliderStates[id],
          value,
        },
      },
    });
  },
);

export const loadPresetAndSimulateAtom = atom(
  null,
  (get, set, preset: Record<string, number>) => {
    const variablesMap = get(variablesMapAtom);
    const newSliderStates: Record<string, VariableSliderState> = {};

    // patch in new values
    for (const [id, value] of Object.entries(preset)) {
      const variable = variablesMap.get(id);
      if (variable) {
        const state = getInitialSliderState(variable as SettableVariable);
        state.value = value;
        newSliderStates[id] = state;
      }
    }

    set(_setSlidersAndSimulateAtom, {
      sliderStates: newSliderStates,
    });
  },
);

export const areSlidersActiveAtom = atom((get) => {
  return get(currentBottomPanelAtom) === "Sliders";
});
