import { describe, it, expect, beforeEach } from "vitest";
import type { Atom, WritableAtom } from "jotai";
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
  let mockStore: Map<unknown, unknown>;
  let context: ToolContext;

  beforeEach(() => {
    mockStore = new Map();
    context = {
      get: <Value>(atom: Atom<Value>): Value => {
        if (mockStore.has(atom)) return mockStore.get(atom) as Value;
        if ("init" in atom) return (atom as unknown as { init: Value }).init;
        return undefined as unknown as Value;
      },
      set: <Value, Args extends unknown[], Result>(
        atom: WritableAtom<Value, Args, Result>,
        ...args: Args
      ): Result => {
        mockStore.set(atom, args[0]);
        return undefined as unknown as Result;
      },
    };
  });

  it("includes identity and indicates no open project when on Start screen", () => {
    mockStore.set(hasActiveProjectAtom, false);
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
    mockStore.set(hasActiveProjectAtom, true);
    mockStore.set(activeProjectFileAtom, "proj-repressilator-456");
    mockStore.set(metadataAtom, {
      name: "Repressilator Oscillation",
      versionTag: 1,
      created: 1000,
      updated: 2000,
      icon: { color: "blue" },
    });
    mockStore.set(timeCourseParametersAtom, {
      startTime: 0,
      endTime: 150,
      numberOfPoints: 300,
    });
    mockStore.set(parameterScanOptionsAtom, {
      mode: "timeCourse",
      varyingParameter: null,
      min: 0,
      max: 10,
      numberOfValues: 10,
      useLogarithmicDistribution: false,
    });
    mockStore.set(variablesAtom, ["S1", "S2"]);
    mockStore.set(variableSettingssAtom, {
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
    mockStore.set(simulatorAtom, { name: "COPASI" });

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
    mockStore.set(hasActiveProjectAtom, true);
    mockStore.set(metadataAtom, { name: "Repressilator" });
    mockStore.set(editorContentAtom, "S1 -> S2; k1*S1\nk1 = 0.5");
    mockStore.set(timeCourseParametersAtom, {
      startTime: 0,
      endTime: 20,
      numberOfPoints: 200,
    });
    mockStore.set(parameterScanOptionsAtom, { mode: "timeCourse" });
    mockStore.set(variablesAtom, []);
    mockStore.set(variableSettingssAtom, {});
    mockStore.set(simulatorAtom, {});

    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain(
      '<current_antimony_model project="Repressilator">',
    );
    expect(prompt).toContain("S1 -> S2; k1*S1");
  });
});
