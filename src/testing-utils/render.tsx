/* eslint-disable react-refresh/only-export-components */

import { useRef } from "react";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { TooltipProvider } from "@/components/Tooltip";
import WorkspaceProvider from "@/app/WorkspaceProvider";

/**
 * Renders then waits for microtask queue to clear.
 * Many of the tests do not work without this :(
 * (the CI runners are so slow, they don't work if we don't
 *  add this to make sure everything loads correctly)
 */
export const renderFlush = async (node: React.ReactNode) => {
  render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const TestApp = ({
  shouldStubActiveFile = true,
  children,
}: {
  shouldStubActiveFile?: boolean;
  children: React.ReactNode;
}) => {
  const didInitialLoadRef = useRef(false);
  return (
    <TooltipProvider>
      <ToastProvider>
        <WorkspaceProvider
          didInitialLoadRef={didInitialLoadRef}
          shouldStubActiveFile={shouldStubActiveFile}
        >
          {children}
        </WorkspaceProvider>
      </ToastProvider>
    </TooltipProvider>
  );
};

/**
 * Same as testing-library's render function, additionally wrapping stores so they don't persist between tests.
 */
export const renderWithinWorkspace = async (
  node: React.ReactNode,
  { shouldStubActiveFile = true }: { shouldStubActiveFile?: boolean } = {},
) => {
  await renderFlush(
    <TestApp shouldStubActiveFile={shouldStubActiveFile}>{node}</TestApp>,
  );
};
