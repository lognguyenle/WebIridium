import { describe, it, expect, beforeEach } from "vitest";
import { assembleAgentSystemPrompt } from "../chat/harness/context/promptAssembler";
import {
  hasActiveProjectAtom,
  activeProjectFileAtom,
  metadataAtom,
} from "@/globals/project";
import {
  timeCourseParametersAtom,
  parameterScanOptionsAtom,
} from "@/globals/settings";
import {
  variablesAtom,
  variableSettingssAtom,
  editorContentAtom,
} from "@/globals/model";
import { simulatorAtom } from "@/globals/simulator";
import { type ToolContext } from "../chat/harness/types";

describe("assembleAgentSystemPrompt", () => {
  let mockState: Map<any, any>;
  let context: ToolContext;

  beforeEach(() => {
    mockState = new Map();
    context = {
      get: (atom: any) => {
        if (mockState.has(atom)) return mockState.get(atom);
        return atom.init;
      },
      set: ((atom: any, ...args: any[]) => {
        mockState.set(atom, args[0]);
      }) as any,
    };
  });

  it("includes identity and indicates no open project when on Start screen", () => {
    mockState.set(hasActiveProjectAtom, false);
    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain("interactive systems biology");
    expect(prompt).toContain("<active_project>");
    expect(prompt).toContain("No project is currently open");
    expect(prompt).toContain(
      "You do NOT have tools to open or create projects",
    );
    expect(prompt).toContain(
      "instruct them to open an existing project or create a new project",
    );
    expect(prompt).toContain("<tool_calling_guidance>");
    expect(prompt).not.toContain("<simulation_workbench_state>");
  });

  it("injects active project identity and live simulation state when project is open", () => {
    mockState.set(hasActiveProjectAtom, true);
    mockState.set(activeProjectFileAtom, "proj-repressilator-456");
    mockState.set(metadataAtom, {
      name: "Repressilator Oscillation",
      versionTag: 1,
      created: 1000,
      updated: 2000,
      icon: { color: "blue" },
    });
    mockState.set(timeCourseParametersAtom, {
      startTime: 0,
      endTime: 150,
      numberOfPoints: 300,
    });
    mockState.set(parameterScanOptionsAtom, {
      mode: "timeCourse",
      varyingParameter: null,
      min: 0,
      max: 10,
      numberOfValues: 10,
      useLogarithmicDistribution: false,
    });
    mockState.set(variablesAtom, ["S1", "S2"]);
    mockState.set(variableSettingssAtom, {
      S1: {
        displayName: "S1",
        visible: true,
        color: "blue",
        width: 2,
        lineStyle: "solid",
      },
      S2: {
        displayName: "S2",
        visible: false,
        color: "red",
        width: 2,
        lineStyle: "solid",
      },
    });
    mockState.set(simulatorAtom, { name: "COPASI" });

    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain("<active_project>");
    expect(prompt).toContain('Project Name: "Repressilator Oscillation"');
    expect(prompt).toContain("proj-repressilator-456");
    expect(prompt).toContain(
      "A project is currently OPEN and ACTIVE in the workbench",
    );
    expect(prompt).toContain(
      "Even if earlier messages in this chat conversation history stated that no project was open",
    );
    expect(prompt).toContain("<simulation_workbench_state>");
    expect(prompt).toContain("start=0s, end=150s, points=300");
  });

  it("injects active project model code into system instructions", () => {
    mockState.set(hasActiveProjectAtom, true);
    mockState.set(metadataAtom, { name: "Repressilator" });
    mockState.set(editorContentAtom, "S1 -> S2; k1*S1\nk1 = 0.5");
    mockState.set(timeCourseParametersAtom, {
      startTime: 0,
      endTime: 20,
      numberOfPoints: 200,
    });
    mockState.set(parameterScanOptionsAtom, { mode: "timeCourse" });
    mockState.set(variablesAtom, []);
    mockState.set(variableSettingssAtom, {});
    mockState.set(simulatorAtom, {});

    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain(
      '<current_antimony_model project="Repressilator">',
    );
    expect(prompt).toContain("S1 -> S2; k1*S1");
  });
});
