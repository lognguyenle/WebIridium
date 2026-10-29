import type { Palette } from "@/features/colors";
import type { GraphSettingsV1 } from "./v1";

export type GraphSettingsV2 = Omit<GraphSettingsV1, "versionTag"> & {
  versionTag: 2;
  steadyState3d: {
    isAutoScaledZ: boolean;
    minZ: number;
    maxZ: number;
    colorScheme: Exclude<Palette, "Custom">;
  };
};

export const migrateGraphSettingsV1V2 = (
  data: GraphSettingsV1,
): GraphSettingsV2 => {
  return {
    ...data,
    versionTag: 2,
    steadyState3d: {
      isAutoScaledZ: true,
      minZ: 0,
      maxZ: 20,
      colorScheme: "BlueRed",
    },
  };
};
