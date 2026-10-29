import { it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { renderWithinWorkspace } from "@/testing-utils/render";
import GraphSettingsPanel from "../GraphSettingsPanel";

// TODO: add more tests

it("should run close on click", async () => {
  const onClose = vi.fn();

  await renderWithinWorkspace(<GraphSettingsPanel onClose={onClose} />);

  await userEvent.click(screen.getByLabelText("Close"));

  expect(onClose).toHaveBeenCalledOnce();
});
