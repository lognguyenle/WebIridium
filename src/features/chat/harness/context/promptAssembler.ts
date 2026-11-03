/**
 * Dynamic Prompt Assembler for the WebIridium Agent Harness.
 * Conditionally assembles high-signal system instructions, active project identity, and live simulation state.
 */

import { type ToolContext } from "../types";
import {
  timeCourseParametersAtom,
  parameterScanOptionsAtom,
  independentVariableAtom,
} from "@/globals/settings";

const ALLOWED_INDEPENDENT_VARIABLE_CATEGORIES = new Set([
  "Time",
  "Floating Species",
]);
import {
  variablesAtom,
  variableSettingssAtom,
  editorContentAtom,
} from "@/globals/model";
import { simulatorAtom, getSimulatorName } from "@/globals/simulator";
import {
  hasActiveProjectAtom,
  activeProjectFileAtom,
  metadataAtom,
} from "@/globals/project";
import { MASTER_PROMPT } from "@/globals/chat";
export { formatCurrentApplicationState } from "./stateSnapshot";

export interface PromptAssemblyOptions {
  userSystemPrompt?: string;
  includeModelContext?: boolean;
}

export const assembleAgentSystemPrompt = (
  context: ToolContext,
  options: PromptAssemblyOptions = {},
): string => {
  const sections: string[] = [];

  // 1. Identity & Objective
  sections.push(
    `You are an interactive systems biology modeling assistant embedded inside WebIridium, a web-based biological circuit editor and ODE simulator.
You help researchers build, debug, simulate, and analyze biological models written in the Antimony modeling language (SBML-compatible).`,
  );

  // 2. Formatting Guardrails & GUI Constraints
  sections.push(MASTER_PROMPT);
  sections.push(
    "CRITICAL INDEPENDENT VARIABLE RULE: In the WebIridium GUI, the independent variable (horizontal X-axis) is strictly limited to 'Time' and Floating Species only. Parameters, compartments, reactions, and boundary species CANNOT be selected as independent variables. Never call 'curate_plot_display' with an independentAxis that is a parameter, compartment, reaction, or boundary species.",
  );

  // 3. User Custom System Prompt (if provided)
  if (options.userSystemPrompt?.trim()) {
    sections.push(options.userSystemPrompt.trim());
  }

  // 4. Active Project Context & Live Simulation Workbench State
  const hasProject = context.get(hasActiveProjectAtom);
  if (hasProject) {
    const metadata = context.get(metadataAtom);
    const activeProjectId = context.get(activeProjectFileAtom);
    const timeCourse = context.get(timeCourseParametersAtom);
    const paramScan = context.get(parameterScanOptionsAtom);
    const activeSimulator = getSimulatorName(context.get(simulatorAtom));
    const allVariables = context.get(variablesAtom);
    const variableNames = allVariables.map((v) =>
      typeof v === "string" ? v : (v as { name: string }).name,
    );
    const variableSettings = context.get(variableSettingssAtom);
    const independentVar = context.get(independentVariableAtom) ?? "Time";
    const currentCode = context.get(editorContentAtom);

    const visibleVars = Object.entries(variableSettings)
      .filter(([, s]) => s.visible)
      .map(([k]) => k);

    const projectName = metadata?.name || "Current Model";

    const projectContextLines: string[] = [
      "<active_project>",
      `Project Name: "${projectName}"`,
      activeProjectId ? `Project ID: ${activeProjectId}` : "",
      "Status: Open and active in the workbench editor.",
      "CRITICAL DIRECTIVE: A project is currently OPEN and ACTIVE in the workbench. Even if earlier messages in this chat conversation history stated that no project was open, a project is NOW OPEN. Do NOT repeat previous refusals or ask the user to open a project again. You must immediately proceed with simulation, parameter configuration, or plot curation on this active model as requested.",
      "</active_project>",
      "",
      "<simulation_workbench_state>",
      `Active Project: "${projectName}"`,
      `Active Solver Backend: ${activeSimulator}`,
      `Time Course Settings: start=${timeCourse.startTime}s, end=${timeCourse.endTime}s, points=${timeCourse.numberOfPoints}`,
      `Scan Mode: ${paramScan.mode}`,
    ].filter(Boolean);

    if (paramScan.varyingParameter) {
      projectContextLines.push(
        `Active Parameter Scan: varying '${paramScan.varyingParameter}' from ${paramScan.min} to ${paramScan.max} (${paramScan.numberOfValues} steps, logScale=${paramScan.useLogarithmicDistribution})`,
      );
    }

    const allowedIndependentVars = allVariables
      .filter((v) =>
        typeof v === "object" && v !== null && "category" in v
          ? ALLOWED_INDEPENDENT_VARIABLE_CATEGORIES.has(
              (v as { category: string }).category,
            )
          : true,
      )
      .map((v) => (typeof v === "string" ? v : (v as { name: string }).name));
    const validAxisList = [
      "Time",
      ...allowedIndependentVars.filter((n) => n.toLowerCase() !== "time"),
    ];

    if (variableNames.length > 0) {
      projectContextLines.push(
        `Plottable Variables in Model: [${variableNames.join(", ")}]`,
      );
      projectContextLines.push(
        `Currently Visible on Plot: [${visibleVars.join(", ")}]`,
      );
      projectContextLines.push(`Horizontal X-Axis: ${independentVar}`);
      projectContextLines.push(
        `Available Independent Variables (X-Axis, Time/Floating Species only): [${validAxisList.join(", ")}]`,
      );
    }

    projectContextLines.push("</simulation_workbench_state>");
    sections.push(projectContextLines.join("\n"));

    // Provide model code whenever a project is active or explicitly requested
    if (currentCode?.trim() && options.includeModelContext !== false) {
      sections.push(
        `<current_antimony_model project="${projectName}">\n\`\`\`antimony\n${currentCode.trim()}\n\`\`\`\n</current_antimony_model>`,
      );
    }
  } else {
    sections.push(
      `<active_project>
Status: No project is currently open (user is on the Start screen).
CRITICAL DIRECTIVE: There is NO project open in the workbench editor. You do NOT have tools to open or create projects for the user. If the user asks to run a simulation, configure parameters, tune rate constants, modify plot species, or inspect a model, you must inform them that no project is currently open and instruct them to open an existing project or create a new project from the WebIridium start screen first.
</active_project>`,
    );
  }

  // 5. State Accuracy & Self-Verification Directive
  sections.push(
    `<state_verification_directive>
CRITICAL DIRECTIVE ON STATE ACCURACY & CLAIMS:
Never make unverified claims, guesses, or assumptions about the state of the application.
1. GROUND TRUTH: The application workbench state is dynamic. The user can change parameters, switch simulators, toggle visible species, or run simulations in the GUI at any time.
2. VERIFY BEFORE CLAIMING: Before stating what parameters are currently set, which curves are plotted, which simulator is active, or what values the simulation produced, you MUST check the live [LIVE APPLICATION STATE AT TIME OF REQUEST] attached to the prompt or call the 'get_application_state' tool.
3. NO HALLUCINATED SIMULATION DATA: If simulation results are reported as None, do NOT invent numbers or claim that a simulation has run. Clearly inform the user that a simulation must be run first, or offer to run it using 'run_simulation' or 'configure_time_course'.
4. CONFIRM AFTER ACTIONS: When you execute actions that modify settings or plots, confirm the updated state before presenting your final reply.
</state_verification_directive>`,
  );

  // 6. Tool-Calling Behavioral Guidance
  sections.push(
    `<tool_calling_guidance>
You have access to workbench simulation, plot control, and model tools ('get_application_state', 'run_simulation', 'configure_time_course', 'configure_parameter_scan', 'curate_plot_display', 'select_simulator', 'update_antimony_model', 'save_project').
- DYNAMIC WORKBENCH STATE: Always prioritize the live <active_project> section above over earlier conversational turns. If <active_project> indicates a project is open, you CAN and MUST execute tools for the user. Do not repeat earlier refusals.
- PROJECT REQUIREMENT: Workbench tools can ONLY be executed when a project is open. You cannot open or create new projects from scratch.
- If NO project is open: Do NOT call state-modifying tools. Inform the user that no project is currently open and instruct them to open or create a project in WebIridium first.
- USER COMMITMENT FOR CHANGES: Any tool that alters workbench state (simulation parameters, scan ranges, plot curves, solver backend, model code, or project saving) requires explicit user commitment via an interactive review dialog before changes take effect. Always provide clear, accurate parameters. If the user declines to commit a change, respect their decision and ask how they would prefer to proceed.
- When the user asks what the current state is, or when you need to verify state: call 'get_application_state'.
- When the user asks to modify rate constants, equations, or species in the model: call 'update_antimony_model'.
- When the user asks to change simulation duration, points, or time intervals, call 'configure_time_course'.
- When the user asks to scan a rate constant or explore parameter ranges, call 'configure_parameter_scan'.
- When the user asks to hide or show specific species, or focus the plot on particular curves, call 'curate_plot_display'.
- When the user asks to run or re-run the simulation, call 'run_simulation'.
- When the user asks to switch solvers (e.g., to COPASI or libsbmlsim), call 'select_simulator'.
- When the user asks to save the project or rename it, call 'save_project'.
All simulation and configuration tools automatically ensure the Results plot view is open so the user can immediately observe the curves.
Always briefly explain to the user what parameters were modified after a tool is executed.
</tool_calling_guidance>`,
  );

  return sections.join("\n\n");
};
