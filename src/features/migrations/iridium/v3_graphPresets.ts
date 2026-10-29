import type { GraphSettingsV1 } from "../graphSettings/v1";
import type { IridiumDataV2 } from "./v2_simulationParameters";

export type IridiumDataV3 = Omit<
  IridiumDataV2,
  "versionTag" | "graphSettings"
> & {
  versionTag: 3;
  currentGraphPreset: string;
  graphSettings: GraphSettingsV1;
};

export const migrateIridiumDataV2V3 = (data: IridiumDataV2): IridiumDataV3 => {
  return {
    ...data,
    versionTag: 3,
    currentGraphPreset: "Custom",
    graphSettings: {
      ...data.graphSettings,
      versionTag: 1,
    },
  };
};
