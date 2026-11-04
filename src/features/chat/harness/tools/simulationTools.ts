/**
 * Simulation and Plot Control tools for the WebIridium Agent Harness.
 * Directly interfaces with WebIridium's reactive Jotai simulation stores.
 */

import {
  type AgentTool,
  type ToolExecutionResult,
  type StateChangeItem,
  type ChangeReviewDetails,
} from "../types";
import {
  timeCourseParametersAtom,
  parameterScanOptionsAtom,
  independentVariableAtom,
  type EditableTimeCourseParameters,
  type ParameterScanOptions,
  type VariableSettings,
} from "@/globals/settings";

const ALLOWED_INDEPENDENT_VARIABLE_CATEGORIES = new Set([
  "Time",
  "Floating Species",
]);
import {
  variableSettingssAtom,
  variablesAtom,
  getVariableSettingsFrom,
  editorContentAtom,
  updateEditorContentAtom,
} from "@/globals/model";
import {
  updateSimulatorAtom,
  SIMULATOR_LIST,
  getSimulatorName,
  simulatorAtom,
} from "@/globals/simulator";
import {
  simulateTimeCourseAtom,
  runParameterScanAtom,
  computeSteadyStateAtom,
  simulationResultAtom,
} from "@/globals/simulation";
import { hasActiveProjectAtom, metadataAtom } from "@/globals/project";
import type { SimulationOperationResult } from "@/globals/simulation";

import { saveFullProjectAtom } from "@/globals/saving";
import { currentRightPanelAtom, currentLeftPanelAtom } from "@/globals/layout";
import {
  getApplicationStateSnapshot,
  formatCurrentApplicationState,
} from "../context/stateSnapshot";

export const configureTimeCourseTool: AgentTool = {
  name: "configure_time_course",
  description:
    "Sets simulation time parameters (start time, end time, and output point density), executes the time-course simulation, and opens the Results plot view.",
  mutatesState: true,
  describeAction: (args) =>
    `Change time course to ${args.startTime ?? 0}s-${args.endTime}s (${args.numberOfPoints ?? 100} points) and simulate`,
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const current = get(timeCourseParametersAtom);
    const currentStart = current?.startTime ?? 0;
    const currentEnd = current?.endTime ?? 10;
    const currentPoints = current?.numberOfPoints ?? 100;

    const newStart =
      args.startTime !== undefined ? Number(args.startTime) : currentStart;
    const newEnd =
      args.endTime !== undefined ? Number(args.endTime) : currentEnd;
    const newPoints =
      args.numberOfPoints !== undefined
        ? Number(args.numberOfPoints)
        : currentPoints;

    const changes: StateChangeItem[] = [];
    if (newStart !== currentStart) {
      changes.push({
        field: "Start Time",
        currentValue: `${currentStart}s`,
        proposedValue: `${newStart}s`,
      });
    }
    if (newEnd !== currentEnd) {
      changes.push({
        field: "End Time",
        currentValue: `${currentEnd}s`,
        proposedValue: `${newEnd}s`,
      });
    }
    if (newPoints !== currentPoints) {
      changes.push({
        field: "Output Points",
        currentValue: String(currentPoints),
        proposedValue: String(newPoints),
      });
    }
    if (changes.length === 0) {
      changes.push({
        field: "Time Interval",
        currentValue: `${currentStart}s-${currentEnd}s`,
        proposedValue: `${newStart}s-${newEnd}s`,
      });
      changes.push({
        field: "Output Points",
        currentValue: String(currentPoints),
        proposedValue: String(newPoints),
      });
    }

    return {
      summary: `Change time course to ${newStart}s-${newEnd}s (${newPoints} points) and simulate`,
      changes,
      consequences: [
        "Updates time-course duration and resolution in settings.",
        "Executes ODE time-course simulation.",
        "Opens Results plot view to visualize updated trajectory.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    const current = get(timeCourseParametersAtom);
    return {
      previousSettings: {
        startTime: current.startTime,
        endTime: current.endTime,
        numberOfPoints: current.numberOfPoints,
      },
    };
  },
  revert: async (revertData, { set, get }) => {
    if (!get(hasActiveProjectAtom)) {
      return { success: false, message: "No active project." };
    }
    const prev = revertData.previousSettings as
      | EditableTimeCourseParameters
      | undefined;
    if (prev) {
      set(timeCourseParametersAtom, prev);
      await set(simulateTimeCourseAtom, { resetInitialConditions: true });
      set(currentRightPanelAtom, "Results");
      return {
        success: true,
        message: `Reverted time course to ${prev.startTime}s-${prev.endTime}s (${prev.numberOfPoints} points) and re-simulated.`,
      };
    }
    return { success: false, message: "Missing revert data for time course." };
  },
  parameters: {
    type: "object",
    properties: {
      startTime: {
        type: "number",
        description: "Simulation start time in seconds (default is 0).",
      },
      endTime: {
        type: "number",
        description:
          "Simulation end time in seconds (must be greater than startTime).",
      },
      numberOfPoints: {
        type: "integer",
        description:
          "Number of output intervals/points to generate (e.g., 100, 200, 1000).",
      },
      openSimulationPanel: {
        type: "boolean",
        description:
          "Whether to switch the left sidebar to the Time Course simulation controls panel (default false).",
      },
    },
    required: ["endTime"],
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    const current = get(timeCourseParametersAtom);
    const startTime =
      typeof args.startTime === "number" ? args.startTime : current.startTime;
    const endTime =
      typeof args.endTime === "number" ? args.endTime : current.endTime;

    if (typeof args.numberOfPoints === "number" && args.numberOfPoints <= 0) {
      return {
        success: false,
        message: `Invalid numberOfPoints (${args.numberOfPoints}): must be a positive integer.`,
        error: "INVALID_POINT_COUNT",
      };
    }

    const numberOfPoints =
      typeof args.numberOfPoints === "number" && args.numberOfPoints > 0
        ? Math.round(args.numberOfPoints)
        : current.numberOfPoints;

    if (endTime <= startTime) {
      return {
        success: false,
        message: `Invalid time range: endTime (${endTime}) must be strictly greater than startTime (${startTime}).`,
        error: "INVALID_TIME_RANGE",
      };
    }

    set(timeCourseParametersAtom, {
      startTime,
      endTime,
      numberOfPoints,
    });

    // Automatically trigger the simulation with updated parameters
    try {
      const simResult = await set(simulateTimeCourseAtom, {
        resetInitialConditions: true,
      });
      if (simResult && simResult.type === "failure") {
        return {
          success: false,
          message: `Simulation failed: ${simResult.message}`,
          error: "SIMULATION_FAILED",
        };
      }

      // Ensure the Results plot panel is open
      set(currentRightPanelAtom, "Results");

      if (args.openSimulationPanel) {
        set(currentLeftPanelAtom, "Time Course");
      }

      return {
        success: true,
        message: `Configured time course (${startTime}s to ${endTime}s, ${numberOfPoints} points), executed simulation, and opened Results plot view.`,
        data: { startTime, endTime, numberOfPoints },
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Simulation run encountered an error: ${err instanceof Error ? err.message : String(err)}`,
        error: "SIMULATION_EXECUTION_ERROR",
        data: { startTime, endTime, numberOfPoints },
      };
    }
  },
};

export const configureParameterScanTool: AgentTool = {
  name: "configure_parameter_scan",
  description:
    "Configures a 1D parameter scan over a given rate constant or parameter (linear or log scale), runs the scan, and opens the Results plot view.",
  mutatesState: true,
  describeAction: (args) =>
    `Configure parameter scan on '${args.varyingParameter}' from ${args.min} to ${args.max} and run scan`,
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const current = get(parameterScanOptionsAtom);
    const currentParam = current?.varyingParameter || "None";
    const currentRange = current?.varyingParameter
      ? `${current.min} to ${current.max}`
      : "None";
    const currentValues = current?.numberOfValues ?? 10;
    const currentDist = current?.useLogarithmicDistribution
      ? "Logarithmic"
      : "Linear";

    const newParam = String(args.varyingParameter);
    const newMin = Number(args.min);
    const newMax = Number(args.max);
    const newValues = args.numberOfValues
      ? Number(args.numberOfValues)
      : currentValues;
    const newDist = args.useLogarithmicDistribution ? "Logarithmic" : "Linear";
    const newMode =
      (typeof args.mode === "string" ? args.mode : undefined) ||
      current?.mode ||
      "timeCourse";

    return {
      summary: `Configure parameter scan on '${newParam}' from ${newMin} to ${newMax} and run scan`,
      changes: [
        {
          field: "Varying Parameter",
          currentValue: currentParam,
          proposedValue: newParam,
        },
        {
          field: "Scan Range",
          currentValue: currentRange,
          proposedValue: `${newMin} to ${newMax}`,
        },
        {
          field: "Number of Steps",
          currentValue: String(currentValues),
          proposedValue: String(newValues),
        },
        {
          field: "Distribution",
          currentValue: currentDist,
          proposedValue: newDist,
        },
        {
          field: "Mode",
          currentValue: current?.mode || "timeCourse",
          proposedValue: String(newMode),
        },
      ],
      consequences: [
        "Sets active parameter scan options in settings.",
        `Executes ${newValues}-run parameter scan across ${newDist.toLowerCase()} intervals.`,
        "Opens Results plot view to render multi-curve scan canvas.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    const current = get(parameterScanOptionsAtom);
    return {
      previousSettings: { ...current },
    };
  },
  revert: async (revertData, { set, get }) => {
    if (!get(hasActiveProjectAtom)) {
      return { success: false, message: "No active project." };
    }
    const prev = revertData.previousSettings as
      | ParameterScanOptions
      | undefined;
    if (prev) {
      set(parameterScanOptionsAtom, prev);
      await set(runParameterScanAtom);
      set(currentRightPanelAtom, "Results");
      return {
        success: true,
        message: `Reverted parameter scan settings on '${prev.varyingParameter || "parameter"}' and re-simulated.`,
      };
    }
    return {
      success: false,
      message: "Missing revert data for parameter scan.",
    };
  },
  parameters: {
    type: "object",
    properties: {
      varyingParameter: {
        type: "string",
        description:
          "The name of the parameter/variable to scan (e.g., 'k1', 'Vm', 'Km').",
      },
      min: {
        type: "number",
        description: "Minimum value of the parameter range.",
      },
      max: {
        type: "number",
        description: "Maximum value of the parameter range.",
      },
      numberOfValues: {
        type: "integer",
        description: "Number of steps/values to evaluate (e.g., 10, 16, 20).",
      },
      useLogarithmicDistribution: {
        type: "boolean",
        description:
          "Set to true to scan across decades on a logarithmic scale (recommended for rate constants).",
      },
      mode: {
        type: "string",
        enum: ["timeCourse", "steadyState"],
        description:
          "Scan simulation mode ('timeCourse' or 'steadyState'). Defaults to 'timeCourse'.",
      },
      openSimulationPanel: {
        type: "boolean",
        description:
          "Whether to switch the left sidebar to the Parameter Scan controls panel (default false).",
      },
    },
    required: ["varyingParameter", "min", "max"],
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    const current = get(parameterScanOptionsAtom);
    const min = Number(args.min);
    const max = Number(args.max);
    const paramName = String(args.varyingParameter || "").trim();

    if (!paramName) {
      return {
        success: false,
        message: "A parameter name must be provided for parameter scanning.",
        error: "MISSING_PARAMETER_NAME",
      };
    }

    const allVars = get(variablesAtom) || [];
    if (allVars.length > 0) {
      const settableParams = allVars
        .filter((v) => v.type === "settable")
        .map((v) => v.name);
      const targetVar = allVars.find((v) => v.name === paramName);

      if (!targetVar) {
        const settableList =
          settableParams.length > 0
            ? ` Valid settable parameters: [${settableParams.join(", ")}].`
            : "";
        return {
          success: false,
          message: `Cannot scan parameter '${paramName}': variable does not exist in the active model.${settableList}`,
          error: "INVALID_VARYING_PARAMETER",
        };
      }

      if (targetVar.type !== "settable") {
        const settableList =
          settableParams.length > 0
            ? ` Valid settable parameters: [${settableParams.join(", ")}].`
            : "";
        return {
          success: false,
          message: `Cannot scan variable '${paramName}': variable has type '${targetVar.type}' (category '${targetVar.category}') and is not settable for parameter scans. Only settable parameters can be scanned.${settableList}`,
          error: "PARAMETER_NOT_SETTABLE",
        };
      }
    }

    if (isNaN(min) || isNaN(max)) {
      return {
        success: false,
        message: "Parameters 'min' and 'max' must be valid numbers.",
        error: "INVALID_SCAN_BOUNDS",
      };
    }

    if (max <= min) {
      return {
        success: false,
        message: `Invalid scan bounds: max (${max}) must be strictly greater than min (${min}).`,
        error: "INVALID_SCAN_BOUNDS",
      };
    }

    const useLogarithmicDistribution = Boolean(args.useLogarithmicDistribution);
    if (useLogarithmicDistribution && (min <= 0 || max <= 0)) {
      return {
        success: false,
        message: `Logarithmic scan requires strictly positive boundaries (min=${min}, max=${max} > 0).`,
        error: "LOG_SCAN_NON_POSITIVE_MIN",
      };
    }

    const sim = get(simulatorAtom);
    const simName = getSimulatorName(sim);

    if (args.mode === "steadyState" && !sim.capabilities.canRunSteadyState) {
      return {
        success: false,
        error: "STEADY_STATE_UNSUPPORTED",
        message: `The active simulator '${simName}' does not support steady-state computation. Switch to COPASI or RoadRunner (Server) using 'select_simulator'.`,
      };
    }

    const updatedOptions = {
      ...current,
      varyingParameter: paramName,
      min,
      max,
      numberOfValues:
        typeof args.numberOfValues === "number" && args.numberOfValues > 0
          ? Math.round(args.numberOfValues)
          : current.numberOfValues,
      useLogarithmicDistribution,
      mode:
        args.mode === "steadyState"
          ? ("steadyState" as const)
          : ("timeCourse" as const),
      useNumberList: false,
    };

    set(parameterScanOptionsAtom, updatedOptions);

    try {
      const scanResult = await set(runParameterScanAtom);
      if (scanResult && scanResult.type === "failure") {
        return {
          success: false,
          message: `Parameter scan failed: ${scanResult.message}`,
          error: "PARAMETER_SCAN_FAILED",
        };
      }

      // Ensure the Results plot panel is open
      set(currentRightPanelAtom, "Results");

      if (args.openSimulationPanel) {
        set(currentLeftPanelAtom, "Parameter Scan");
      }

      return {
        success: true,
        message: `Set up parameter scan on '${args.varyingParameter}' from ${min} to ${max} (${
          useLogarithmicDistribution ? "log" : "linear"
        } scale), executed scan, and opened Results plot view.`,
        data: updatedOptions,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Parameter scan execution failed: ${err instanceof Error ? err.message : String(err)}`,
        error: "PARAMETER_SCAN_ERROR",
      };
    }
  },
};

export const curatePlotDisplayTool: AgentTool = {
  name: "curate_plot_display",
  description:
    "Curates which variables/species are visible on the Results plot and selects the independent X-axis variable.",
  mutatesState: true,
  describeAction: (args) => {
    const visibleSpecies = Array.isArray(args.visibleSpecies)
      ? (args.visibleSpecies as string[])
      : [];
    const hiddenSpecies = Array.isArray(args.hiddenSpecies)
      ? (args.hiddenSpecies as string[])
      : [];
    const parts: string[] = [];
    if (args.showOnly && visibleSpecies.length > 0) {
      parts.push(`show ONLY [${visibleSpecies.join(", ")}]`);
    } else {
      if (visibleSpecies.length > 0)
        parts.push(`show [${visibleSpecies.join(", ")}]`);
      if (hiddenSpecies.length > 0)
        parts.push(`hide [${hiddenSpecies.join(", ")}]`);
    }
    if (args.independentAxis)
      parts.push(`X-axis: ${String(args.independentAxis)}`);
    return `Update plot display: ${parts.join("; ") || "modify curves"}`;
  },
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const currentSettings =
      (get(variableSettingssAtom) as Record<string, VariableSettings>) || {};
    const currentVisible = Object.entries(currentSettings)
      .filter(([, s]) => Boolean(s?.visible))
      .map(([k]) => k);
    const currentAxis = (get(independentVariableAtom) as string) ?? "Time";

    const visibleSpecies = Array.isArray(args.visibleSpecies)
      ? (args.visibleSpecies as string[])
      : [];
    const hiddenSpecies = Array.isArray(args.hiddenSpecies)
      ? (args.hiddenSpecies as string[])
      : [];
    const changes: StateChangeItem[] = [];
    if (
      args.showOnly &&
      Array.isArray(args.visibleSpecies) &&
      args.visibleSpecies.length > 0
    ) {
      changes.push({
        field: "Visible Curves",
        currentValue:
          currentVisible.length > 0 ? currentVisible.join(", ") : "All curves",
        proposedValue: `ONLY [${args.visibleSpecies.join(", ")}]`,
      });
    } else {
      if (
        Array.isArray(args.visibleSpecies) &&
        args.visibleSpecies.length > 0
      ) {
        changes.push({
          field: "Show Curves",
          currentValue: "Hidden or default",
          proposedValue: args.visibleSpecies.join(", "),
        });
      }
      if (Array.isArray(args.hiddenSpecies) && args.hiddenSpecies.length > 0) {
        changes.push({
          field: "Hide Curves",
          currentValue: "Visible or default",
          proposedValue: args.hiddenSpecies.join(", "),
        });
      }
    }

    if (args.independentAxis && args.independentAxis !== currentAxis) {
      const rawAxis = String(args.independentAxis).trim();
      const knownVars = get(variablesAtom) || [];
      const hasCategories = knownVars.some(
        (v) => typeof v === "object" && v !== null && "category" in v,
      );
      const isAllowed =
        !hasCategories ||
        rawAxis.toLowerCase() === "time" ||
        knownVars.some(
          (v) =>
            v.name?.toLowerCase() === rawAxis.toLowerCase() &&
            ALLOWED_INDEPENDENT_VARIABLE_CATEGORIES.has(v.category),
        );

      changes.push({
        field: "Horizontal X-Axis",
        currentValue: currentAxis,
        proposedValue: isAllowed
          ? String(args.independentAxis)
          : `${String(args.independentAxis)} (INVALID: GUI only allows Time or Floating Species)`,
      });
    }

    const parts: string[] = [];
    if (args.showOnly && visibleSpecies.length > 0) {
      parts.push(`show ONLY [${visibleSpecies.join(", ")}]`);
    } else {
      if (visibleSpecies.length > 0)
        parts.push(`show [${visibleSpecies.join(", ")}]`);
      if (hiddenSpecies.length > 0)
        parts.push(`hide [${hiddenSpecies.join(", ")}]`);
    }
    if (args.independentAxis)
      parts.push(`X-axis: ${String(args.independentAxis)}`);

    return {
      summary: `Update plot display: ${parts.join("; ") || "modify curves"}`,
      changes:
        changes.length > 0
          ? changes
          : [
              {
                field: "Plot Curves",
                currentValue: "Current curves",
                proposedValue: "Updated curves",
              },
            ],
      consequences: [
        "Updates variable visibility settings in workbench.",
        "Redraws Results plot canvas with updated curve selection.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    return {
      previousSettings: { ...get(variableSettingssAtom) },
      previousIndependentVariable: get(independentVariableAtom),
    };
  },
  revert: (revertData, { set, get }) => {
    if (!get(hasActiveProjectAtom)) {
      return { success: false, message: "No active project." };
    }
    if (revertData.previousSettings) {
      set(variableSettingssAtom, revertData.previousSettings);
    }
    if ("previousIndependentVariable" in revertData) {
      set(
        independentVariableAtom,
        revertData.previousIndependentVariable ?? null,
      );
    }
    set(currentRightPanelAtom, "Results");
    return {
      success: true,
      message:
        "Reverted plot display curves and independent variable settings.",
    };
  },
  parameters: {
    type: "object",
    properties: {
      visibleSpecies: {
        type: "array",
        items: { type: "string" },
        description:
          "List of species or variables that should be visible on the plot.",
      },
      hiddenSpecies: {
        type: "array",
        items: { type: "string" },
        description:
          "List of species or variables that should be hidden from the plot.",
      },
      showOnly: {
        type: "boolean",
        description:
          "Set to true when the user asks to show 'only' specific species, isolate curves, or plot a specific subset, so all unlisted variables are automatically hidden. Defaults to false.",
      },
      independentAxis: {
        type: "string",
        description:
          "Optional: ONLY specify this if the user explicitly requested to change the horizontal X-axis (e.g. to 'Time' for standard time-course, or to a Floating Species like 'S1' for phase portraits). IMPORTANT: In the WebIridium GUI, independent variables are strictly restricted to 'Time' and Floating Species only. Parameters, compartments, reactions, and boundary species cannot be selected as the independent variable.",
      },
    },
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    const currentSettings = get(variableSettingssAtom);
    const updatedSettings = { ...currentSettings };
    const knownVars = get(variablesAtom);
    const knownVarNames = knownVars.map((v) =>
      typeof v === "string" ? v : (v as { name: string }).name,
    );
    const allKnownVariables: string[] = Array.from(
      new Set(
        knownVarNames.length > 0
          ? [...knownVarNames, ...Object.keys(currentSettings)]
          : Object.keys(currentSettings),
      ),
    );

    const findVarName = (input: string): string | undefined => {
      const trimmed = input.trim();
      return allKnownVariables.find(
        (v) => v.toLowerCase() === trimmed.toLowerCase(),
      );
    };

    // 1. Validate independent axis upfront BEFORE modifying any state
    let targetAxis: string | undefined;
    if (
      args.independentAxis !== undefined &&
      args.independentAxis !== null &&
      args.independentAxis !== ""
    ) {
      const rawAxis = String(args.independentAxis).trim();
      const timeVarName =
        knownVars.find((v) => v.category === "Time")?.name ?? "Time";

      const allowedVars = knownVars.filter((v) =>
        ALLOWED_INDEPENDENT_VARIABLE_CATEGORIES.has(v.category),
      );
      const allowedNames = [
        "Time",
        ...allowedVars.filter((v) => v.category !== "Time").map((v) => v.name),
      ];

      if (rawAxis.toLowerCase() === "time") {
        targetAxis = timeVarName;
      } else {
        const matchedAllowed = allowedVars.find(
          (v) => v.name.toLowerCase() === rawAxis.toLowerCase(),
        );
        if (!matchedAllowed) {
          const matchedOther = knownVars.find(
            (v) => v.name.toLowerCase() === rawAxis.toLowerCase(),
          );
          if (matchedOther) {
            return {
              success: false,
              message: `Variable '${rawAxis}' belongs to category '${matchedOther.category}', which cannot be selected as an independent variable. In the WebIridium GUI, only 'Time' and Floating Species can be selected as the independent X-axis variable. Available independent variables: [${allowedNames.join(", ")}]`,
              error: "INVALID_INDEPENDENT_VARIABLE",
            };
          }
          return {
            success: false,
            message: `Unknown variable '${rawAxis}' for independent axis. Allowed options: [${allowedNames.join(", ")}]`,
            error: "UNKNOWN_SPECIES",
          };
        }
        targetAxis = matchedAllowed.name;
      }
    }

    // 2. Validate that all requested species in visibleSpecies / hiddenSpecies exist
    if (allKnownVariables.length > 0) {
      const invalidSpecies: string[] = [];

      if (Array.isArray(args.visibleSpecies)) {
        for (const item of args.visibleSpecies) {
          const sName = String(item).trim();
          if (sName && !findVarName(sName)) {
            invalidSpecies.push(sName);
          }
        }
      }

      if (Array.isArray(args.hiddenSpecies)) {
        for (const item of args.hiddenSpecies) {
          const sName = String(item).trim();
          if (sName && !findVarName(sName)) {
            invalidSpecies.push(sName);
          }
        }
      }

      if (invalidSpecies.length > 0) {
        const uniqueInvalid = Array.from(new Set(invalidSpecies));
        const plottableList = allKnownVariables.filter(
          (n) => n.toLowerCase() !== "time",
        );
        return {
          success: false,
          error: "UNKNOWN_SPECIES",
          message: `Cannot configure plot: species [${uniqueInvalid.map((s) => `'${s}'`).join(", ")}] do not exist in the active model. Available plottable species: [${plottableList.join(", ")}]`,
        };
      }
    }

    // 3. Compute updated variable visibility settings
    let changed = false;

    if (
      args.showOnly &&
      Array.isArray(args.visibleSpecies) &&
      args.visibleSpecies.length > 0
    ) {
      const resolvedVisible = new Set(
        args.visibleSpecies
          .map((s) => findVarName(String(s)))
          .filter((s): s is string => Boolean(s)),
      );

      for (const varName of allKnownVariables) {
        if (varName.toLowerCase() === "time") continue;
        const existing = getVariableSettingsFrom(updatedSettings, varName);
        updatedSettings[varName] = {
          ...existing,
          visible: resolvedVisible.has(varName),
        };
        changed = true;
      }
    } else {
      if (Array.isArray(args.visibleSpecies)) {
        for (const name of args.visibleSpecies as string[]) {
          const matchedName = findVarName(name);
          if (matchedName) {
            const existing = getVariableSettingsFrom(
              updatedSettings,
              matchedName,
            );
            updatedSettings[matchedName] = { ...existing, visible: true };
            changed = true;
          }
        }
      }

      if (Array.isArray(args.hiddenSpecies)) {
        for (const name of args.hiddenSpecies as string[]) {
          const matchedName = findVarName(name);
          if (matchedName) {
            const existing = getVariableSettingsFrom(
              updatedSettings,
              matchedName,
            );
            updatedSettings[matchedName] = { ...existing, visible: false };
            changed = true;
          }
        }
      }
    }

    // 4. All validations passed; apply state mutations atomically
    if (changed) {
      set(variableSettingssAtom, updatedSettings);
    }

    if (targetAxis !== undefined) {
      set(independentVariableAtom, targetAxis);
    }

    // If no simulation has been run yet, run one so that the plot curves are rendered
    const hasSimResult = Boolean(get(simulationResultAtom));
    if (!hasSimResult) {
      try {
        await set(simulateTimeCourseAtom, { resetInitialConditions: false });
      } catch {
        // Non-fatal if simulation fails; plot settings are still applied
      }
    }

    // Ensure the Results plot is visible so the user sees the curated plot
    set(currentRightPanelAtom, "Results");

    return {
      success: true,
      message: "Plot display settings updated and Results plot opened.",
      data: {
        visible: Object.entries(updatedSettings)
          .filter(([, s]) => s.visible)
          .map(([k]) => k),
        independentAxis: get(independentVariableAtom) ?? "Time",
      },
    };
  },
};

export const runSimulationTool: AgentTool = {
  name: "run_simulation",
  description:
    "Triggers an immediate simulation using the currently selected solver and parameters, and opens the Results plot view.",
  mutatesState: true,
  describeAction: (args) => `Run ${args.mode || "timeCourse"} simulation`,
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const currentResult = get(simulationResultAtom);
    const currentType = currentResult ? currentResult.type : "None";
    const targetMode =
      (typeof args.mode === "string" ? args.mode : undefined) || "timeCourse";
    const sim = get(simulatorAtom);
    const simName = getSimulatorName(sim);

    return {
      summary: `Run ${targetMode} simulation using ${simName}`,
      changes: [
        {
          field: "Simulation Mode",
          currentValue: currentType,
          proposedValue: targetMode,
        },
        {
          field: "Engine Backend",
          currentValue: simName,
          proposedValue: simName,
        },
        {
          field: "Initial Conditions",
          currentValue: "Active state",
          proposedValue:
            args.resetInitialConditions !== false
              ? "Reset to starting values"
              : "Preserve active state",
        },
      ],
      consequences: [
        `Executes ${targetMode} ODE simulation via ${simName}.`,
        "Updates simulation results in memory.",
        "Opens Results plot view to display trajectories.",
        ...(!sim.capabilities.canRunSteadyState && targetMode === "steadyState"
          ? [
              `WARNING: Active simulator '${simName}' does not support steady-state computation.`,
            ]
          : []),
      ],
    };
  },
  parameters: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["timeCourse", "steadyState", "parameterScan"],
        description: "Simulation mode to run. Defaults to 'timeCourse'.",
      },
      resetInitialConditions: {
        type: "boolean",
        description:
          "Whether to reset initial concentrations back to starting values (default true).",
      },
      openSimulationPanel: {
        type: "boolean",
        description:
          "Whether to switch the left sidebar to the simulation controls panel (default false).",
      },
    },
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    const mode =
      (typeof args.mode === "string" ? args.mode : undefined) ?? "timeCourse";
    const resetInitialConditions = args.resetInitialConditions !== false;

    const sim = get(simulatorAtom);
    const simName = getSimulatorName(sim);

    if (mode === "steadyState" && !sim.capabilities.canRunSteadyState) {
      return {
        success: false,
        error: "STEADY_STATE_UNSUPPORTED",
        message: `The active simulator '${simName}' does not support steady-state computation. Switch to COPASI or RoadRunner (Server) using 'select_simulator'.`,
      };
    }

    if (mode === "parameterScan") {
      const scanOptions = get(parameterScanOptionsAtom);
      if (
        scanOptions.mode === "steadyState" &&
        !sim.capabilities.canRunSteadyState
      ) {
        return {
          success: false,
          error: "STEADY_STATE_UNSUPPORTED",
          message: `The active simulator '${simName}' does not support steady-state parameter scans. Switch to COPASI or RoadRunner (Server) using 'select_simulator'.`,
        };
      }
    }

    try {
      let simResult: SimulationOperationResult;
      if (mode === "steadyState") {
        simResult = await set(computeSteadyStateAtom);
      } else if (mode === "parameterScan") {
        simResult = await set(runParameterScanAtom);
      } else {
        simResult = await set(simulateTimeCourseAtom, {
          resetInitialConditions,
        });
      }

      if (simResult && simResult.type === "failure") {
        return {
          success: false,
          message: `Simulation failed: ${simResult.message}`,
          error: "SIMULATION_FAILED",
        };
      }

      // Ensure Results plot panel is opened on the right
      set(currentRightPanelAtom, "Results");

      if (args.openSimulationPanel) {
        set(
          currentLeftPanelAtom,
          mode === "parameterScan"
            ? "Parameter Scan"
            : mode === "steadyState"
              ? "Steady State"
              : "Time Course",
        );
      }

      return {
        success: true,
        message: `${mode === "parameterScan" ? "Parameter scan" : mode === "steadyState" ? "Steady-state computation" : "Time-course simulation"} completed successfully and Results plot view opened.`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Simulation failed: ${err instanceof Error ? err.message : String(err)}`,
        error: "SIMULATION_FAILED",
      };
    }
  },
};

export const selectSimulatorTool: AgentTool = {
  name: "select_simulator",
  description: `Selects the simulation engine backend. Available backends: ${SIMULATOR_LIST.join(", ")}.`,
  mutatesState: true,
  describeAction: (args) => `Switch simulation engine to ${args.simulatorName}`,
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const sim = get(simulatorAtom);
    const currentName = getSimulatorName(sim);
    const targetName = String(args.simulatorName);

    return {
      summary: `Switch simulation engine from ${currentName} to ${targetName}`,
      changes: [
        {
          field: "Active Solver Backend",
          currentValue: currentName,
          proposedValue: targetName,
        },
      ],
      consequences: [
        `Switches active simulation engine to ${targetName}.`,
        "Resets parameter scan settings if steady state is not supported by target solver.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    return {
      previousSimulator: getSimulatorName(get(simulatorAtom)),
    };
  },
  revert: (revertData, { set, get }) => {
    const prev = String(revertData.previousSimulator || "");
    if (prev && SIMULATOR_LIST.includes(prev)) {
      set(updateSimulatorAtom, prev);
      const active = getSimulatorName(get(simulatorAtom));
      return {
        success: true,
        message: `Reverted simulator backend to ${active}.`,
      };
    }
    return { success: false, message: "Missing revert data for simulator." };
  },
  parameters: {
    type: "object",
    properties: {
      simulatorName: {
        type: "string",
        enum: SIMULATOR_LIST,
        description: "Name of the simulator backend to activate.",
      },
    },
    required: ["simulatorName"],
  },
  execute: (args, { get, set }): ToolExecutionResult => {
    const targetName = String(args.simulatorName);
    if (!SIMULATOR_LIST.includes(targetName)) {
      return {
        success: false,
        message: `Unknown simulator '${targetName}'. Supported options: ${SIMULATOR_LIST.join(", ")}.`,
        error: "UNKNOWN_SIMULATOR",
      };
    }

    set(updateSimulatorAtom, targetName);
    const active = getSimulatorName(get(simulatorAtom));
    return {
      success: true,
      message: `Active simulator changed to ${active}.`,
      data: { simulator: active },
    };
  },
};

export const getApplicationStateTool: AgentTool = {
  name: "get_application_state",
  description:
    "Queries and inspects the live application and workbench state, including whether a project is open, model status, time course settings, parameter scan options, active simulator backend, plot display settings, active panels, and latest simulation results. Always use this tool whenever you need to check, confirm, or verify the actual state of the application before making claims or taking actions.",
  mutatesState: false,
  parameters: {
    type: "object",
    properties: {
      includeSimulationSummary: {
        type: "boolean",
        description:
          "Whether to include a summary of the latest simulation results (defaults to true).",
      },
      includeModelCode: {
        type: "boolean",
        description:
          "Whether to include the full Antimony model code (defaults to false).",
      },
    },
  },
  execute: (args, context): ToolExecutionResult => {
    const hasProject = Boolean(context.get(hasActiveProjectAtom));
    if (!hasProject) {
      return {
        success: true,
        message:
          "No project is currently open in WebIridium (user is on the Start screen).",
        data: {
          projectOpen: false,
          status: "NO_ACTIVE_PROJECT",
        },
      };
    }

    const snapshot = getApplicationStateSnapshot(context, {
      includeSimulationSummary: args?.includeSimulationSummary !== false,
      includeModelCode: Boolean(args?.includeModelCode),
    });

    const summaryText = formatCurrentApplicationState(context, {
      includeSimulationSummary: args?.includeSimulationSummary !== false,
      includeModelCode: Boolean(args?.includeModelCode),
    });

    return {
      success: true,
      message: "Current application state retrieved and verified.",
      data: {
        ...snapshot,
        stateSummaryText: summaryText,
      },
    };
  },
};

export const updateAntimonyModelTool: AgentTool = {
  name: "update_antimony_model",
  description:
    "Modifies the Antimony model code in the workbench editor (e.g. updating rate constants, adding/removing reactions, modifying species or compartment definitions). Always requires user commitment before applying.",
  mutatesState: true,
  describeAction: (args) =>
    typeof args.explanation === "string"
      ? args.explanation
      : "Update Antimony model code",
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const currentCode = get(editorContentAtom) || "";
    const currentLines = currentCode.split("\n").length;
    const newCode = String(args.modelCode || "");
    const newLines = newCode.split("\n").length;

    return {
      summary:
        typeof args.explanation === "string"
          ? args.explanation
          : `Update Antimony model code (${newLines} lines)`,
      changes: [
        {
          field: "Antimony Model Code",
          currentValue: `${currentLines} lines in editor`,
          proposedValue: `${newLines} lines (${typeof args.explanation === "string" ? args.explanation : "modified equations"})`,
        },
      ],
      consequences: [
        "Replaces editor content with updated Antimony code.",
        "Recompiles model via libantimony and reinitializes species.",
        "Resets previous simulation results until next simulation run.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    return {
      previousCode: get(editorContentAtom) || "",
    };
  },
  revert: async (revertData, { set, get }) => {
    if (!get(hasActiveProjectAtom)) {
      return { success: false, message: "No active project." };
    }
    const prevCode =
      typeof revertData.previousCode === "string"
        ? revertData.previousCode
        : "";
    if (typeof prevCode === "string") {
      await set(updateEditorContentAtom, {
        content: prevCode,
        skipDebounce: true,
      });
      return {
        success: true,
        message: "Restored previous Antimony model code.",
      };
    }
    return {
      success: false,
      message: "Missing revert data for Antimony model.",
    };
  },
  parameters: {
    type: "object",
    properties: {
      modelCode: {
        type: "string",
        description:
          "The complete updated Antimony model code to write into the workbench editor.",
      },
      explanation: {
        type: "string",
        description:
          "A concise explanation of the changes made (e.g., 'Increased rate constant k1 from 0.1 to 0.5 to restore sustained oscillations').",
      },
    },
    required: ["modelCode", "explanation"],
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    const newCode = String(args.modelCode || "").trim();
    if (!newCode) {
      return {
        success: false,
        message: "Model code cannot be empty.",
        error: "EMPTY_MODEL_CODE",
      };
    }

    const updateResult = await set(updateEditorContentAtom, {
      content: newCode,
      skipDebounce: true,
    });

    if (updateResult && updateResult.type === "failure") {
      return {
        success: false,
        message: `Model update compilation failed: ${updateResult.message}`,
        error: "MODEL_COMPILATION_ERROR",
      };
    }

    return {
      success: true,
      message: `Antimony model code successfully updated and recompiled: ${args.explanation || "changes applied"}.`,
      data: {
        explanation:
          typeof args.explanation === "string" ? args.explanation : undefined,
        modelLength: newCode.length,
      },
    };
  },
};

export const saveProjectTool: AgentTool = {
  name: "save_project",
  description:
    "Saves the active project to storage, optionally updating the project name. Always requires user commitment before applying.",
  mutatesState: true,
  describeAction: (args) =>
    `Save project${args.name ? ` as '${args.name}'` : ""}`,
  describeChanges: (args, { get }): ChangeReviewDetails => {
    const meta = get(metadataAtom);
    const currentName = meta?.name || "Untitled";
    const newName = args.name ? String(args.name) : currentName;

    return {
      summary: `Save project${args.name ? ` as '${args.name}'` : ""}`,
      changes: [
        {
          field: "Project Name",
          currentValue: currentName,
          proposedValue: newName,
        },
        {
          field: "Save Status",
          currentValue: "Unsaved modifications in session",
          proposedValue: "Committed to storage",
        },
      ],
      consequences: [
        "Persists active model code, simulation parameters, and plot settings to local storage.",
      ],
    };
  },
  getRevertData: (_args, { get }) => {
    return {
      previousName: get(metadataAtom)?.name || "Untitled",
    };
  },
  revert: async (revertData, { set, get }) => {
    if (!get(hasActiveProjectAtom)) {
      return { success: false, message: "No active project." };
    }
    const prevName =
      typeof revertData.previousName === "string"
        ? revertData.previousName
        : "";
    if (prevName) {
      const currentMeta = get(metadataAtom);
      set(metadataAtom, { ...currentMeta, name: String(prevName) });
      await set(saveFullProjectAtom);
      return {
        success: true,
        message: `Reverted project name to '${prevName}'.`,
      };
    }
    return { success: false, message: "Missing revert data for project name." };
  },
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Optional new name for the project.",
      },
    },
  },
  execute: async (args, { get, set }): Promise<ToolExecutionResult> => {
    if (!get(hasActiveProjectAtom)) {
      return {
        success: false,
        message:
          "No simulation project is currently open. Please open or create a project first.",
        error: "NO_ACTIVE_PROJECT",
      };
    }

    if (args.name) {
      const currentMeta = get(metadataAtom);
      set(metadataAtom, { ...currentMeta, name: String(args.name) });
    }

    await set(saveFullProjectAtom);
    return {
      success: true,
      message: `Project saved successfully${args.name ? ` as '${args.name}'` : ""}.`,
    };
  },
};

export const simulationTools: AgentTool[] = [
  configureTimeCourseTool,
  configureParameterScanTool,
  curatePlotDisplayTool,
  runSimulationTool,
  selectSimulatorTool,
  updateAntimonyModelTool,
  saveProjectTool,
  getApplicationStateTool,
];
