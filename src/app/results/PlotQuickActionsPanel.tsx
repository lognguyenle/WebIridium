import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";

import styles from "./results.module.css";
import buttonStyles from "@/components/Button.module.css";

import PropertyList from "@/components/property-list/PropertyList";
import BooleanProperty from "@/components/property-list/BooleanProperty";
import NumericProperty from "@/components/property-list/NumericProperty";

import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import PencilIcon from "@/assets/icons/PencilIcon.svg?react";
import LayersIcon from "@/assets/icons/LayersIcon.svg?react";

import {
  graphSettingsAtom,
  updateGraphSettingsAtom,
} from "@/globals/graphPresets";
import { type GraphSettings } from "@/features/savedData";
import { currentVeryRightPanelAtom } from "@/globals/layout";

const PlotQuickActionsPanel = () => {
  const graphSettings = useAtomValue(graphSettingsAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);

  const [currentVeryRightPanel, setCurrentVeryRightPanel] = useAtom(
    currentVeryRightPanelAtom,
  );

  const isPlotSettingsOpen = currentVeryRightPanel === "Plot Settings";
  const isOverlaysOpen = currentVeryRightPanel === "Overlays";

  const handleChangeFor = (
    setting: keyof GraphSettings,
  ): ((newValue: unknown) => void) => {
    return (newValue) => {
      updateGraphSettings({ ...graphSettings, [setting]: newValue });
    };
  };

  return (
    <div className={styles.quickActionsContainer}>
      <div className={styles.quickActionsButtons}>
        <button
          className={clsx(buttonStyles.default, styles.quickActionsButton)}
          onClick={() =>
            setCurrentVeryRightPanel(
              isPlotSettingsOpen ? null : "Plot Settings",
            )
          }
        >
          {isPlotSettingsOpen ? (
            <CrossIcon width="1em" height="1em" />
          ) : (
            <PencilIcon width="1em" height="1em" />
          )}
          {isPlotSettingsOpen ? "Close Settings" : "Edit Graph"}
        </button>

        <button
          className={clsx(buttonStyles.default, styles.quickActionsButton)}
          onClick={() =>
            setCurrentVeryRightPanel(isOverlaysOpen ? null : "Overlays")
          }
        >
          {isOverlaysOpen ? (
            <CrossIcon width="1em" height="1em" />
          ) : (
            <LayersIcon width="1em" height="1em" />
          )}
          {isOverlaysOpen ? "Close Overlay Data" : "Add Overlay Data"}
        </button>
      </div>

      <div className={styles.quickActionsSettings}>
        <PropertyList alignment="leftSmall">
          <BooleanProperty
            name="Show Legend"
            value={graphSettings.legend.visible}
            onChange={(visible) =>
              handleChangeFor("legend")({ ...graphSettings.legend, visible })
            }
          />
          <BooleanProperty
            name="Autoscale X"
            value={graphSettings.isAutoscaledX}
            onChange={handleChangeFor("isAutoscaledX")}
          />
          {!graphSettings.isAutoscaledX && (
            <NumericProperty
              name="X Minimum"
              value={graphSettings.minX}
              onChange={handleChangeFor("minX")}
              validator={(newValue) => newValue < graphSettings.maxX}
            />
          )}
          {!graphSettings.isAutoscaledX && (
            <NumericProperty
              name="X Maximum"
              value={graphSettings.maxX}
              onChange={handleChangeFor("maxX")}
              validator={(newValue) => newValue > graphSettings.minX}
            />
          )}

          <BooleanProperty
            name="Autoscale Y"
            value={graphSettings.isAutoscaledY}
            onChange={handleChangeFor("isAutoscaledY")}
          />
          {!graphSettings.isAutoscaledY && (
            <NumericProperty
              name="Y Minimum"
              value={graphSettings.minY}
              onChange={handleChangeFor("minY")}
              validator={(newValue) => newValue < graphSettings.maxY}
            />
          )}
          {!graphSettings.isAutoscaledY && (
            <NumericProperty
              name="Y Maximum"
              value={graphSettings.maxY}
              onChange={handleChangeFor("maxY")}
              validator={(newValue) => newValue > graphSettings.minY}
            />
          )}
        </PropertyList>
      </div>
    </div>
  );
};

export default PlotQuickActionsPanel;
