import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";

import { timeCourseParametersAtom } from "@/globals/settings";

import { useToast } from "@/components/Toast";
import CancellableButton from "@/components/CancellableButton";
import PlayIcon from "@/assets/icons//PlayIcon.svg?react";

import PropertyAccordion from "@/components/property-accordion/PropertyAccordion";
import PropertyAccordionItem from "@/components/property-accordion/PropertyAccordionItem";

import UncontrolledVariableList from "@/app/simulation/variable-list/UncontrolledVariableList";
import IndependentVariableSelector from "@/app/simulation/IndependentVariableSelector";
import TimeCoursePropertyList from "./TimeCoursePropertyList";
import SimulationPanel from "./SimulationPanel";

import {
  simulateTimeCourseAtom,
  cancelSimulationAtom,
  isSimulatingAtom,
} from "@/globals/simulation";
import { modelStatusAtom } from "@/globals/model";
import BooleanProperty from "@/components/property-list/BooleanProperty";

export interface TimeCoursePanelProps {
  visible: boolean;
}

export const TimeCoursePanel = ({ visible }: TimeCoursePanelProps) => {
  const { toast } = useToast();
  const isSimulating = useAtomValue(isSimulatingAtom);
  const modelStatus = useAtomValue(modelStatusAtom);
  const simulateTimeCourse = useSetAtom(simulateTimeCourseAtom);
  const cancelSimulation = useSetAtom(cancelSimulationAtom);
  const [timeCourseParameters, setTimeCourseParameters] = useAtom(
    timeCourseParametersAtom,
  );

  const [resetInitialConditions, setResetInitialConditions] = useState(true);

  const handleSimulateClick = async () => {
    const result = await simulateTimeCourse({ resetInitialConditions });
    if (result.type === "failure") {
      toast({
        type: "error",
        title: "Time Course Error",
        description: result.message,
      });
    }
  };

  const handleCancelClick = () => {
    cancelSimulation();
  };

  return (
    <SimulationPanel
      title="Time Course Simulation"
      visible={visible}
      data-testid="timeCoursePanel"
    >
      <CancellableButton
        icon={<PlayIcon />}
        disabled={modelStatus.type === "loading"}
        isLoading={isSimulating}
        onClick={handleSimulateClick}
        canCancel={isSimulating}
        onCancel={handleCancelClick}
      >
        Simulate
      </CancellableButton>

      <BooleanProperty
        name="Reset initial conditions"
        value={resetInitialConditions}
        onChange={setResetInitialConditions}
        asideMode
      />

      <PropertyAccordion
        defaultOpen={[
          "Simulation Parameters",
          "Independent Variable",
          "Dependent Variables",
        ]}
      >
        <PropertyAccordionItem title="Simulation Parameters">
          <TimeCoursePropertyList
            parameters={timeCourseParameters}
            onParameterChange={setTimeCourseParameters}
          />
        </PropertyAccordionItem>

        <PropertyAccordionItem title="Independent Variable">
          <IndependentVariableSelector />
        </PropertyAccordionItem>

        <PropertyAccordionItem title="Dependent Variables">
          <UncontrolledVariableList />
        </PropertyAccordionItem>
      </PropertyAccordion>
    </SimulationPanel>
  );
};

export default TimeCoursePanel;
