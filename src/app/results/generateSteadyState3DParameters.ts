import type { GraphSettings } from "@/features/savedData";
import type { SimulationResult } from "@/features/simulation/Simulator";
import type { ECBasicOption } from "echarts/types/dist/shared";
import type { SteadyState3DItem } from "./SteadyState3DPanel";
import { getPaletteGradient } from "@/features/colors";

const AXES: { [name: string]: { x: string; y: string; z: string } } = {
  Jacobian: { x: "X", y: "Y", z: "Z" },
  "Flux Control": { x: "Reaction", y: "Flux", z: "Coefficient" },
  "Concentration Control": { x: "Reaction", y: "Species", z: "Coefficient" },
  Elasticities: { x: "Species", y: "Reaction", z: "Elasticity" },
};

const MAX_DECIMALS = 6;

const formatWithMaxDecimals = (n: number, maxDecimals: number): string => {
  return (Math.floor(n * 10 ** maxDecimals) / 10 ** maxDecimals).toString();
};

export const generateSteadyState3DParameters = (
  result: SimulationResult,
  graphSettings: GraphSettings,
  item: SteadyState3DItem,
): ECBasicOption | undefined => {
  if (result?.type !== "steadyState") return;

  // prettier-ignore
  const data =
        item === "Jacobian" ? result.jacobian :
        item === "Flux Control" ? result.fluxControl :
        item === "Concentration Control" ? result.concentrationControl :
        result.elasticities;

  const name = item;
  const { x, y, z } = AXES[item];

  const allValues = data.values.flat();
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  const min = graphSettings.steadyState3d.isAutoScaledZ
    ? dataMin
    : (graphSettings.steadyState3d.minZ ?? dataMin);
  const max = graphSettings.steadyState3d.isAutoScaledZ
    ? dataMax
    : (graphSettings.steadyState3d.maxZ ?? dataMax);

  const colorGradient = getPaletteGradient(
    graphSettings.steadyState3d.colorScheme,
  );

  return {
    backgroundColor: graphSettings.backgroundColor,
    title: {
      text: name,
      left: "center",
      textStyle: {
        fontSize: 20,
        fontWeight: "normal",
      },
    },
    animation: false,
    xAxis3D: {
      name: x,
      type: "category",
      data: data.columns,
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
      name: y,
      type: "category",
      data: data.rows,
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
        show: true,
        color: "#000",
        fontSize: 12,
      },
    },
    zAxis3D: {
      name: z,
      type: "value",
      min: min,
      max: max,
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
    tooltip: {
      formatter: (params: {
        seriesName: string;
        value: [number, number, number];
      }) =>
        `(${data.columns[params.value[0]]}, ${data.rows[params.value[1]]}): ${formatWithMaxDecimals(params.value[2], MAX_DECIMALS)}`,
    },
    visualMap: {
      min,
      max,
      show: false,
      inRange: {
        color: colorGradient,
      },
    },
    grid3D: {
      boxWidth: 80,
      boxDepth: 80,
      viewControl: {
        distance: 250,
        alpha: 30,
        beta: 40,
        rotateSensitivity: 1,
        zoomSensitivity: 1,
        panSensitivity: 1,
        autoRotate: false,
      },
      environment: "#ffffff",
      light: {
        main: {
          intensity: 1.2,
          shadow: false,
        },
        ambient: {
          intensity: 0.3,
        },
      },
    },
    series: [
      {
        type: "bar3D",
        shading: "lambert",
        data: data.values.flatMap((row, y) =>
          row.map((value, x) => [x, y, value]),
        ),
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            color: "#080",
          },
        },
      },
    ],
  };
};
