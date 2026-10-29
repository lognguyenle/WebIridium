import { useAtomValue, useAtom, atom, useSetAtom } from "jotai";

import styles from "./results.module.css";

import SelectProperty from "@/components/property-list/SelectProperty";
import BooleanProperty from "@/components/property-list/BooleanProperty";
import NumericProperty from "@/components/property-list/NumericProperty";
import PropertyList from "@/components/property-list/PropertyList";
import ArrayBarChart3D from "./visuals/ArrayBarChart3D";
import { Allotment } from "allotment";

import { simulationResultAtom } from "@/globals/simulation";
import { PALETTES } from "@/features/colors";
import {
  graphSettingsAtom,
  updateGraphSettingsAtom,
} from "@/globals/graphPresets";

// eslint-disable-next-line
export const steadyState3DItemAtom = atom<SteadyState3DItem>("Jacobian");

const ITEMS = [
  "Jacobian",
  "Flux Control",
  "Concentration Control",
  "Elasticities",
] as const;

const ITEM_OPTIONS = Object.fromEntries(ITEMS.map((i) => [i, i]));

export type SteadyState3DItem = (typeof ITEMS)[number];

const SteadyState3DPanel = () => {
  const result = useAtomValue(simulationResultAtom);
  const graphSettings = useAtomValue(graphSettingsAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const [item, setItem] = useAtom(steadyState3DItemAtom);

  const handleSettingsChangeFor = (
    setting: keyof (typeof graphSettings)["steadyState3d"],
  ): ((newValue: unknown) => void) => {
    return (newValue) => {
      updateGraphSettings({
        ...graphSettings,
        steadyState3d: { ...graphSettings.steadyState3d, [setting]: newValue },
      });
    };
  };

  const colorSchemeOptions = Object.fromEntries(
    Object.keys(PALETTES).map((name) => [name, name]),
  );

  if (result?.type !== "steadyState") {
    return null;
  }

  return (
    <div className={styles.panel}>
      <Allotment vertical>
        <div className={styles.plotContainer}>
          <div className={styles.steadyState3DPanel}>
            <SelectProperty
              name="Item"
              value={item}
              options={ITEM_OPTIONS}
              onChange={(newValue) => setItem(newValue as typeof item)}
            />

            <ArrayBarChart3D result={result} item={item} />
          </div>
        </div>

        <Allotment.Pane preferredSize={200}>
          <div className={styles.quickActionsContainer}>
            <div className={styles.quickActionsSettings}>
              <PropertyList alignment="leftSmall">
                <BooleanProperty
                  name="Autoscale Z"
                  value={graphSettings.steadyState3d.isAutoScaledZ}
                  onChange={handleSettingsChangeFor("isAutoScaledZ")}
                />
                {!graphSettings.steadyState3d.isAutoScaledZ && (
                  <NumericProperty
                    name="Z Minimum"
                    value={graphSettings.steadyState3d.minZ}
                    onChange={handleSettingsChangeFor("minZ")}
                    validator={(newValue) =>
                      newValue < graphSettings.steadyState3d.maxZ
                    }
                  />
                )}
                {!graphSettings.steadyState3d.isAutoScaledZ && (
                  <NumericProperty
                    name="Z Maximum"
                    value={graphSettings.steadyState3d.maxZ}
                    onChange={handleSettingsChangeFor("maxZ")}
                    validator={(newValue) =>
                      newValue > graphSettings.steadyState3d.minZ
                    }
                  />
                )}
                <SelectProperty
                  name="Color Scheme"
                  value={graphSettings.steadyState3d.colorScheme}
                  options={colorSchemeOptions}
                  onChange={
                    handleSettingsChangeFor("colorScheme") as (
                      newValue: string,
                    ) => void
                  }
                />
              </PropertyList>
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

export default SteadyState3DPanel;
