import { useAtomValue } from "jotai";

import DownloadIcon from "@/assets/icons/DownloadIcon.svg?react";

import IconButton from "@/components/IconButton";

import { simulationResultAtom } from "@/globals/simulation";
import { variableSettingssAtom } from "@/globals/model";
import { independentVariableAtom } from "@/globals/settings";
import { metadataAtom } from "@/globals/project";
import { useScanIndependentVariable } from "@/features/simulation/useScanIndependentVariable";
import { generateTableParameters } from "../generateTableParameters";
import { promptDownloadString } from "@/features/download";
import { convertColumnsToCsv } from "@/features/csv";

const DownloadTableButton = () => {
  const result = useAtomValue(simulationResultAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const scanIndependentVariable = useScanIndependentVariable();
  const timeCourseIndependentVariable = useAtomValue(independentVariableAtom);
  const metadata = useAtomValue(metadataAtom);

  const handleClick = () => {
    if (!result) return;

    const { columns } = generateTableParameters(
      result,
      variableSettingss,
      timeCourseIndependentVariable,
      scanIndependentVariable,
    );

    const csv = convertColumnsToCsv(columns);

    promptDownloadString(`Table of ${metadata.name}`, csv, "text/csv");
  };

  return (
    <IconButton label="Download" onClick={handleClick}>
      <DownloadIcon width="1em" height="1em" />
    </IconButton>
  );
};

export default DownloadTableButton;
