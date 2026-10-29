import { useAtom, useAtomValue } from "jotai";
import styles from "./IndependentVariableSelector.module.css";
import { variableSettingssAtom } from "@/globals/model";
import { independentVariableAtom } from "@/globals/settings";
import { variablesAtom } from "@/globals/model";
import { groupVariablesForSelectComponent } from "@/features/category";
import Select from "@/components/input/Select";

const INDEPENDENT_VARIABLE_CATEGORIES = new Set(["Time", "Floating Species"]);

const IndependentVariableSelector = () => {
  const [indepedentVariable, setIndependentVariable] = useAtom(
    independentVariableAtom,
  );
  const variables = useAtomValue(variablesAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const filteredVariables = variables.filter((v) =>
    INDEPENDENT_VARIABLE_CATEGORIES.has(v.category),
  );

  return (
    <Select
      name="independent-variable"
      value={indepedentVariable ?? "???"}
      groups={groupVariablesForSelectComponent(
        filteredVariables,
        variableSettingss,
      )}
      onChange={(name) => setIndependentVariable(name)}
      className={styles.select}
      aria-label="Independent Variable Value" // TODO: THIS IS A HORIBBLE NAME, BUT IT CONFLICTS WITH THE ACCORDION (SEE THE ExamplesPanel.test.tsx)
    />
  );
};

export default IndependentVariableSelector;
