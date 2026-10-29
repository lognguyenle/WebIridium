import { describe } from "vitest";
import { renderWithinWorkspace } from "@/testing-utils/render.tsx";
import SteadyStatePanel from "../simulation/SteadyStatePanel.tsx";
import PlotPanel from "../results/PlotPanel.tsx";
import {
  itShouldDisableWhenStartingSimulation,
  itShouldBeCancellable,
  itShouldDisplayToasts,
  itShouldBeLoadingWhenModelIsLoading,
  ForceModelUpdateButton,
  itShouldShowNoActiveProjectPanel,
} from "./sharedPanelTests.tsx";

itShouldShowNoActiveProjectPanel(() => <SteadyStatePanel visible />);

describe("compute button", () => {
  const testButtonOptions = {
    buttonText: "Compute",
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <SteadyStatePanel visible />
          <PlotPanel />
        </div>,
      );
    },
  };

  itShouldDisableWhenStartingSimulation(testButtonOptions);
  itShouldBeCancellable(testButtonOptions);
  itShouldDisplayToasts(testButtonOptions);
  itShouldBeLoadingWhenModelIsLoading({
    ...testButtonOptions,
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <SteadyStatePanel visible />
          <ForceModelUpdateButton />
          <PlotPanel />
        </div>,
      );
    },
  });

  // TODO: need tests to see if the plot display is correct.
  // TODO: need test to see if simple setting updates are working correctly
});
