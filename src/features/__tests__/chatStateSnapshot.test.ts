import { describe, it, expect, beforeEach } from "vitest";
import type { Atom, WritableAtom } from "jotai";
import {
  getApplicationStateSnapshot,
  formatCurrentApplicationState,
} from "../chat/harness/context/stateSnapshot";
import { type ToolContext } from "../chat/harness/types";
import {
  hasActiveProjectAtom,
  activeProjectFileAtom,
  metadataAtom,
} from "@/globals/project";
import {
  timeCourseParametersAtom,
  parameterScanOptionsAtom,
  independentVariableAtom,
} from "@/globals/settings";
import {
  variablesAtom,
  variableSettingssAtom,
  modelStatusAtom,
} from "@/globals/model";
import { simulatorAtom } from "@/globals/simulator";
import { simulationResultAtom } from "@/globals/simulation";
import { currentRightPanelAtom, currentLeftPanelAtom } from "@/globals/layout";

describe("State Snapshot and Formatter", () => {
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

  describe("when no project is open", () => {
    it("reports project is closed with start screen guidance", () => {
      mockStore.set(hasActiveProjectAtom, false);
      const snapshot = getApplicationStateSnapshot(context);
      expect(snapshot.project.isOpen).toBe(false);

      const formatted = formatCurrentApplicationState(context);
      expect(formatted).toContain(
        "Project Status: No project is currently open",
      );
      expect(formatted).toContain("Workbench Editor: Inactive");
      expect(formatted).toContain(
        "CRITICAL DIRECTIVE: There is NO project open",
      );
    });
  });

  describe("when a project is open", () => {
    beforeEach(() => {
      mockStore.set(hasActiveProjectAtom, true);
      mockStore.set(activeProjectFileAtom, "proj-test-123");
      mockStore.set(metadataAtom, { name: "Glycolysis Oscillator" });
      mockStore.set(simulatorAtom, {
        name: "COPASI",
        capabilities: { canRunSteadyState: true },
      });
      mockStore.set(timeCourseParametersAtom, {
        startTime: 0,
        endTime: 60,
        numberOfPoints: 200,
      });
      mockStore.set(parameterScanOptionsAtom, {
        mode: "timeCourse",
        varyingParameter: "k1",
        min: 0.1,
        max: 5,
        numberOfValues: 20,
        useLogarithmicDistribution: true,
      });
      mockStore.set(variablesAtom, ["ATP", "ADP", "Glucose"]);
      mockStore.set(variableSettingssAtom, {
        ATP: { displayName: "ATP", visible: true },
        ADP: { displayName: "ADP", visible: true },
        Glucose: { displayName: "Glucose", visible: false },
      });
      mockStore.set(independentVariableAtom, "Time");
      mockStore.set(currentRightPanelAtom, "Results");
      mockStore.set(currentLeftPanelAtom, "Time Course");
      mockStore.set(modelStatusAtom, { type: "success" });
    });

    it("extracts comprehensive snapshot with exact parameters", () => {
      const snapshot = getApplicationStateSnapshot(context);

      expect(snapshot.project.isOpen).toBe(true);
      expect(snapshot.project.name).toBe("Glycolysis Oscillator");
      expect(snapshot.project.id).toBe("proj-test-123");
      expect(snapshot.simulator.name).toBe("COPASI");
      expect(snapshot.simulator.canRunSteadyState).toBe(true);
      expect(snapshot.panels.resultsViewOpen).toBe(true);
      expect(snapshot.panels.activeLeftPanel).toBe("Time Course");
      expect(snapshot.timeCourse.startTime).toBe(0);
      expect(snapshot.timeCourse.endTime).toBe(60);
      expect(snapshot.timeCourse.numberOfPoints).toBe(200);
      expect(snapshot.parameterScan.varyingParameter).toBe("k1");
      expect(snapshot.plot.visibleCurves).toEqual(["ATP", "ADP"]);
      expect(snapshot.plot.hiddenCurves).toEqual(["Glucose"]);
      expect(snapshot.plot.horizontalAxis).toBe("Time");
    });

    it("formats text summary containing all live parameters and panels", () => {
      const formatted = formatCurrentApplicationState(context);

      expect(formatted).toContain('Project Name: "Glycolysis Oscillator"');
      expect(formatted).toContain("Project ID: proj-test-123");
      expect(formatted).toContain(
        "Active Simulator: COPASI (Steady-state capable: Yes)",
      );
      expect(formatted).toContain(
        'UI Panels: Results Plot View=Open, Active Left Panel="Time Course"',
      );
      expect(formatted).toContain(
        "Time Course Settings: start=0s, end=60s, points=200",
      );
      expect(formatted).toContain(
        "varying 'k1' from 0.1 to 5 (20 steps, mode=timeCourse, logScale=true)",
      );
      expect(formatted).toContain("Visible Plotted Curves: [ATP, ADP]");
      expect(formatted).toContain("Hidden Curves: [Glucose]");
      expect(formatted).toContain("Model Compilation Status: Valid");
    });

    it("includes simulation result values when time course simulation exists", () => {
      mockStore.set(simulationResultAtom, {
        type: "timeCourse",
        columns: [
          { title: "Time", values: [0, 30, 60] },
          { title: "ATP", values: [5.0, 3.2, 1.8] },
          { title: "ADP", values: [0.0, 1.8, 3.2] },
        ],
      });

      const snapshot = getApplicationStateSnapshot(context);
      expect(snapshot.simulationResult.hasResult).toBe(true);
      expect(snapshot.simulationResult.timePointsCount).toBe(3);
      expect(snapshot.simulationResult.initialValues?.["ATP"]).toBe(5);
      expect(snapshot.simulationResult.finalValues?.["ATP"]).toBe(1.8);

      const formatted = formatCurrentApplicationState(context);
      expect(formatted).toContain(
        "Simulation Results: Available in memory (3 time points, range 0s to 60s)",
      );
      expect(formatted).toContain("Final Values at End Time: ATP=1.8, ADP=3.2");
    });

    it("handles error model status cleanly in snapshot and formatting", () => {
      mockStore.set(modelStatusAtom, {
        type: "error",
        message: "Syntax error on line 4: unexpected token '='",
      });

      const formatted = formatCurrentApplicationState(context);
      expect(formatted).toContain(
        "Model Compilation Status: Error - Syntax error on line 4: unexpected token '='",
      );
    });
  });
});
