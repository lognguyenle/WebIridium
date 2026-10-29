import { it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { renderWithinWorkspace } from "@/testing-utils/render";
import CloseProjectButton from "../CloseProjectButton";

afterEach(() => {
  vi.useRealTimers();
});

it("should require confirmation", async () => {
  const close = vi.fn();
  await renderWithinWorkspace(<CloseProjectButton onClose={close} />);
  expect(close).not.toBeCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(close).not.toBeCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(close).toBeCalled();
});

it("should timeout", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"], shouldAdvanceTime: true });

  const close = vi.fn();
  await renderWithinWorkspace(<CloseProjectButton onClose={close} />);
  expect(close).not.toBeCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(close).not.toBeCalled();
  await vi.advanceTimersByTimeAsync(99999);
  await userEvent.click(screen.getByRole("button"));
  expect(close).not.toBeCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(close).not.toBeCalled();
  await userEvent.click(screen.getByRole("button"));
  expect(close).toBeCalled();
});
