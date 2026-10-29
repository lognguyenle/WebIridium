import { useAtomValue, useSetAtom } from "jotai";

import { useToast } from "@/components/Toast";
import PlayIcon from "@/assets/icons//PlayIcon.svg?react";
import CancellableButton from "@/components/CancellableButton";
import SimulationPanel from "./SimulationPanel";

import {
  cancelSimulationAtom,
  computeSteadyStateAtom,
  isSimulatingAtom,
} from "@/globals/simulation";
import { modelStatusAtom } from "@/globals/model";

export interface SteadyStatePanelProps {
  visible: boolean;
}

export const SteadyStatePanel = ({ visible }: SteadyStatePanelProps) => {
  const { toast } = useToast();
  const isSimulating = useAtomValue(isSimulatingAtom);
  const modelStatus = useAtomValue(modelStatusAtom);
  const computeSteadyState = useSetAtom(computeSteadyStateAtom);
  const cancelSimulation = useSetAtom(cancelSimulationAtom);

  const handleSimulateClick = async () => {
    const result = await computeSteadyState();
    if (result.type === "failure") {
      toast({
        type: "error",
        title: "Steady State Error",
        description: result.message,
      });
    }
  };

  const handleCancelClick = () => {
    cancelSimulation();
  };

  return (
    <SimulationPanel
      title="Compute Steady State"
      visible={visible}
      data-testid="steadyStatePanel"
    >
      <CancellableButton
        icon={<PlayIcon />}
        disabled={modelStatus.type === "loading"}
        isLoading={isSimulating}
        onClick={handleSimulateClick}
        canCancel={isSimulating}
        onCancel={handleCancelClick}
      >
        Compute
      </CancellableButton>
    </SimulationPanel>
  );
};

export default SteadyStatePanel;
