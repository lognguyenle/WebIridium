import { test, expect, afterEach } from "vitest";
import { waitFor, screen, within } from "@testing-library/react";
import { renderFlush, renderWithinWorkspace } from "@/testing-utils/render";
import userEvent from "@testing-library/user-event";

import {
  setWorkerResponseDelay,
  resetWorkerResponseDelay,
} from "@/testing-utils/mockWorker";

import TimeCoursePanel from "../simulation/TimeCoursePanel";
import SteadyStatePanel from "../simulation/SteadyStatePanel";
import ParameterScanPanel from "../simulation/ParameterScanPanel";
import App from "@/app/App";

afterEach(() => {
  resetWorkerResponseDelay();
});

test("panels should all be cancellable when a simulation is running", async () => {
  await renderWithinWorkspace(
    <div>
      <TimeCoursePanel visible />
      <SteadyStatePanel visible />
      <ParameterScanPanel visible />
    </div>,
  );

  const timeCoursePanel = screen.getByTestId("timeCoursePanel");
  const steadyStatePanel = screen.getByTestId("steadyStatePanel");
  const parameterScanPanel = screen.getByTestId("parameterScanPanel");

  const simulateTimeCourseButton =
    within(timeCoursePanel).getByText("Simulate");
  const computeSteadyStateButton =
    within(steadyStatePanel).getByText("Compute");
  const runParameterScanButton = within(parameterScanPanel).getByText("Run");

  await waitFor(() => {
    expect(simulateTimeCourseButton).toBeEnabled();
  });

  setWorkerResponseDelay(1000);

  await userEvent.click(simulateTimeCourseButton);

  await waitFor(() => {
    expect(simulateTimeCourseButton).toBeDisabled();
  });
  await waitFor(() => {
    expect(computeSteadyStateButton).toBeDisabled();
  });
  await waitFor(() => {
    expect(runParameterScanButton).toBeDisabled();
  });

  const cancelButton = within(timeCoursePanel).getByLabelText("Cancel");
  expect(cancelButton).toBeInTheDocument();
  expect(within(steadyStatePanel).getByLabelText("Cancel")).toBeInTheDocument();
  expect(
    within(parameterScanPanel).getByLabelText("Cancel"),
  ).toBeInTheDocument();

  await userEvent.click(cancelButton);

  await waitFor(() => {
    expect(simulateTimeCourseButton).toBeEnabled();
  });
  expect(computeSteadyStateButton).toBeEnabled();
  expect(runParameterScanButton).toBeEnabled();
});

test.skip("clicking sliders button should toggle sliders panel", async () => {
  await renderFlush(<App />);

  expect(screen.queryByTestId("sliders-panel")).not.toBeInTheDocument();

  const sliderButton = within(
    screen.getByTestId("timeCoursePanel"),
  ).getByLabelText("Sliders");
  await userEvent.click(sliderButton);

  expect(screen.getByTestId("sliders-panel")).toBeInTheDocument();
});
