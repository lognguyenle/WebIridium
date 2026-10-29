import { useAtomValue } from "jotai";
import * as echarts from "echarts/core";

import DownloadIcon from "@/assets/icons/DownloadIcon.svg?react";

import IconButton from "@/components/IconButton";
import {
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";
import { useToast } from "@/components/Toast";

import { simulationResultAtom } from "@/globals/simulation";
import { datasetsAtom } from "@/globals/overlays";
import { variableSettingssAtom } from "@/globals/model";
import { graphSettingsAtom } from "@/globals/graphPresets";
import { paletteAtom, independentVariableAtom } from "@/globals/settings";
import { useScanIndependentVariable } from "@/features/simulation/useScanIndependentVariable";
import { xAxisTitleAtom, yAxisTitleAtom } from "@/globals/plot";
import { metadataAtom } from "@/globals/project";
import { generatePlotParameters } from "../generatePlotParameters";
import { promptDownloadString, promptDownloadUrl } from "@/features/download";

const WIDTH = 800;
const HEIGHT = 800;

const DownloadPlotButton = () => {
  const result = useAtomValue(simulationResultAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const palette = useAtomValue(paletteAtom);
  const scanIndependentVariable = useScanIndependentVariable();
  const timeCourseIndependentVariable = useAtomValue(independentVariableAtom);
  const graphSettings = useAtomValue(graphSettingsAtom);
  const metadata = useAtomValue(metadataAtom);
  const xAxisTitle = useAtomValue(xAxisTitleAtom);
  const yAxisTitle = useAtomValue(yAxisTitleAtom);
  const datasets = useAtomValue(datasetsAtom);

  const { toast } = useToast();

  const downloadName = `Plot of ${metadata.name}`;

  const getPlotOptions = () => {
    if (!result) return;

    const { plotOptions } = generatePlotParameters(
      result,
      {
        ...graphSettings,
        legend: {
          ...graphSettings.legend,
          isFloating: false,
        },
      },
      variableSettingss,
      timeCourseIndependentVariable,
      scanIndependentVariable,
      palette,
      xAxisTitle,
      yAxisTitle,
      datasets,
    );

    return plotOptions;
  };

  const handlePngDownload = () => {
    const plotOptions = getPlotOptions();
    if (!plotOptions) return;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const chart = echarts.init(canvas, null, {
      renderer: "canvas",
    });
    chart.setOption(plotOptions);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      promptDownloadUrl(downloadName, url);
      URL.revokeObjectURL(url);
    });
  };

  const handleSvgDownload = () => {
    const plotOptions = getPlotOptions();
    if (!plotOptions) return;

    const container = document.createElement("div");

    const chart = echarts.init(container, null, {
      renderer: "svg",
      width: WIDTH,
      height: HEIGHT,
    });
    chart.setOption(plotOptions);

    const svg = container.querySelector("svg");
    if (!svg) {
      toast({
        type: "error",
        title: "Download failed",
        description: "Failed to generate SVG",
      });
      return;
    }

    promptDownloadString(downloadName, svg.outerHTML, "image/svg+xml");
  };

  const handlePdfDownload = async () => {
    const plotOptions = getPlotOptions();
    if (!plotOptions) return;

    // lazy import so it doesn't get downloaded at start
    const { jsPDF } = await import("jspdf");

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const chart = echarts.init(canvas, null, {
      renderer: "canvas",
    });
    chart.setOption(plotOptions);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [WIDTH, HEIGHT],
    });
    pdf.addImage(canvas, "png", 0, 0, WIDTH, HEIGHT);
    pdf.save(`${downloadName}.pdf`);
  };

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger>
        <IconButton label="Download">
          <DownloadIcon width="1em" height="1em" />
        </IconButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem name="Download as PNG" onSelect={handlePngDownload} />
        <DropdownMenuItem name="Download as SVG" onSelect={handleSvgDownload} />
        <DropdownMenuItem name="Download as PDF" onSelect={handlePdfDownload} />
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};

export default DownloadPlotButton;
