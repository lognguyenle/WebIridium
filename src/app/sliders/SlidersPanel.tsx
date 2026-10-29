import { useCallback, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import styles from "./SlidersPanel.module.css";
import buttonStyles from "@/components/Button.module.css";

import { type SettableVariable } from "@/features/simulation/Simulator";
import { groupVariables, type Category } from "@/features/category";
import { hasDisplayName } from "@/features/simulation/variableNames";

import { variablesAtom, variableSettingssAtom } from "@/globals/model";
import {
  getInitialSliderState,
  updateSliderAndSimulateAtom,
  variableSliderStatesAtom,
  type VariableSliderState,
} from "@/globals/slider";
import { parameterScanOptionsAtom } from "@/globals/settings";
import { simulationResultAtom } from "@/globals/simulation";
import { hasActiveProjectAtom } from "@/globals/project";

import VariableSlider from "./VariableSlider";
import CopyToModelButton from "./CopyToModelButton";
import SearchBox from "@/components/input/SearchBox";

import EyeIcon from "@/assets/icons/EyeIcon.svg?react";
import ClosedEyeIcon from "@/assets/icons/ClosedEyeIcon.svg?react";
import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import IconButton from "@/components/IconButton";
import Select from "@/components/input/Select";
import NoActiveProjectPanel from "../NoActiveProjectPanel";

const SLIDER_CATEGORY_ORDER: Category[] = [
  "Parameters",
  "ODEs",
  "Floating Species",
  "Boundary Species",
];

export interface SlidersPanelProps {
  onClose: () => void;
}

const SlidersPanel = ({ onClose }: SlidersPanelProps) => {
  const variables = useAtomValue(variablesAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const [variableSliderStates, setVariableSliderStates] = useAtom(
    variableSliderStatesAtom,
  );
  const updateSliderAndSimulate = useSetAtom(updateSliderAndSimulateAtom);
  const parameterScanOptions = useAtomValue(parameterScanOptionsAtom);
  const simulationResult = useAtomValue(simulationResultAtom);
  const hasActiveProject = useAtomValue(hasActiveProjectAtom);

  const [searchTerm, setSearchTerm] = useState("");
  const [showingInactive, setShowingInactive] = useState(true);

  // 'all' means show all variables
  // 'displayNamed' means only show those with a display name
  const [filterType, setFilterType] = useState<"all" | "displayNamed">("all");

  const filteredVariables = variables
    .filter((v) => showingInactive || variableSliderStates[v.name])
    .filter((v) => v.type === "settable")
    .filter(
      (v) =>
        variableSettingss[v.name].displayName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        v.category.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .filter(
      (v) =>
        filterType !== "displayNamed" ||
        hasDisplayName(v, variableSettingss[v.name]),
    );

  const filteredGroups = groupVariables(
    filteredVariables,
    SLIDER_CATEGORY_ORDER,
  );

  const handleValueChange = useCallback(
    (variable: SettableVariable, newValue: number) => {
      updateSliderAndSimulate({ id: variable.name, value: newValue });
    },
    [updateSliderAndSimulate],
  );

  const handleToggle = useCallback(
    (variable: SettableVariable, on: boolean) => {
      setVariableSliderStates((old) => {
        if (on) {
          return {
            ...old,
            [variable.name]: getInitialSliderState(variable),
          };
        } else {
          const { [variable.name]: _, ...rest } = old;
          return rest;
        }
      });
    },
    [setVariableSliderStates],
  );

  const handleStateChange = useCallback(
    (variable: SettableVariable, newState: VariableSliderState) => {
      setVariableSliderStates((old) => ({
        ...old,
        [variable.name]: newState,
      }));
    },
    [setVariableSliderStates],
  );

  if (!hasActiveProject) {
    return <NoActiveProjectPanel />;
  }

  return (
    <div className={styles.panel} data-testid="sliders-panel">
      <div className={styles.topbar}>
        <Select
          name="variableFilter"
          value={filterType}
          options={{ All: "all", "Has Display Name": "displayNamed" }}
          onChange={setFilterType as (newValue: string) => void}
        />

        <SearchBox
          className={styles.searchBox}
          name="slider-variable-search"
          placeholder="Variable Name"
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <CopyToModelButton />

        <button
          className={buttonStyles.default}
          onClick={() => setShowingInactive(!showingInactive)}
        >
          {showingInactive ? (
            <ClosedEyeIcon width="1em" height="1em" />
          ) : (
            <EyeIcon width="1em" height="1em" />
          )}
          {showingInactive ? "Hide Inactive" : "Show Inactive"}
        </button>

        <IconButton label="Close" onClick={onClose}>
          <CrossIcon width="1em" height="1em" aria-hidden />
        </IconButton>
      </div>

      <div className={styles.sliders}>
        {filteredVariables.length === 0 ? (
          <p className={styles.noVariables}>No Variables</p>
        ) : (
          filteredGroups.map(([group, vars]) => {
            const allActive = vars.every((v) => variableSliderStates[v.name]);

            const handleGroupToggle = (on: boolean) => {
              for (const v of vars) {
                if (!on || !variableSliderStates[v.name]) {
                  handleToggle(v, on);
                }
              }
            };

            return (
              <div key={group} className={styles.group}>
                <h3 className={styles.groupTitle}>
                  {group}
                  {searchTerm.length === 0 && (
                    <button
                      className={buttonStyles.default}
                      onClick={() => handleGroupToggle(!allActive)}
                    >
                      {allActive ? <>Deactivate All</> : <>Activate All</>}
                    </button>
                  )}
                </h3>
                {vars.map((v) => (
                  <VariableSlider
                    key={v.name}
                    variable={v}
                    settings={variableSettingss[v.name]}
                    sliderState={variableSliderStates[v.name]}
                    disabled={
                      simulationResult?.type === "parameterScan" &&
                      parameterScanOptions.varyingParameter === v.name
                    }
                    onToggle={handleToggle}
                    onValueChange={handleValueChange}
                    onStateChange={handleStateChange}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SlidersPanel;
