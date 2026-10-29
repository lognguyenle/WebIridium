import type { SimulationResult } from "@/features/simulation/Simulator";
import { atom } from "jotai";

export interface HistoryRecord {
  modelName: string;
  code: string;
  simulationResult: SimulationResult;
  unixTimestampMs: number;
}

const MIN_MILLISECONDS_BETWEEN_HISTORY_ITEMS = 7_500;
const MAX_HISTORY_LENGTH = 24;

const _historyAtom = atom<HistoryRecord[]>([]);

/**
 * Tries to add a new item to history, but only if enough time has passed
 * since the last history item was added (this is so you don't get a bunch
 * of history items from moving sliders or spamming simulate).
 *
 * @returns `true` if added to history, `false` if not.
 */
export const tryAddToHistoryAtom = atom(
  null,
  (
    get,
    set,
    {
      modelName,
      code,
      result,
    }: { modelName: string; code: string; result: SimulationResult },
  ) => {
    const history = get(_historyAtom);

    const lastRecord: HistoryRecord | undefined = history[history.length - 1];
    const record: HistoryRecord = {
      modelName,
      code,
      simulationResult: result,
      unixTimestampMs: Date.now(),
    };

    if (
      !lastRecord ||
      lastRecord.simulationResult.type !== result.type ||
      (result.type === "parameterScan" &&
        lastRecord.simulationResult.type === "parameterScan" &&
        lastRecord.simulationResult.mode !== result.mode) ||
      record.unixTimestampMs - lastRecord.unixTimestampMs >=
        MIN_MILLISECONDS_BETWEEN_HISTORY_ITEMS
    ) {
      const remainingHistory =
        history.length > MAX_HISTORY_LENGTH ? history.slice(1) : history;
      set(_historyAtom, [...remainingHistory, record]);

      return true;
    } else if (
      record.unixTimestampMs - lastRecord.unixTimestampMs <
      MIN_MILLISECONDS_BETWEEN_HISTORY_ITEMS
    ) {
      // overwrite the latest record
      set(_historyAtom, [...history.slice(0, history.length - 1), record]);

      return true;
    }

    return false;
  },
);

export const updateAllHistoryAtom = atom(
  null,
  (_get, set, history: HistoryRecord[]) => {
    set(_historyAtom, history);
  },
);

export const historyAtom = atom((get) => get(_historyAtom));
