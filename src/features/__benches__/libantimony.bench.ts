import { bench, describe } from "vitest";
import { convertAntimonyToSbml } from "@/features/antimony";
import { testModels } from "./testModels.ts";

describe("convert to sbml", () => {
  for (const [name, code] of Object.entries(testModels)) {
    bench(
      name,
      async () => {
        await convertAntimonyToSbml(code);
      },
      { warmupIterations: 3 },
    );
  }
});
