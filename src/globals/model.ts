import { atom } from "jotai";

import defaultModel from "@/assets/default.ant?raw";
import type {
  Variable,
  SettableVariable,
} from "@/features/simulation/Simulator";
import { TaskTermination } from "@/features/taskPool";
import { getDefaultColorForIndex } from "@/features/colors";

import { type VariableSettings } from "./settings";
import { simulatorAtom } from "./simulator";
import { independentVariableAtom, parameterScanOptionsAtom } from "./settings";
import { variableSliderStatesAtom } from "./slider";
import type { Atom } from "jotai";

export type ModelStatus =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success" };

const MODEL_LOAD_DEBOUNCE = 200; // in ms

const _updateAbortControllerAtom = atom<AbortController | null>(null);
const _editorContentAtom = atom(defaultModel);
const _modelStatusAtom = atom<ModelStatus>({ type: "loading" });

type VariableSettingss = {
  [id: string]: VariableSettings;
};
// this stores variables and their settings in one object so we can update them simultaneously
// (important since we can NEVER have variable without corresponding variable settings)
// note that variable settings will always be a superset of
// variables because the settings are retained even if the
// variables are no longer in the model.
const _variablesAtom = atom<{
  variables: Variable[];
  settingss: VariableSettingss;
}>({
  variables: [],
  settingss: {},
});

export const editorContentAtom = atom((get) => get(_editorContentAtom));
export const modelStatusAtom = atom((get) => get(_modelStatusAtom));
export const variablesAtom = atom((get) => get(_variablesAtom).variables);
export const variablesMapAtom: Atom<Map<string, Variable>> = atom(
  (get) => new Map(get(variablesAtom).map((v) => [v.name, v])),
);
export const variableSettingssAtom = atom(
  (get) => get(_variablesAtom).settingss,
  (
    get,
    set,
    param: VariableSettingss | ((old: VariableSettingss) => VariableSettingss),
  ) => {
    const old = get(_variablesAtom);
    const newValue = typeof param === "function" ? param(old.settingss) : param;
    set(_variablesAtom, {
      ...get(_variablesAtom),
      settingss: newValue,
    });
  },
);

/**
 * Get variable settings for variable with the given name.
 * If not found, uses fallback settings.
 */
export const getVariableSettingsFrom = (
  variableSettingss: Record<string, VariableSettings>,
  name: string,
): VariableSettings => {
  return (
    variableSettingss[name] ?? {
      displayName: name,
      color: "#777",
      lineStyle: "solid",
      visible: true,
      width: 2.5,
    }
  );
};

/**
 * Only exported so it can be unit tested.
 * Should not be used elsewhere.
 */
export const patchVariablesSettings = (
  currentVariables: Variable[],
  currentVariableSettingss: Record<string, VariableSettings>,
  newVariables: Variable[],
  preserveVariableSettings: boolean,
): Record<string, VariableSettings> => {
  let added = Object.keys(currentVariableSettingss).length;
  const patches: Record<string, VariableSettings> = {};

  const hasVariableAlready = (variable: Variable): boolean =>
    preserveVariableSettings
      ? // when preserveVariableSettings is on, just keep the variable if it is in the settings
        Object.hasOwn(currentVariableSettingss, variable.name)
      : // when preserveVariableSettings is off, only keep if its in the model (i.e. currentVariables)
        currentVariables.some(
          (v) => v.name === variable.name && v.category === variable.category,
        );

  const isPriorityVariable = (variable: Variable): boolean =>
    variable.category === "Floating Species";

  const patchVariable = (variable: Variable) => {
    if (hasVariableAlready(variable)) {
      // it's an old variable, only overwrite the display name if necessary
      if (
        currentVariableSettingss[variable.name].displayName !==
        variable.defaultDisplayName
      ) {
        patches[variable.name] = {
          ...currentVariableSettingss[variable.name],
          displayName: variable.defaultDisplayName,
        };
      }
    } else {
      // it's a new variable, add it
      patches[variable.name] = {
        displayName: variable.defaultDisplayName,
        visible:
          variable.category === "Floating Species" ||
          variable.category === "ODEs",
        color: getDefaultColorForIndex(added),
        lineStyle: "solid",
        width: 2.5,
      };
      added += 1;
    }
  };

  // first pass for time so it always gets the same color
  for (const variable of newVariables) {
    if (variable.category === "Time") {
      patchVariable(variable);
    }
  }

  // second pass for prioritized variables (this is so they get the good default colors)
  for (const variable of newVariables) {
    if (isPriorityVariable(variable)) {
      patchVariable(variable);
    }
  }

  // third pass for everything else
  for (const variable of newVariables) {
    if (variable.category !== "Time" && !isPriorityVariable(variable)) {
      patchVariable(variable);
    }
  }

  if (Object.keys(patches).length === 0) {
    return currentVariableSettingss;
  } else {
    return { ...currentVariableSettingss, ...patches };
  }
};

export interface UpdateEditorContentOptions {
  content: string;
  /** default: false */
  skipDebounce?: boolean;
  variableSettingss?: VariableSettingss;
}

export type UpdateEditorContentResult =
  | { type: "failure"; message: string }
  | { type: "canceled" }
  | { type: "success"; oldVariables: Variable[]; newVariables: Variable[] };
/**
 * Update editor content and associated things like model info, variables, etc.
 * @returns `true` on successful model update, `false` on failed model update
 */
export const updateEditorContentAtom = atom(
  null,
  async (
    get,
    set,
    {
      content,
      skipDebounce = false,
      variableSettingss,
    }: UpdateEditorContentOptions,
  ): Promise<UpdateEditorContentResult> => {
    // the !skipDebounce is for initial loads
    // if infinite loading errors on app initialization are experienced, check here
    if (get(editorContentAtom) === content && !skipDebounce) {
      return {
        type: "success",
        oldVariables: get(variablesAtom),
        newVariables: get(variablesAtom),
      };
    }

    const simulator = get(simulatorAtom);
    const variableSliderStates = get(variableSliderStatesAtom);
    const prevAbortController = get(_updateAbortControllerAtom);
    if (prevAbortController) {
      prevAbortController.abort();
    }

    const currentAbortController = new AbortController();
    set(_updateAbortControllerAtom, currentAbortController);

    set(_editorContentAtom, content);
    set(_modelStatusAtom, { type: "loading" });

    const oldVariables = get(variablesAtom);
    let newVariables: Variable[];
    try {
      // wait a bit in case the user is still typing
      if (!skipDebounce) {
        await new Promise((resolve) =>
          setTimeout(resolve, MODEL_LOAD_DEBOUNCE),
        );
        if (currentAbortController.signal.aborted) {
          throw new TaskTermination();
        }
      }

      newVariables = await simulator.loadModel(
        content,
        currentAbortController.signal,
      );
    } catch (err) {
      if (err instanceof TaskTermination) {
        return {
          type: "canceled",
        };
      } else if (err instanceof Error) {
        set(_modelStatusAtom, {
          type: "error",
          message: err.message,
        });
        return {
          type: "failure",
          message: err.message,
        };
      } else {
        throw err;
      }
    }

    // disable this for now as per steve's request
    //
    // Sort new variables in alphabetical order. Time always comes first.
    // newVariables = newVariables.sort((a, b) =>
    //   a.defaultDisplayName.localeCompare(b.defaultDisplayName),
    // );

    const independentVariable = get(independentVariableAtom);
    const parameterScanOptions = get(parameterScanOptionsAtom);

    // if the independent variable no longer exists, fallback to time if possible
    if (
      !independentVariable ||
      !newVariables.find((v) => v.name === independentVariable)
    ) {
      set(
        independentVariableAtom,
        newVariables.find(
          (v) => v.name === simulator.defaultIndependentVariableName,
        )?.name ?? null,
      );
    }

    // if the variable no longer exists, use the first available scannable parameter
    // for the parameter scan
    if (
      !parameterScanOptions.varyingParameter ||
      !newVariables.some(
        (v) =>
          v.type === "settable" &&
          v.name === parameterScanOptions.varyingParameter,
      )
    ) {
      const firstAvailableParameter = newVariables.find(
        (v) => v.type === "settable" && v.category === "Parameters",
      ) as SettableVariable;
      set(parameterScanOptionsAtom, {
        ...parameterScanOptions,
        varyingParameter:
          // first try to use the first parameter that is settable
          firstAvailableParameter?.setName ??
          // if no parameters found, use the first available settable non-parameter
          newVariables.find((v) => v.type === "settable")?.setName,
      });
    }

    set(_variablesAtom, {
      variables: newVariables,
      settingss: patchVariablesSettings(
        get(variablesAtom),
        variableSettingss ?? get(variableSettingssAtom),
        newVariables,
        !!variableSettingss, // preserve given variable settings since they are specified
      ),
    });
    set(_modelStatusAtom, { type: "success" });

    // TODO: unit test this
    // remove slider states that are no longer valid
    const newVariablesNameSet = new Set(newVariables.map((v) => v.name));
    if (
      Object.keys(variableSliderStates).some(
        (name) => !newVariablesNameSet.has(name),
      )
    ) {
      set(
        variableSliderStatesAtom,
        Object.fromEntries(
          Object.entries(variableSliderStates).filter(([name, _]) =>
            newVariablesNameSet.has(name),
          ),
        ),
      );
    }

    return {
      type: "success",
      oldVariables,
      newVariables,
    };
  },
);

export interface SetModelOptions {
  name: string;
  content: string;

  /**
   * Set the variable settingss to do this once the model is updated (then patch any
   * new variables in).
   *
   * This is used when opening a new project.
   */
  variableSettingss?: VariableSettingss;
}

/**
 * Set the model which updates the editor content and reloads the model
 * immediately.
 *
 * @returns if the model failed to load
 */
export const setModelAtom = atom(
  null,
  async (
    _get,
    set,
    { content, variableSettingss }: SetModelOptions,
  ): Promise<boolean> => {
    const updateResult = await set(updateEditorContentAtom, {
      content,
      skipDebounce: true,
      variableSettingss: variableSettingss,
    });

    return updateResult.type !== "failure";
  },
);
