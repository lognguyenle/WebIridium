import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore, type Atom, type WritableAtom } from "jotai";
import {
  configureTimeCourseTool,
  configureParameterScanTool,
  curatePlotDisplayTool,
  runSimulationTool,
  selectSimulatorTool,
  getApplicationStateTool,
  updateAntimonyModelTool,
  saveProjectTool,
} from "../chat/harness/tools/simulationTools";
import {
  timeCourseParametersAtom,
  independentVariableAtom,
  parameterScanOptionsAtom,
} from "@/globals/settings";
import {
  variableSettingssAtom,
  modelStatusAtom,
  updateEditorContentAtom,
  variablesAtom,
  editorContentAtom,
} from "@/globals/model";
import { simulatorAtom, getSimulatorName } from "@/globals/simulator";
import { activeProjectFileAtom, metadataAtom } from "@/globals/project";
import type { ProjectId } from "@/features/savedData";
import { currentRightPanelAtom } from "@/globals/layout";
import { simulateTimeCourseAtom } from "@/globals/simulation";
import { saveFullProjectAtom } from "@/globals/saving";
import { type ToolContext } from "../chat/harness/types";

describe("Simulation Tools", () => {
  let store: ReturnType<typeof createStore>;
  let context: ToolContext;
  let mockSimulateTimeCourse: ReturnType<typeof vi.fn>;
  let mockVariables: Array<{ name: string; category?: string }> = [];

  beforeEach(() => {
    store = createStore();
    mockVariables = [];
    store.set(activeProjectFileAtom, "mock-project-123" as unknown as ProjectId);
    mockSimulateTimeCourse = vi.fn().mockResolvedValue({ type: "success" });

    context = {
      get: <Value>(atom: Atom<Value>): Value => {
        if (atom === (modelStatusAtom as unknown as Atom<Value>)) {
          return { type: "success" } as Value;
        }
        if (atom === (variablesAtom as unknown as Atom<Value>)) {
          return mockVariables as Value;
        }
        return store.get(atom);
      },
      set: <Value, Args extends unknown[], Result>(
        atom: WritableAtom<Value, Args, Result>,
        ...args: Args
      ): Result => {
        if (
          atom ===
          (simulateTimeCourseAtom as unknown as WritableAtom<
            Value,
            Args,
            Result
          >)
        ) {
          return (mockSimulateTimeCourse as (...a: Args) => Result)(...args);
        }
        return store.set(atom, ...args);
      },
    };
  });

  describe("project presence enforcement", () => {
    it("returns an error instructing the user to open a project when no project is active", async () => {
      store.set(activeProjectFileAtom, null);

      const simResult = await runSimulationTool.execute(
        { mode: "timeCourse" },
        context,
      );
      expect(simResult.success).toBe(false);
      expect(simResult.error).toBe("NO_ACTIVE_PROJECT");
      expect(simResult.message).toContain(
        "No simulation project is currently open",
      );

      const tcResult = await configureTimeCourseTool.execute(
        { endTime: 10 },
        context,
      );
      expect(tcResult.success).toBe(false);
      expect(tcResult.error).toBe("NO_ACTIVE_PROJECT");
    });
  });

  describe("configureTimeCourseTool", () => {
    it("updates time course parameters, runs simulation, and opens Results plot", async () => {
      const result = await configureTimeCourseTool.execute(
        { startTime: 5, endTime: 50, numberOfPoints: 500 },
        context,
      );

      expect(result.success).toBe(true);
      const updated = store.get(timeCourseParametersAtom);
      expect(updated.startTime).toBe(5);
      expect(updated.endTime).toBe(50);
      expect(updated.numberOfPoints).toBe(500);
      expect(store.get(currentRightPanelAtom)).toBe("Results");
    });

    it("rejects invalid time boundaries (endTime <= startTime)", async () => {
      const result = await configureTimeCourseTool.execute(
        { startTime: 50, endTime: 20 },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_TIME_RANGE");
    });

    it("rejects zero or negative numberOfPoints", async () => {
      const result = await configureTimeCourseTool.execute(
        { numberOfPoints: 0 },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_POINT_COUNT");
    });
  });

  describe("runSimulationTool", () => {
    it("runs timeCourse simulation and opens Results plot view", async () => {
      const result = await runSimulationTool.execute(
        { mode: "timeCourse" },
        context,
      );

      expect(result.success).toBe(true);
      expect(store.get(currentRightPanelAtom)).toBe("Results");
    });

    it("surfaces simulation failure if engine fails", async () => {
      mockSimulateTimeCourse.mockResolvedValueOnce({
        type: "failure",
        message: "Singular matrix in ODE solver",
      });

      const result = await runSimulationTool.execute(
        { mode: "timeCourse" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("SIMULATION_FAILED");
      expect(result.message).toContain("Singular matrix");
    });
  });

  describe("curatePlotDisplayTool", () => {
    it("toggles species visibility and ensures Results plot is open", async () => {
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        S2: {
          displayName: "S2",
          visible: true,
          color: "red",
          width: 2,
          lineStyle: "solid",
        },
        P: {
          displayName: "P",
          visible: false,
          color: "green",
          width: 2,
          lineStyle: "solid",
        },
      });

      const result = await curatePlotDisplayTool.execute(
        { visibleSpecies: ["P"], hiddenSpecies: ["S1"] },
        context,
      );

      expect(result.success).toBe(true);
      const updated = store.get(variableSettingssAtom);
      expect(updated["P"].visible).toBe(true);
      expect(updated["S1"].visible).toBe(false);
      expect(updated["S2"].visible).toBe(true);
      expect(store.get(currentRightPanelAtom)).toBe("Results");
    });

    it("switches independent axis to a valid variable", async () => {
      mockVariables = [
        { name: "Time", category: "Time" },
        { name: "S1", category: "Floating Species" },
        { name: "S2", category: "Floating Species" },
      ];
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        S2: {
          displayName: "S2",
          visible: true,
          color: "red",
          width: 2,
          lineStyle: "solid",
        },
      });

      const result = await curatePlotDisplayTool.execute(
        { independentAxis: "S1" },
        context,
      );

      expect(result.success).toBe(true);
      expect(store.get(independentVariableAtom)).toBe("S1");
    });

    it("rejects selecting variables from invalid categories (e.g. Parameters) as independent axis without mutating curves", async () => {
      mockVariables = [
        { name: "Time", category: "Time" },
        { name: "S1", category: "Floating Species" },
        { name: "k1", category: "Parameters" },
      ];
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        k1: {
          displayName: "k1",
          visible: false,
          color: "gray",
          width: 1,
          lineStyle: "solid",
        },
      });

      const result = await curatePlotDisplayTool.execute(
        { visibleSpecies: ["k1"], independentAxis: "k1" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_INDEPENDENT_VARIABLE");
      expect(result.message).toContain("category 'Parameters'");
      // Ensure variableSettingssAtom was NOT mutated
      const settings = store.get(variableSettingssAtom);
      expect(settings["k1"].visible).toBe(false);
      expect(settings["S1"].visible).toBe(true);
    });

    it("resets independent axis to Time when Time is specified", async () => {
      store.set(independentVariableAtom, "S1");
      const result = await curatePlotDisplayTool.execute(
        { independentAxis: "Time" },
        context,
      );

      expect(result.success).toBe(true);
      expect(store.get(independentVariableAtom)).toBe("Time");
    });

    it("isolates specific species when showOnly is true", async () => {
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        S2: {
          displayName: "S2",
          visible: true,
          color: "red",
          width: 2,
          lineStyle: "solid",
        },
        P: {
          displayName: "P",
          visible: true,
          color: "green",
          width: 2,
          lineStyle: "solid",
        },
      });

      const result = await curatePlotDisplayTool.execute(
        { visibleSpecies: ["S1"], showOnly: true },
        context,
      );

      expect(result.success).toBe(true);
      const updated = store.get(variableSettingssAtom);
      expect(updated["S1"].visible).toBe(true);
      expect(updated["S2"].visible).toBe(false);
      expect(updated["P"].visible).toBe(false);
    });

    it("does not modify independent axis when independentAxis is omitted", async () => {
      store.set(independentVariableAtom, "Time");
      const result = await curatePlotDisplayTool.execute(
        { visibleSpecies: ["S1"] },
        context,
      );

      expect(result.success).toBe(true);
      expect(store.get(independentVariableAtom)).toBe("Time");
    });
  });

  describe("selectSimulatorTool", () => {
    it("changes active simulator to COPASI", async () => {
      const result = await selectSimulatorTool.execute(
        { simulatorName: "COPASI" },
        context,
      );
      expect(result.success).toBe(true);
      const active = getSimulatorName(store.get(simulatorAtom));
      expect(active).toBe("COPASI");
    });

    it("rejects unknown simulators", async () => {
      const result = await selectSimulatorTool.execute(
        { simulatorName: "UnknownSim" },
        context,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("UNKNOWN_SIMULATOR");
    });
  });

  describe("getApplicationStateTool", () => {
    it("is configured as a read-only tool that does not mutate state", () => {
      expect(getApplicationStateTool.mutatesState).toBe(false);
      expect(getApplicationStateTool.name).toBe("get_application_state");
    });

    it("returns NO_ACTIVE_PROJECT status when no project is open", async () => {
      store.set(activeProjectFileAtom, null);
      const result = await getApplicationStateTool.execute({}, context);
      expect(result.success).toBe(true);
      const data = result.data as { projectOpen: boolean; status: string };
      expect(data.projectOpen).toBe(false);
      expect(data.status).toBe("NO_ACTIVE_PROJECT");
    });

    it("returns complete, verified application state when project is open", async () => {
      store.set(activeProjectFileAtom, "my-active-proj" as any);
      store.set(timeCourseParametersAtom, {
        startTime: 0,
        endTime: 75,
        numberOfPoints: 150,
      });
      store.set(variableSettingssAtom, {
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

      const result = await getApplicationStateTool.execute({}, context);
      expect(result.success).toBe(true);
      const data = result.data as {
        project: { isOpen: boolean; id: string };
        timeCourse: { endTime: number; numberOfPoints: number };
        plot: { visibleCurves: string[]; hiddenCurves: string[] };
        stateSummaryText: string;
      };
      expect(data.project.isOpen).toBe(true);
      expect(data.project.id).toBe("my-active-proj");
      expect(data.timeCourse.endTime).toBe(75);
      expect(data.timeCourse.numberOfPoints).toBe(150);
      expect(data.plot.visibleCurves).toContain("S1");
      expect(data.plot.hiddenCurves).toContain("S2");
      expect(data.stateSummaryText).toContain("<verified_application_state>");
      expect(data.stateSummaryText).toContain("end=75s, points=150");
    });
  });

  describe("state change review & thorough commitments", () => {
    it("generates detailed property changes and consequences for configureTimeCourseTool", () => {
      store.set(timeCourseParametersAtom, {
        startTime: 0,
        endTime: 10,
        numberOfPoints: 100,
      });
      const review = configureTimeCourseTool.describeChanges!(
        { startTime: 0, endTime: 50, numberOfPoints: 500 },
        context,
      );

      expect(review.summary).toContain("50s");
      expect(review.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "End Time",
            currentValue: "10s",
            proposedValue: "50s",
          }),
          expect.objectContaining({
            field: "Output Points",
            currentValue: "100",
            proposedValue: "500",
          }),
        ]),
      );
      expect(review.consequences).toBeDefined();
      expect(review.consequences?.length).toBeGreaterThan(0);
    });

    it("generates detailed property changes for curatePlotDisplayTool", () => {
      mockVariables = [
        { name: "Time", category: "Time" },
        { name: "S1", category: "Floating Species" },
        { name: "S2", category: "Floating Species" },
      ];
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        S2: {
          displayName: "S2",
          visible: true,
          color: "red",
          width: 2,
          lineStyle: "solid",
        },
      });
      store.set(independentVariableAtom, "Time");

      const review = curatePlotDisplayTool.describeChanges!(
        { visibleSpecies: ["S1"], showOnly: true, independentAxis: "S1" },
        context,
      );
      expect(review.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "Visible Curves",
            proposedValue: "ONLY [S1]",
          }),
          expect.objectContaining({
            field: "Horizontal X-Axis",
            currentValue: "Time",
            proposedValue: "S1",
          }),
        ]),
      );
    });

    it("flags invalid independent variable categories in change review", () => {
      mockVariables = [
        { name: "Time", category: "Time" },
        { name: "S1", category: "Floating Species" },
        { name: "k1", category: "Parameters" },
      ];
      store.set(variableSettingssAtom, {
        S1: {
          displayName: "S1",
          visible: true,
          color: "blue",
          width: 2,
          lineStyle: "solid",
        },
        k1: {
          displayName: "k1",
          visible: false,
          color: "gray",
          width: 2,
          lineStyle: "solid",
        },
      });
      store.set(independentVariableAtom, "Time");

      const review = curatePlotDisplayTool.describeChanges!(
        { independentAxis: "k1" },
        context,
      );
      expect(review.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "Horizontal X-Axis",
            proposedValue: expect.stringContaining(
              "INVALID: GUI only allows Time or Floating Species",
            ) as unknown as string,
          }),
        ]),
      );
    });

    it("generates detailed property changes for configureParameterScanTool", () => {
      store.set(parameterScanOptionsAtom, {
        mode: "timeCourse",
        varyingParameter: "k1",
        min: 0,
        max: 5,
        numberOfValues: 10,
        useLogarithmicDistribution: false,
      } as any);

      const review = configureParameterScanTool.describeChanges!(
        {
          varyingParameter: "k2",
          min: 1,
          max: 10,
          numberOfValues: 20,
          useLogarithmicDistribution: true,
        },
        context,
      );

      expect(review.summary).toContain("k2");
      expect(review.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "Varying Parameter",
            currentValue: "k1",
            proposedValue: "k2",
          }),
          expect.objectContaining({
            field: "Scan Range",
            currentValue: "0 to 5",
            proposedValue: "1 to 10",
          }),
          expect.objectContaining({
            field: "Distribution",
            currentValue: "Linear",
            proposedValue: "Logarithmic",
          }),
        ]),
      );
    });
  });

  describe("updateAntimonyModelTool", () => {
    it("requires user commitment, updates model code, and recompiles model", async () => {
      expect(updateAntimonyModelTool.mutatesState).toBe(true);

      let updatedContent = "";
      const customContext: ToolContext = {
        ...context,
        set: <Value, Args extends unknown[], Result>(
          atom: WritableAtom<Value, Args, Result>,
          ...args: Args
        ): Result => {
          if (
            atom ===
            (updateEditorContentAtom as unknown as WritableAtom<
              Value,
              Args,
              Result
            >)
          ) {
            const firstArg = args[0] as { content: string };
            updatedContent = firstArg.content;
            return Promise.resolve({ type: "success" }) as Result;
          }
          return context.set(atom, ...args);
        },
      };

      const result = await updateAntimonyModelTool.execute(
        {
          modelCode: "S1 -> S2; k1*S1\nk1 = 0.5",
          explanation: "Set k1 to 0.5",
        },
        customContext,
      );

      expect(result.success).toBe(true);
      expect(updatedContent).toBe("S1 -> S2; k1*S1\nk1 = 0.5");

      const review = updateAntimonyModelTool.describeChanges!(
        {
          modelCode: "S1 -> S2; k1*S1\nk1 = 0.5",
          explanation: "Set k1 to 0.5",
        },
        context,
      );
      expect(review.summary).toBe("Set k1 to 0.5");
      expect(review.changes[0].field).toBe("Antimony Model Code");
    });
  });

  describe("saveProjectTool", () => {
    it("saves active project and updates project name", async () => {
      expect(saveProjectTool.mutatesState).toBe(true);

      let saveCalled = false;
      const customContext: ToolContext = {
        ...context,
        set: <Value, Args extends unknown[], Result>(
          atom: WritableAtom<Value, Args, Result>,
          ...args: Args
        ): Result => {
          if (
            atom ===
            (saveFullProjectAtom as unknown as WritableAtom<
              Value,
              Args,
              Result
            >)
          ) {
            saveCalled = true;
            return Promise.resolve() as Result;
          }
          return context.set(atom, ...args);
        },
      };

      const result = await saveProjectTool.execute(
        { name: "My Renamed Model" },
        customContext,
      );

      expect(result.success).toBe(true);
      expect(saveCalled).toBe(true);
      expect(store.get(metadataAtom)?.name).toBe("My Renamed Model");

      const review = saveProjectTool.describeChanges!(
        { name: "My Renamed Model" },
        context,
      );
      expect(review.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "Project Name",
            proposedValue: "My Renamed Model",
          }),
        ]),
      );
    });
  });

  describe("Revert functionality for mutating tools", () => {
    it("captures revertData and restores time course settings", async () => {
      store.set(timeCourseParametersAtom, {
        startTime: 0,
        endTime: 10,
        numberOfPoints: 100,
      });

      const revertData = configureTimeCourseTool.getRevertData!(
        { endTime: 50 },
        context,
      );
      expect(revertData).toEqual({
        previousSettings: { startTime: 0, endTime: 10, numberOfPoints: 100 },
      });

      // Apply change
      store.set(timeCourseParametersAtom, {
        startTime: 0,
        endTime: 50,
        numberOfPoints: 100,
      });

      let simCalled = false;
      const customContext: ToolContext = {
        ...context,
        set: <Value, Args extends unknown[], Result>(
          atom: WritableAtom<Value, Args, Result>,
          ...args: Args
        ): Result => {
          if (
            atom ===
            (simulateTimeCourseAtom as unknown as WritableAtom<
              Value,
              Args,
              Result
            >)
          ) {
            simCalled = true;
            return Promise.resolve({ type: "success" }) as Result;
          }
          return context.set(atom, ...args);
        },
      };

      const revertResult = await configureTimeCourseTool.revert!(
        revertData,
        customContext,
      );
      expect(revertResult.success).toBe(true);
      expect(store.get(timeCourseParametersAtom).endTime).toBe(10);
      expect(simCalled).toBe(true);
    });

    it("captures revertData and restores independent axis even when previously null", async () => {
      store.set(independentVariableAtom, null);
      store.set(variableSettingssAtom, {
        S1: { displayName: "S1", visible: true, color: "blue", width: 2, lineStyle: "solid" },
      });

      const revertData = curatePlotDisplayTool.getRevertData!(
        { independentAxis: "S1" },
        context,
      );
      expect(revertData.previousIndependentVariable).toBeNull();

      // Apply change
      store.set(independentVariableAtom, "S1");
      expect(store.get(independentVariableAtom)).toBe("S1");

      const revertResult = await curatePlotDisplayTool.revert!(
        revertData,
        context,
      );
      expect(revertResult.success).toBe(true);
      expect(store.get(independentVariableAtom)).toBeNull();
    });

    it("captures revertData and restores simulator backend", async () => {
      const revertData = selectSimulatorTool.getRevertData!(
        { simulatorName: "roadrunner" },
        context,
      );
      expect(revertData.previousSimulator).toBeDefined();

      const revertResult = await selectSimulatorTool.revert!(
        revertData,
        context,
      );
      expect(revertResult.success).toBe(true);
    });

    it("captures revertData and restores Antimony model code", async () => {
      let currentEditorCode = "S1 -> S2; k1*S1";
      let restoredContent = "";
      const customContext: ToolContext = {
        ...context,
        get: <Value>(atom: Atom<Value>): Value => {
          if (atom === (editorContentAtom as unknown as Atom<Value>)) {
            return currentEditorCode as Value;
          }
          return context.get(atom);
        },
        set: <Value, Args extends unknown[], Result>(
          atom: WritableAtom<Value, Args, Result>,
          ...args: Args
        ): Result => {
          if (
            atom ===
            (updateEditorContentAtom as unknown as WritableAtom<
              Value,
              Args,
              Result
            >)
          ) {
            const firstArg = args[0] as { content: string };
            restoredContent = firstArg.content;
            currentEditorCode = firstArg.content;
            return Promise.resolve({ type: "success" }) as Result;
          }
          return context.set(atom, ...args);
        },
      };

      const revertData = updateAntimonyModelTool.getRevertData!(
        { modelCode: "S1 -> S3; k2*S1" },
        customContext,
      );
      expect(revertData.previousCode).toBe("S1 -> S2; k1*S1");

      const revertResult = await updateAntimonyModelTool.revert!(
        revertData,
        customContext,
      );
      expect(revertResult.success).toBe(true);
      expect(restoredContent).toBe("S1 -> S2; k1*S1");
    });

    it("captures revertData and restores project name", async () => {
      store.set(metadataAtom, {
        versionTag: 1,
        name: "Original Model Name",
        created: 0,
        updated: 0,
        icon: { color: "blue" },
      });
      const revertData = saveProjectTool.getRevertData!(
        { name: "New Name" },
        context,
      );
      expect(revertData.previousName).toBe("Original Model Name");

      store.set(metadataAtom, {
        versionTag: 1,
        name: "New Name",
        created: 0,
        updated: 0,
        icon: { color: "blue" },
      });

      let saveCalled = false;
      const customContext: ToolContext = {
        ...context,
        set: <Value, Args extends unknown[], Result>(
          atom: WritableAtom<Value, Args, Result>,
          ...args: Args
        ): Result => {
          if (
            atom ===
            (saveFullProjectAtom as unknown as WritableAtom<
              Value,
              Args,
              Result
            >)
          ) {
            saveCalled = true;
            return Promise.resolve() as Result;
          }
          return context.set(atom, ...args);
        },
      };

      const revertResult = await saveProjectTool.revert!(
        revertData,
        customContext,
      );
      expect(revertResult.success).toBe(true);
      expect(saveCalled).toBe(true);
      expect(store.get(metadataAtom)?.name).toBe("Original Model Name");
    });
  });
});
