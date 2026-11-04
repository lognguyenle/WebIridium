import { describe, expect, it } from "vitest";

import { addVariablePresetToModel } from "../presetComments";

const testFiles: Record<string, string> = import.meta.glob(
  "./presetTests/*.ant",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);

describe("addVariablePresetsToModel", () => {
  const PRESET_NAME = "test";
  const PRESETS = {
    A: 20,
    B: 30,
    C: 40,
  };

  const COMMENT_REGEX = /\s*\/\/ Parameter Set:/;

  for (const [name, content] of Object.entries(testFiles)) {
    if (name.endsWith("_expected.ant")) continue;
    const nameWithoutExtension = name.substring(0, name.length - 4);
    const expectedContent = testFiles[`${nameWithoutExtension}_expected.ant`];

    it(`should work for ${name}`, () => {
      const normalizedContent = content.replace(/\r\n/g, "\n").trim();
      const normalizedExpected = expectedContent.replace(/\r\n/g, "\n").trim();
      const [result, { line }] = addVariablePresetToModel(
        normalizedContent,
        PRESET_NAME,
        PRESETS,
      );
      expect(result.replace(/\r\n/g, "\n")).toBe(normalizedExpected);
      expect(result.replace(/\r\n/g, "\n").split("\n")[line]).toMatch(
        COMMENT_REGEX,
      );
    });
  }
});
