import { describe, bench, vi } from "vitest";
vi.unmock("@/features/workers");
import { Simulator } from "@/features/simulation/Simulator.ts";
import { CopasiSimulator } from "@/features/simulation/CopasiSimulator";
import { LibSbmlSimSimulator } from "../simulation/LibSbmlSimSimulator.ts";

import { testModels } from "./testModels.ts";

const simulators: Record<string, new () => Simulator> = {
  copasi: CopasiSimulator,
  libsbmlsim: LibSbmlSimSimulator,
};

const simulatorModels: Record<string, Record<string, string>> = {
  copasi: testModels,
  libsbmlsim: {
    "default model": testModels["default model"],
    "kholodenko medium": testModels["kholodenko medium"],
  },
};

for (const [simulatorName, simulatorConstructor] of Object.entries(
  simulators,
)) {
  describe(simulatorName, () => {
    describe("simple time course", async () => {
      for (const [name, code] of Object.entries(
        simulatorModels[simulatorName],
      )) {
        const simulator = new simulatorConstructor();
        const variables = await simulator.loadModel(code);
        const includedVariables = variables.filter(
          (v) => v.category === "Floating Species",
        );

        bench(
          name,
          async () => {
            await simulator.simulateTimeCourse(code, {
              parameters: {
                startTime: 0,
                endTime: 30,
                includedVariables: includedVariables,
                numberOfPoints: 300,
                resetInitialConditions: true,
              },
              variableValues: {},
            });
          },
          { warmupIterations: 5 },
        );
      }
    });

    describe("load model", () => {
      for (const [name, code] of Object.entries(testModels)) {
        bench(name, async () => {
          const simulator = new simulatorConstructor();
          await simulator.loadModel(code);
        });
      }
    });
  });
}
