/**
 * Authoritative Application and Workbench State Snapshot Generator.
 * Directly extracts live, verified state from Jotai atoms to guarantee
 * factual grounding and eliminate hallucinations in agent reasoning.
 */

import { type ToolContext } from "../types";
import {
  timeCourseParametersAtom,
  parameterScanOptionsAtom,
  independentVariableAtom,
} from "@/globals/settings";
import {
  variablesAtom,
  variableSettingssAtom,
  editorContentAtom,
  modelStatusAtom,
} from "@/globals/model";
import { simulatorAtom, getSimulatorName } from "@/globals/simulator";
import {
  hasActiveProjectAtom,
  activeProjectFileAtom,
  metadataAtom,
} from "@/globals/project";
import { simulationResultAtom, isSimulatingAtom } from "@/globals/simulation";
import { currentRightPanelAtom, currentLeftPanelAtom } from "@/globals/layout";
import type { Simulator, Variable } from "@/features/simulation/Simulator";
import type { VariableSettings } from "@/globals/settings";
import type { ModelStatus } from "@/globals/model";

export interface ApplicationStateSnapshot {
  project: {
    isOpen: boolean;
    name: string;
    id: string | null;
  };
  simulator: {
    name: string;
    canRunSteadyState: boolean;
  };
  panels: {
    resultsViewOpen: boolean;
    activeLeftPanel: string | null;
  };
  timeCourse: {
    startTime: number;
    endTime: number;
    numberOfPoints: number;
  };
  parameterScan: {
    mode: "timeCourse" | "steadyState";
    varyingParameter: string | null;
    min: number;
    max: number;
    numberOfValues: number;
    useLogarithmicDistribution: boolean;
  };
  plot: {
    horizontalAxis: string;
    validIndependentVariables: string[];
    visibleCurves: string[];
    hiddenCurves: string[];
    allPlottableVariables: string[];
  };
  simulationResult: {
    hasResult: boolean;
    isSimulating: boolean;
    type: "timeCourse" | "steadyState" | "parameterScan" | null;
    timePointsCount?: number;
    timeRange?: { start: number; end: number };
    initialValues?: Record<string, number>;
    finalValues?: Record<string, number>;
    steadyStateConcentrations?: Record<string, number>;
    parameterScanSummary?: {
      parameter: string;
      mode: string;
      scanCount: number;
    };
  };
  model: {
    status: "loading" | "error" | "success";
    statusMessage: string | null;
    code?: string;
  };
}

export interface StateSnapshotOptions {
  includeModelCode?: boolean;
  includeSimulationSummary?: boolean;
}

const resolveSimulatorName = (sim: unknown): string => {
  if (!sim) return "COPASI";
  if (typeof sim === "object" && sim !== null) {
    if ("name" in sim && typeof (sim as { name: unknown }).name === "string") {
      return (sim as { name: string }).name;
    }
    try {
      return getSimulatorName(sim as Simulator);
    } catch {
      return "COPASI";
    }
  }
  return "COPASI";
};

export const getApplicationStateSnapshot = (
  context: ToolContext,
  options: StateSnapshotOptions = {},
): ApplicationStateSnapshot => {
  const hasProject = Boolean(context.get(hasActiveProjectAtom));
  const activeProjectId = context.get(activeProjectFileAtom) ?? null;
  const metadata = context.get(metadataAtom);
  const projectName = metadata?.name || "Current Model";

  const rawSim = context.get(simulatorAtom);
  const simulatorName = resolveSimulatorName(rawSim);
  const canRunSteadyState = (rawSim as { capabilities?: { canRunSteadyState?: boolean } } | null)?.capabilities?.canRunSteadyState ?? true;

  const resultsViewOpen = context.get(currentRightPanelAtom) === "Results";
  const activeLeftPanel =
    context.get(currentLeftPanelAtom) ?? null;

  const rawTimeCourse = context.get(timeCourseParametersAtom);
  const timeCourse = {
    startTime:
      typeof rawTimeCourse?.startTime === "number"
        ? rawTimeCourse.startTime
        : 0,
    endTime:
      typeof rawTimeCourse?.endTime === "number" ? rawTimeCourse.endTime : 10,
    numberOfPoints:
      typeof rawTimeCourse?.numberOfPoints === "number"
        ? rawTimeCourse.numberOfPoints
        : 100,
  };

  const rawScan = context.get(parameterScanOptionsAtom);
  const parameterScan = {
    mode: rawScan?.mode === "steadyState" ? ("steadyState" as const) : ("timeCourse" as const),
    varyingParameter: rawScan?.varyingParameter ?? null,
    min: typeof rawScan?.min === "number" ? rawScan.min : 0,
    max: typeof rawScan?.max === "number" ? rawScan.max : 10,
    numberOfValues:
      typeof rawScan?.numberOfValues === "number" ? rawScan.numberOfValues : 10,
    useLogarithmicDistribution: Boolean(rawScan?.useLogarithmicDistribution),
  };

  const rawVars = (context.get(variablesAtom) || []) as Array<Variable | string | { name?: string; category?: string }>;
  const varNamesFromVars = rawVars
    .map((v) => (typeof v === "string" ? v : v.name || ""))
    .filter(Boolean);
  const rawSettings = (context.get(variableSettingssAtom) || {}) as Record<string, VariableSettings | undefined>;
  const allPlottableVariables: string[] = Array.from(
    new Set([...varNamesFromVars, ...Object.keys(rawSettings)]),
  );
  const visibleCurves: string[] = [];
  const hiddenCurves: string[] = [];
  for (const name of allPlottableVariables) {
    if (rawSettings[name]?.visible === false) {
      hiddenCurves.push(name);
    } else {
      visibleCurves.push(name);
    }
  }

  const horizontalAxis = context.get(independentVariableAtom) ?? "Time";
  const allowedIndependentVars = rawVars.filter((v) => {
    if (typeof v === "object" && v !== null && "category" in v) {
      return v.category === "Time" || v.category === "Floating Species";
    }
    return true;
  });
  const validIndependentVariables: string[] = [
    "Time",
    ...allowedIndependentVars
      .map((v) => (typeof v === "string" ? v : v.name || ""))
      .filter((n) => n && n.toLowerCase() !== "time"),
  ];

  const isSimulating = Boolean(context.get(isSimulatingAtom));
  const simResult = context.get(simulationResultAtom);

  const simResultSummary: ApplicationStateSnapshot["simulationResult"] = {
    hasResult: Boolean(simResult),
    isSimulating,
    type: simResult?.type ?? null,
  };

  if (simResult && options.includeSimulationSummary !== false) {
    if (simResult.type === "timeCourse" && simResult.columns.length > 0) {
      const timeCol =
        simResult.columns.find((c) => c.title.toLowerCase() === "time") ||
        simResult.columns[0];
      const count = timeCol?.values.length ?? 0;
      simResultSummary.timePointsCount = count;
      if (count > 0) {
        simResultSummary.timeRange = {
          start: timeCol.values[0],
          end: timeCol.values[count - 1],
        };
        const initialVals: Record<string, number> = {};
        const finalVals: Record<string, number> = {};
        for (const col of simResult.columns) {
          if (col === timeCol) continue;
          if (col.values.length > 0) {
            initialVals[col.title] = Number(col.values[0].toPrecision(4));
            finalVals[col.title] = Number(col.values[count - 1].toPrecision(4));
          }
        }
        simResultSummary.initialValues = initialVals;
        simResultSummary.finalValues = finalVals;
      }
    } else if (simResult.type === "steadyState") {
      const concentrations: Record<string, number> = {};
      for (const item of simResult.concentrations) {
        concentrations[item.name] = Number(item.value.toPrecision(4));
      }
      simResultSummary.steadyStateConcentrations = concentrations;
    } else if (simResult.type === "parameterScan") {
      simResultSummary.parameterScanSummary = {
        parameter: simResult.parameter,
        mode: simResult.mode,
        scanCount: simResult.scans.length,
      };
    }
  }

  const rawModelStatus = context.get(modelStatusAtom) as ModelStatus | undefined;
  const modelStatus = {
    status: (rawModelStatus?.type ?? "success"),
    statusMessage: rawModelStatus && "message" in rawModelStatus ? rawModelStatus.message : null,
    code: options.includeModelCode
      ? context.get(editorContentAtom) || ""
      : undefined,
  };

  return {
    project: {
      isOpen: hasProject,
      name: projectName,
      id: activeProjectId,
    },
    simulator: {
      name: simulatorName,
      canRunSteadyState,
    },
    panels: {
      resultsViewOpen,
      activeLeftPanel,
    },
    timeCourse,
    parameterScan,
    plot: {
      horizontalAxis,
      validIndependentVariables,
      visibleCurves,
      hiddenCurves,
      allPlottableVariables,
    },
    simulationResult: simResultSummary,
    model: modelStatus,
  };
};

export const formatCurrentApplicationState = (
  context: ToolContext,
  options: StateSnapshotOptions = {},
): string => {
  const snapshot = getApplicationStateSnapshot(context, options);
  const lines: string[] = ["<verified_application_state>"];

  if (!snapshot.project.isOpen) {
    lines.push(
      "Project Status: No project is currently open (User is on the Start screen).",
    );
    lines.push("Workbench Editor: Inactive.");
    lines.push("Simulation Results: None.");
    lines.push(
      "CRITICAL DIRECTIVE: There is NO project open. You cannot run simulations, inspect variables, or configure parameters. Instruct the user to open or create a project first.",
    );
    lines.push("</verified_application_state>");
    return lines.join("\n");
  }

  // Active Project Details
  lines.push(`Project Status: Open`);
  lines.push(`Project Name: "${snapshot.project.name}"`);
  if (snapshot.project.id) {
    lines.push(`Project ID: ${snapshot.project.id}`);
  }

  // Simulator Engine
  lines.push(
    `Active Simulator: ${snapshot.simulator.name} (Steady-state capable: ${snapshot.simulator.canRunSteadyState ? "Yes" : "No"})`,
  );

  // Active GUI Panels
  lines.push(
    `UI Panels: Results Plot View=${snapshot.panels.resultsViewOpen ? "Open" : "Closed"}, Active Left Panel=${snapshot.panels.activeLeftPanel ? `"${snapshot.panels.activeLeftPanel}"` : "None"}`,
  );

  // Time Course Parameters
  lines.push(
    `Time Course Settings: start=${snapshot.timeCourse.startTime}s, end=${snapshot.timeCourse.endTime}s, points=${snapshot.timeCourse.numberOfPoints}`,
  );

  // Parameter Scan Settings
  if (snapshot.parameterScan.varyingParameter) {
    lines.push(
      `Parameter Scan: varying '${snapshot.parameterScan.varyingParameter}' from ${snapshot.parameterScan.min} to ${snapshot.parameterScan.max} (${snapshot.parameterScan.numberOfValues} steps, mode=${snapshot.parameterScan.mode}, logScale=${snapshot.parameterScan.useLogarithmicDistribution})`,
    );
  } else {
    lines.push(
      `Parameter Scan: mode=${snapshot.parameterScan.mode}, varyingParameter=None`,
    );
  }

  // Plot Species & Axes
  lines.push(`Plot Display: Horizontal X-Axis=${snapshot.plot.horizontalAxis}`);
  lines.push(
    `Available Independent Variables (X-Axis, Time/Floating Species only): [${snapshot.plot.validIndependentVariables.join(", ")}]`,
  );
  lines.push(
    `Visible Plotted Curves: [${snapshot.plot.visibleCurves.join(", ")}]`,
  );
  if (snapshot.plot.hiddenCurves.length > 0) {
    lines.push(`Hidden Curves: [${snapshot.plot.hiddenCurves.join(", ")}]`);
  }
  lines.push(
    `All Plottable Variables: [${snapshot.plot.allPlottableVariables.join(", ")}]`,
  );

  // Simulation Results Status & Values
  if (snapshot.simulationResult.hasResult) {
    if (snapshot.simulationResult.type === "timeCourse") {
      lines.push(
        `Simulation Results: Available in memory (${snapshot.simulationResult.timePointsCount ?? 0} time points, range ${snapshot.simulationResult.timeRange?.start ?? 0}s to ${snapshot.simulationResult.timeRange?.end ?? 0}s)`,
      );
      if (snapshot.simulationResult.finalValues) {
        const finalEntries = Object.entries(
          snapshot.simulationResult.finalValues,
        )
          .slice(0, 8)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        lines.push(`Final Values at End Time: ${finalEntries}`);
      }
    } else if (snapshot.simulationResult.type === "steadyState") {
      lines.push("Simulation Results: Steady State available in memory.");
      if (snapshot.simulationResult.steadyStateConcentrations) {
        const concEntries = Object.entries(
          snapshot.simulationResult.steadyStateConcentrations,
        )
          .slice(0, 8)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        lines.push(`Steady State Concentrations: ${concEntries}`);
      }
    } else if (snapshot.simulationResult.type === "parameterScan") {
      lines.push(
        `Simulation Results: Parameter scan completed (${snapshot.simulationResult.parameterScanSummary?.scanCount ?? 0} runs for '${snapshot.simulationResult.parameterScanSummary?.parameter}').`,
      );
    }
  } else {
    lines.push(
      "Simulation Results: None (simulation has not been executed yet in this session).",
    );
  }

  // Model Validation
  if (snapshot.model.status === "error" && snapshot.model.statusMessage) {
    lines.push(
      `Model Compilation Status: Error - ${snapshot.model.statusMessage}`,
    );
  } else {
    lines.push("Model Compilation Status: Valid");
  }

  lines.push("</verified_application_state>");
  return lines.join("\n");
};
