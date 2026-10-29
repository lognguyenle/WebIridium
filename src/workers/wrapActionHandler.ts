import { errorToDisplayString } from "@/features/formatUtils";
import type { Action, Result, ErrorResult } from "@/features/taskPool";

type MessageHandler = (event: MessageEvent<unknown>) => Promise<void>;

/**
 * Wrap an action handler so it can act as an event handler for `onmessage`
 * Assumes inside a worker context
 */
const wrapActionHandler = <T extends Action>(
  worker: { postMessage: (data: unknown) => void },
  handleAction: (action: T) => Promise<Result>,
): MessageHandler => {
  return async (e) => {
    try {
      const result = await handleAction(e.data as T);
      worker.postMessage(result);
    } catch (err) {
      worker.postMessage({
        id: (e.data as T).id,
        errorMessage: errorToDisplayString(err),
      } satisfies ErrorResult);

      throw err;
    }
  };
};

export default wrapActionHandler;
