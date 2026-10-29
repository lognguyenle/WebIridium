import { it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { renderWithinWorkspace } from "@/testing-utils/render";
import SlidersPanel from "../sliders/SlidersPanel";
import { itShouldShowNoActiveProjectPanel } from "./sharedPanelTests";

// TODO: add more tests

itShouldShowNoActiveProjectPanel(() => <SlidersPanel onClose={vi.fn()} />);

it("should run close on click", async () => {
  const onClose = vi.fn();

  await renderWithinWorkspace(<SlidersPanel onClose={onClose} />);

  await userEvent.click(screen.getByLabelText("Close"));

  expect(onClose).toHaveBeenCalledOnce();
});
