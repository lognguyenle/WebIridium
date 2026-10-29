// TODO: fix having <=1 number of values causing an error
// TODO: make sure your min can't be more than max (and add validators for the rest of the stuff)
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import styles from "./simulation.module.css";

import { useToast } from "@/components/Toast";
import PlayIcon from "@/assets/icons//PlayIcon.svg?react";

import CancellableButton from "@/components/CancellableButton";
import PropertyAccordion from "@/components/property-accordion/PropertyAccordion";
import PropertyAccordionItem from "@/components/property-accordion/PropertyAccordionItem";
import PropertyList from "@/components/property-list/PropertyList";

import BooleanProperty from "@/components/property-list/BooleanProperty";
import NumericProperty from "@/components/property-list/NumericProperty";
import SelectProperty from "@/components/property-list/SelectProperty";
import UncontrolledVariableList from "@/app/simulation/variable-list/UncontrolledVariableList";
import TimeCoursePropertyList from "./TimeCoursePropertyList";
import { ToggleGroupButton, ToggleGroup } from "@/components/input/ToggleGroup";
import SimulationPanel from "./SimulationPanel";
import StringProperty from "@/components/property-list/StringProperty";

import { groupVariablesForSelectComponent } from "@/features/category";
import { getVariableSetDisplayName } from "@/features/simulation/variableNames";

import {
  cancelSimulationAtom,
  isSimulatingAtom,
  runParameterScanAtom,
} from "@/globals/simulation";
import { modelStatusAtom, variablesAtom } from "@/globals/model";
import { variableSettingssAtom } from "@/globals/model";
import {
  parameterScanOptionsAtom,
  type ParameterScanOptions,
} from "@/globals/settings";
import { simulatorAtom } from "@/globals/simulator";

export interface ParameterScanPanelProps {
  visible: boolean;
}

const ParameterScanPanel = ({ visible }: ParameterScanPanelProps) => {
  const { toast } = useToast();

  const variables = useAtomValue(variablesAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const [parameterScanOptions, setParameterScanOptions] = useAtom(
    parameterScanOptionsAtom,
  );
  const isSimulating = useAtomValue(isSimulatingAtom);
  const modelStatus = useAtomValue(modelStatusAtom);
  const simulator = useAtomValue(simulatorAtom);
  const runParameterScan = useSetAtom(runParameterScanAtom);
  const cancelSimulation = useSetAtom(cancelSimulationAtom);

  const handleSimulateClick = async () => {
    const result = await runParameterScan();
    if (result.type === "failure") {
      toast({
        type: "error",
        title: "Parameter Scan Error",
        description: result.message,
      });
    }
  };

  const handleCancelClick = () => {
    cancelSimulation();
  };

  const handleChangeFor = (property: keyof ParameterScanOptions) => {
    return (newValue: unknown) => {
      setParameterScanOptions({
        ...parameterScanOptions,
        [property]: newValue,
      });
    };
  };

  return (
    <SimulationPanel
      title="Parameter Scan"
      visible={visible}
      data-testid="parameterScanPanel"
    >
      <CancellableButton
        icon={<PlayIcon />}
        disabled={modelStatus.type === "loading"}
        isLoading={isSimulating}
        onClick={handleSimulateClick}
        canCancel={isSimulating}
        onCancel={handleCancelClick}
      >
        Run
      </CancellableButton>

      <PropertyAccordion
        defaultOpen={["Simulation", "Varying Parameter", "Variables"]}
      >
        <PropertyAccordionItem title="Simulation">
          <ToggleGroup
            className={styles.parameterScanModeToggleGroup}
            value={parameterScanOptions.mode}
            onValueChange={handleChangeFor("mode")}
          >
            <ToggleGroupButton value="timeCourse">
              Time Course
            </ToggleGroupButton>
            {simulator.capabilities.canRunSteadyState && (
              <ToggleGroupButton value="steadyState">
                Steady State
              </ToggleGroupButton>
            )}
          </ToggleGroup>

          {parameterScanOptions.mode === "timeCourse" && (
            <TimeCoursePropertyList
              parameters={parameterScanOptions.timeCourseParameters}
              onParameterChange={(newParams) =>
                setParameterScanOptions({
                  ...parameterScanOptions,
                  timeCourseParameters: newParams,
                })
              }
            />
          )}
        </PropertyAccordionItem>

        <PropertyAccordionItem title="Varying Parameter">
          <PropertyList alignment="left">
            {parameterScanOptions.varyingParameter && (
              <SelectProperty
                name="Parameter"
                value={parameterScanOptions.varyingParameter}
                onChange={handleChangeFor("varyingParameter")}
                groups={groupVariablesForSelectComponent(
                  variables.filter((v) => v.type === "settable"),
                  variableSettingss,
                  getVariableSetDisplayName,
                )}
              />
            )}

            {!parameterScanOptions.useNumberList && (
              <>
                <NumericProperty
                  name="Min"
                  value={parameterScanOptions.min}
                  onChange={handleChangeFor("min")}
                />
                <NumericProperty
                  name="Max"
                  value={parameterScanOptions.max}
                  onChange={handleChangeFor("max")}
                />
                <NumericProperty
                  name="Number of Values"
                  value={parameterScanOptions.numberOfValues}
                  onChange={handleChangeFor("numberOfValues")}
                />
                <BooleanProperty
                  asideMode
                  name="Use logarithmic distribution"
                  value={parameterScanOptions.useLogarithmicDistribution}
                  onChange={handleChangeFor("useLogarithmicDistribution")}
                />
              </>
            )}

            {parameterScanOptions.useNumberList && (
              <>
                <StringProperty
                  name="Numbers (separate by spaces)"
                  value={parameterScanOptions.numberList}
                  onChange={handleChangeFor("numberList")}
                  longMode
                />
              </>
            )}

            <BooleanProperty
              asideMode
              name="Use number list"
              value={parameterScanOptions.useNumberList}
              onChange={handleChangeFor("useNumberList")}
            />
          </PropertyList>
        </PropertyAccordionItem>

        <PropertyAccordionItem title="Variables">
          <UncontrolledVariableList />
        </PropertyAccordionItem>
      </PropertyAccordion>
    </SimulationPanel>
  );
};

export default ParameterScanPanel;
