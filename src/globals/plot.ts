import { atom } from "jotai";
import { variableSettingssAtom } from "./model";
import { graphSettingsAtom } from "./graphPresets";
import { independentVariableAtom } from "./settings";

export const defaultXAxisTitleAtom = atom((get) => {
  const independentVariableName = get(independentVariableAtom);
  const variableSettingss = get(variableSettingssAtom);
  if (independentVariableName) {
    return variableSettingss[independentVariableName].displayName;
  } else {
    return "Time";
  }
});

export const xAxisTitleAtom = atom((get) => {
  const graphSettings = get(graphSettingsAtom);
  if (graphSettings.xAxis.title === "") {
    return get(defaultXAxisTitleAtom);
  } else {
    return graphSettings.xAxis.title;
  }
});

export const defaultYAxisTitleAtom = atom("Concentrations");
export const yAxisTitleAtom = atom((get) => {
  const graphSettings = get(graphSettingsAtom);
  if (graphSettings.yAxis.title === "") {
    return get(defaultYAxisTitleAtom);
  } else {
    return graphSettings.yAxis.title;
  }
});
