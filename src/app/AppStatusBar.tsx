import { useAtomValue } from "jotai";

import styles from "./AppStatusBar.module.css";
import PulseLoader from "@/components/PulseLoader";
import { StatusBar, StatusBarItem } from "@/components/StatusBar";

import CheckIcon from "@/assets/icons/CheckIcon.svg?react";
import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import WarningIcon from "@/assets/icons/WarningIcon.svg?react";

import {
  variablesAtom,
  variableSettingssAtom,
  modelStatusAtom,
} from "@/globals/model";
import { independentVariableAtom } from "@/globals/settings";
import { isSimulatingAtom, simulationResultAtom } from "@/globals/simulation";
import { hasActiveProjectAtom } from "@/globals/project";
import { isSavingAtom } from "@/globals/saving";
import { useEffect, useState } from "react";

const ModelStatusItem = () => {
  const status = useAtomValue(modelStatusAtom);
  const isSimulating = useAtomValue(isSimulatingAtom);

  switch (status.type) {
    case "loading":
      return (
        <StatusBarItem className={styles.itemLoading}>
          <PulseLoader size="4px" spacing="2px" />
          Model Loading
        </StatusBarItem>
      );

    case "success":
      if (isSimulating) {
        return (
          <StatusBarItem className={styles.itemSuccess}>
            <PulseLoader size="4px" spacing="2px" />
            Simulating
          </StatusBarItem>
        );
      } else {
        return (
          <StatusBarItem className={styles.itemSuccess}>
            <CheckIcon />
            Model Loaded
          </StatusBarItem>
        );
      }

    case "error":
      return (
        <>
          <StatusBarItem className={styles.itemFail}>
            <CrossIcon width="1em" height="1em" />
            Model Error
          </StatusBarItem>
        </>
      );
  }
};

// TODO: add unit tests for this
const MissingDataStatusItem = () => {
  const simulatorResult = useAtomValue(simulationResultAtom);
  const variables = useAtomValue(variablesAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const independentVariable = useAtomValue(independentVariableAtom);

  if (!simulatorResult) {
    return null;
  }

  const haveSet = new Set();
  if (simulatorResult?.type === "timeCourse") {
    for (const column of simulatorResult.columns) {
      haveSet.add(column.title);
    }
  } else if (
    simulatorResult?.type === "parameterScan" &&
    simulatorResult.mode === "timeCourse"
  ) {
    for (const scan of simulatorResult.scans) {
      for (const column of scan.columns) {
        haveSet.add(column.title);
      }
    }
  } else if (
    simulatorResult?.type === "parameterScan" &&
    simulatorResult.mode === "steadyState"
  ) {
    haveSet.add(simulatorResult.parameter);
    for (const scan of simulatorResult.scans[0].concentrations) {
      haveSet.add(scan.name);
    }
  }

  const isSteadyState =
    simulatorResult.type === "steadyState" ||
    (simulatorResult.type === "parameterScan" &&
      simulatorResult.mode === "steadyState");
  if (isSteadyState) {
    return null;
  }

  const missingVariables = variables
    .filter((v) => variableSettingss[v.name]?.visible)
    .filter((v) => !haveSet.has(v.name));
  const misingIndependent =
    simulatorResult.type === "timeCourse" && !haveSet.has(independentVariable);
  if (missingVariables.length > 0 || misingIndependent) {
    return (
      <StatusBarItem>
        <WarningIcon className={styles.warningIcon} width="1em" height="1em" />
        Missing data for variables configured to display. Please resimulate.
      </StatusBarItem>
    );
  } else {
    return null;
  }
};

const MAX_DOTS = 3;
const SavingStatusItem = () => {
  const isSaving = useAtomValue(isSavingAtom);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    if (isSaving) {
      const id = setInterval(() => {
        setDots((old) => (old % MAX_DOTS) + 1);
      }, 500);
      return () => clearInterval(id);
    }
  }, [isSaving]);

  if (isSaving) {
    return (
      <StatusBarItem className={styles.savingItem} align="end">
        Saving{".".repeat(dots)}
      </StatusBarItem>
    );
  } else {
    return null;
  }
};

const AppStatusBar = () => {
  const hasActiveProject = useAtomValue(hasActiveProjectAtom);
  return (
    <StatusBar>
      {hasActiveProject && <ModelStatusItem />}
      <MissingDataStatusItem />
      <SavingStatusItem />
    </StatusBar>
  );
};

export default AppStatusBar;
