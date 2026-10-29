import {
  migrateGraphSettingsV1V2,
  type GraphSettingsV2,
} from "../graphSettings/v2_steadyState3D";
import type { IridiumDataV3 } from "./v3_graphPresets";

export type IridiumDataV4 = Omit<
  IridiumDataV3,
  "versionTag" | "graphSettings"
> & {
  versionTag: 4;
  graphSettings: GraphSettingsV2;
};

export const migrateIridiumDataV3V4 = (data: IridiumDataV3): IridiumDataV4 => {
  return {
    ...data,
    versionTag: 4,
    graphSettings: migrateGraphSettingsV1V2(data.graphSettings),
  };
};
