import type { GraphSettings } from "@/features/savedData";
import type { SimulationResult } from "@/features/simulation/Simulator";
import type { VariableSettings } from "@/globals/settings";
import type { ECBasicOption } from "echarts/types/dist/shared";
import { getColumnsFromResult } from "./getColumnsFromResult";
import { getDefaultParameterScanColor } from "@/features/colors";
import { getParameterScanTitle } from "./getParameterScanTitle";
import { DASH_ARRAYS } from "@/features/lineStyle";

const MAX_TITLES_TO_SHOW = 12;

export const generatePlot3DParameters = (
  result: SimulationResult,
  graphSettings: GraphSettings,
  variableSettingss: Record<string, VariableSettings>,
  timeCourseIndependentVariable: string,
  scanIndependentVariable: string,
): ECBasicOption | undefined => {
  if (result.type === "steadyState") return;

  const [columns, independentVariableName] = getColumnsFromResult(
    result,
    timeCourseIndependentVariable,
    scanIndependentVariable,
  );
  const independentVariableColumn = columns.find(
    (c) => c.variableName === independentVariableName,
  );
  const parameterSettings =
    result.type === "parameterScan"
      ? variableSettingss[result.parameter]
      : null;
  if (!independentVariableColumn) return;

  const series = [];
  const titles = [];

  for (const { variableName, values, parameterValue, scanPercent } of columns) {
    if (variableName === independentVariableName) continue;

    const settings = variableSettingss[variableName];
    if (!settings.visible) continue;
    let finalColor: string = settings.color;
    if (result.type === "parameterScan" && result.mode === "timeCourse") {
      finalColor = getDefaultParameterScanColor(settings.color, scanPercent!);
    }

    const title =
      parameterValue !== undefined
        ? getParameterScanTitle(
            settings.displayName,
            parameterSettings!.displayName,
            parameterValue,
          )
        : settings.displayName;

    series.push({
      name: title,
      data: values.map((v, i) => [
        independentVariableColumn.values[i],
        title,
        v,
      ]),
      type: "line3D",
      lineStyle: {
        width: 4 * settings.width,
        color: finalColor,
        type: DASH_ARRAYS[settings.lineStyle],
      },
      itemStyle: {
        color: finalColor,
        opacity: 0,
      },
    });

    titles.push(title);
  }

  return {
    backgroundColor: graphSettings.backgroundColor,
    title: {
      text: "Transition of substances in chemical reaction",
      left: "center",
      textStyle: {
        fontSize: 20,
        fontWeight: "normal",
      },
    },
    tooltip: {},
    animation: false,
    xAxis3D: {
      name: independentVariableName,
      type: "value",
      nameLocation: "end",
      nameGap: 20,
      nameTextStyle: {
        fontSize: 14,
        color: "#000",
      },
      nameRotate: 0,
      axisPointer: {
        show: false,
      },
      axisLabel: {
        show: true,
        color: "#000",
        fontSize: 12,
      },
    },
    yAxis3D: {
      name: "Variable",
      type: "category",
      data: titles,
      nameLocation: "middle",
      nameGap: 20,
      nameTextStyle: {
        fontSize: 14,
        color: "#000",
      },
      nameRotate: 90,
      axisPointer: {
        show: false,
      },
      axisLabel: {
        show: titles.length <= MAX_TITLES_TO_SHOW,
        interval: 0,
        color: "#000",
        fontSize: 12,
      },
    },
    zAxis3D: {
      name: "Concentrations",
      type: "value",
      nameLocation: "end",
      nameGap: 15,
      nameTextStyle: {
        fontSize: 14,
        color: "#000",
      },
      axisPointer: {
        show: false,
      },
      axisLabel: {
        show: true,
        color: "#000",
        fontSize: 12,
      },
    },
    grid3D: {
      viewControl: {
        projection: "orthogonal",
        distance: 250,
        alpha: 30,
        beta: 40,
        rotateSensitivity: 1,
        zoomSensitivity: 1,
        panSensitivity: 1,
        autoRotate: false,
      },
      environment: "#ffffff",
      axisLine: {
        lineStyle: {
          color: "#333",
        },
      },
      axisLabel: {
        textStyle: {
          color: "#000",
        },
      },
    },
    series: series,
  };
};
