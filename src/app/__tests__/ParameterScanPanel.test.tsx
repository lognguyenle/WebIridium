import { describe } from "vitest";
import { renderWithinWorkspace } from "@/testing-utils/render.tsx";
import PlotPanel from "../results/PlotPanel.tsx";
import {
  itShouldDisableWhenStartingSimulation,
  itShouldBeCancellable,
  itShouldDisplayPlot,
  itShouldBeLoadingWhenModelIsLoading,
  ForceModelUpdateButton,
  itShouldShowNoActiveProjectPanel,
} from "./sharedPanelTests.tsx";
import ParameterScanPanel from "../simulation/ParameterScanPanel.tsx";

itShouldShowNoActiveProjectPanel(() => <ParameterScanPanel visible />);

describe("run button", () => {
  const testButtonOptions = {
    buttonText: "Run",
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <ParameterScanPanel visible />
          <PlotPanel />
        </div>,
      );
    },
  };

  itShouldDisableWhenStartingSimulation(testButtonOptions);
  itShouldBeCancellable(testButtonOptions);
  itShouldDisplayPlot(testButtonOptions);
  itShouldBeLoadingWhenModelIsLoading({
    ...testButtonOptions,
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <ParameterScanPanel visible />
          <ForceModelUpdateButton />
          <PlotPanel />
        </div>,
      );
    },
  });

  // TODO: need tests to see if the plot display is correct
  // TODO: need test to see if simple setting updates are working correctly
});
