import { errorToDisplayString } from "@/features/formatUtils";
import type { Action, ErrorResult, Result } from "@/features/taskPool";

export type WorkerFailMode = "normal" | "always";

let minDelay = 0;
let maxDelay = 0;
let failMode: WorkerFailMode = "normal";

export const setWorkerResponseDelay = (min: number, max?: number) => {
  minDelay = min;
  maxDelay = max ?? min;
};

export const resetWorkerResponseDelay = () => {
  minDelay = 0;
  maxDelay = 0;
};

/**
 * Sets the worker fail mode.
 * @param mode - the fail mode
 * - normal: fail like they would when running in the site
 * - always: always fail
 */
export const setWorkerFailMode = (mode: WorkerFailMode) => {
  failMode = mode;
};

export const resetWorkerFailMode = () => {
  setWorkerFailMode("normal");
};

const getDelay = () => {
  return minDelay + (maxDelay - minDelay) * Math.random();
};

/**
 * Wraps message handlers so they format errors for the worker pool.
 *
 * @param worker - the worker this is handling messages for
 * @param handler - the handler you are wrapping
 *
 * @returns a new handler that properly formats errors for the worker pool.
 */
export const createMockWorkerMessageHandler = (
  worker: MockWorker,
  handler: (action: Action) => unknown,
) => {
  // the type of `e` has to be event or it doesn't typecheck :(
  return (e: Event) => {
    const action = (e as MessageEvent<Action>).data;
    try {
      const result = handler(action);
      if (failMode === "always") {
        worker.port.postMessage({
          id: action.id,
          errorMessage: "mock fail",
        } as ErrorResult);
        return;
      }

      worker.port.postMessage({
        id: action.id,
        data: result,
      } as Result);
    } catch (err) {
      worker.port.postMessage({
        id: action.id,
        errorMessage: errorToDisplayString(err),
      } as ErrorResult);
    }
  };
};

export class MockWorkerPort extends EventTarget {
  worker: MockWorker;

  constructor(worker: MockWorker) {
    super();
    this.worker = worker;
  }

  emitMessageEvent(data: unknown) {
    if (this.worker.terminated) return;
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  postMessage(data: unknown) {
    const delay = getDelay();
    if (delay === 0) {
      this.worker.emitMessageEvent(data);
    } else {
      setTimeout(() => this.worker.emitMessageEvent(data), delay);
    }
  }
}

export class MockWorker extends EventTarget {
  port: MockWorkerPort;
  terminated: boolean;

  constructor() {
    super();
    this.port = new MockWorkerPort(this);
    this.terminated = false;
  }

  emitMessageEvent(data: unknown) {
    if (this.terminated) return;
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  postMessage(data: unknown) {
    this.port.emitMessageEvent(data);
  }

  terminate() {
    this.terminated = true;
  }
}
