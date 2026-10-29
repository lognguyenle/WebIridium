import { it, expect, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithinWorkspace } from "@/testing-utils/render";
import {
  resetWorkerResponseDelay,
  setWorkerResponseDelay,
} from "@/testing-utils/mockWorker";

import AppStatusBar from "../AppStatusBar";
import TimeCoursePanel from "../simulation/TimeCoursePanel";

afterEach(() => {
  resetWorkerResponseDelay();
});

it.skip("should say Simulating when a simulation is being ran", async () => {
  await renderWithinWorkspace(
    <>
      <AppStatusBar />
      <TimeCoursePanel visible />
    </>,
  );

  expect(screen.queryByText("Simulating")).not.toBeInTheDocument();

  setWorkerResponseDelay(1000);

  await userEvent.click(screen.getByText("Simulate"));

  expect(screen.getByText("Simulating")).toBeInTheDocument();
});
