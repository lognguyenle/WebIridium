import { describe } from "vitest";
import { renderWithinWorkspace } from "@/testing-utils/render.tsx";
import TimeCoursePanel from "../simulation/TimeCoursePanel.tsx";
import PlotPanel from "../results/PlotPanel.tsx";
import {
  itShouldDisableWhenStartingSimulation,
  itShouldBeCancellable,
  itShouldDisplayPlot,
  itShouldDisplayToasts,
  itShouldBeLoadingWhenModelIsLoading,
  ForceModelUpdateButton,
  itShouldShowNoActiveProjectPanel,
} from "./sharedPanelTests.tsx";

itShouldShowNoActiveProjectPanel(() => <TimeCoursePanel visible />);

describe("simulation button", () => {
  const testButtonOptions = {
    buttonText: "Simulate",
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <TimeCoursePanel visible />
          <PlotPanel />
        </div>,
      );
    },
  };

  itShouldDisableWhenStartingSimulation(testButtonOptions);
  itShouldBeCancellable(testButtonOptions);
  itShouldDisplayPlot(testButtonOptions);
  itShouldDisplayToasts(testButtonOptions);
  itShouldBeLoadingWhenModelIsLoading({
    ...testButtonOptions,
    render: async () => {
      await renderWithinWorkspace(
        <div>
          <TimeCoursePanel visible />
          <ForceModelUpdateButton />
          <PlotPanel />
        </div>,
      );
    },
  });

  // TODO: need tests to see if the plot display is correct.
  // TODO: need test to see if simple setting updates are working correctly
  // TODO: add integration test where time course cancel should not be available when parameter scan sim is running
});
