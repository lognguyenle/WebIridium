import { describe, it, expect, beforeEach } from "vitest";
import type { Atom, WritableAtom } from "jotai";
import { assembleAgentSystemPrompt } from "../chat/harness/context/promptAssembler";
import { hasActiveProjectAtom, metadataAtom } from "@/globals/project";
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

  it("assembles static identity, formatting rules, and tool guidance without dynamic workbench state", () => {
    mockStore.set(hasActiveProjectAtom, false);
    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain("interactive systems biology");
    expect(prompt).toContain("CRITICAL INDEPENDENT VARIABLE RULE");
    expect(prompt).toContain("<tool_calling_guidance>");
    expect(prompt).toContain("[LIVE APPLICATION STATE AT TIME OF REQUEST]");
    // Dynamic workbench state is excluded from system prompt to enable 100% prefix caching
    expect(prompt).not.toContain("<simulation_workbench_state>");
    expect(prompt).not.toContain("<active_project>");
  });

  it("injects active project model code into system instructions when project is open", () => {
    mockStore.set(hasActiveProjectAtom, true);
    mockStore.set(metadataAtom, { name: "Repressilator" });
    mockStore.set(editorContentAtom, "S1 -> S2; k1*S1\nk1 = 0.5");

    const prompt = assembleAgentSystemPrompt(context);

    expect(prompt).toContain(
      '<current_antimony_model project="Repressilator">',
    );
    expect(prompt).toContain("S1 -> S2; k1*S1");
    expect(prompt).not.toContain("<simulation_workbench_state>");
  });

  it("keeps system prompt invariant across workbench parameter updates for prefix prompt caching", () => {
    mockStore.set(hasActiveProjectAtom, true);
    mockStore.set(metadataAtom, { name: "Oscillator" });
    mockStore.set(editorContentAtom, "S1 -> S2; k1*S1");
    mockStore.set(timeCourseParametersAtom, {
      startTime: 0,
      endTime: 10,
      numberOfPoints: 100,
    });
    mockStore.set(parameterScanOptionsAtom, { mode: "timeCourse" });

    const promptInitial = assembleAgentSystemPrompt(context);

    // Modify GUI sliders, scan bounds, plot settings, and solver backend
    mockStore.set(timeCourseParametersAtom, {
      startTime: 5,
      endTime: 500,
      numberOfPoints: 1000,
    });
    mockStore.set(parameterScanOptionsAtom, {
      mode: "steadyState",
      varyingParameter: "k1",
      min: 0.1,
      max: 10,
    });
    mockStore.set(variablesAtom, ["S1", "S2"]);
    mockStore.set(variableSettingssAtom, { S1: { visible: false } });
    mockStore.set(simulatorAtom, { name: "libsbmlsim" });

    const promptAfterWorkbenchChanges = assembleAgentSystemPrompt(context);

    // System prompt remains 100% byte-for-byte identical, guaranteeing a prompt cache hit!
    expect(promptAfterWorkbenchChanges).toBe(promptInitial);
  });
});
