import { memo } from "react";
import { atom, useAtom, useAtomValue } from "jotai";

import styles from "./visuals.module.css";

import { useScanIndependentVariable } from "@/features/simulation/useScanIndependentVariable";
import type { SimulationResult } from "@/features/simulation/Simulator";
import { variableSettingssAtom } from "@/globals/model";
import { independentVariableAtom } from "@/globals/settings";
import { generateTableParameters } from "../generateTableParameters";

import DataTable from "@/components/DataTable";
import NumericSliderProperty from "@/components/property-list/NumericSliderProperty";

// extract it so it persists
const decimalPlacesAtom = atom(2);

export interface ArrayTableProps {
  result: SimulationResult;
}

const ArrayTable = memo(({ result }: ArrayTableProps) => {
  const timeCourseIndependentVariable = useAtomValue(independentVariableAtom);
  const scanIndepedentVariable = useScanIndependentVariable();
  const variableSettingss = useAtomValue(variableSettingssAtom);

  const [decimalPlaces, setDecimalPlaces] = useAtom(decimalPlacesAtom);

  const { columns } = generateTableParameters(
    result,
    variableSettingss,
    timeCourseIndependentVariable,
    scanIndepedentVariable,
  );

  return (
    <div className={styles.arrayTable}>
      <NumericSliderProperty
        name="Decimal Places"
        value={decimalPlaces}
        onChange={setDecimalPlaces}
        min={0}
        max={100}
        step={1}
      />
      <DataTable
        columns={columns}
        decimalPlaces={decimalPlaces}
        firstColumnIsIndependent
      />
    </div>
  );
});

export default ArrayTable;
