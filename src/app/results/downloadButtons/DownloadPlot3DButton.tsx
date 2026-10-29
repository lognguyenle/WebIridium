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

import { simulationResultAtom } from "@/globals/simulation";
import { useScanIndependentVariable } from "@/features/simulation/useScanIndependentVariable";
import { promptDownloadUrl } from "@/features/download";
import { generatePlot3DParameters } from "../generatePlot3DParameters";
import { variableSettingssAtom } from "@/globals/model";
import { independentVariableAtom } from "@/globals/settings";
import { metadataAtom } from "@/globals/project";
import { graphSettingsAtom } from "@/globals/graphPresets";

const WIDTH = 800;
const HEIGHT = 800;

const DownloadPlot3DButton = () => {
  const result = useAtomValue(simulationResultAtom);
  const variableSettingss = useAtomValue(variableSettingssAtom);
  const scanIndependentVariable = useScanIndependentVariable();
  const timeCourseIndependentVariable = useAtomValue(independentVariableAtom);
  const metadata = useAtomValue(metadataAtom);
  const graphSettings = useAtomValue(graphSettingsAtom);

  const downloadName = `3D Plot of ${metadata.name}`;

  const handlePngDownload = () => {
    if (!result || !timeCourseIndependentVariable) return;

    const plotOptions = generatePlot3DParameters(
      result,
      graphSettings,
      variableSettingss,
      timeCourseIndependentVariable,
      scanIndependentVariable,
    );

    if (!plotOptions) return;

    // Create container and add to DOM (hidden) - WebGL needs DOM element
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${WIDTH}px`;
    container.style.height = `${HEIGHT}px`;
    document.body.appendChild(container);

    const chart = echarts.init(container, null, {
      renderer: "canvas",
      width: WIDTH,
      height: HEIGHT,
    });
    chart.setOption(plotOptions);
    // Force resize to ensure everything renders
    chart.resize();

    // Wait for chart to finish rendering - need extra delay for 3D axis titles
    const capturePng = () => {
      if (!container.parentNode) return;
      // Force another resize to ensure axis titles render
      chart.resize();
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const canvas = chart.renderToCanvas();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (!blob) {
            document.body.removeChild(container);
            chart.dispose();
            return;
          }

          const url = URL.createObjectURL(blob);
          promptDownloadUrl(downloadName, url);
          URL.revokeObjectURL(url);
          document.body.removeChild(container);
          chart.dispose();
        });
      } else {
        document.body.removeChild(container);
        chart.dispose();
      }
    };

    chart.on("finished", () => {
      // Extra delay to ensure axis titles are fully rendered
      setTimeout(capturePng, 500);
    });

    // Fallback timeout - longer for 3D rendering with axis titles
    setTimeout(capturePng, 2000);
  };

  const handlePdfDownload = async () => {
    if (!result || !timeCourseIndependentVariable) return;

    const plotOptions = generatePlot3DParameters(
      result,
      graphSettings,
      variableSettingss,
      timeCourseIndependentVariable,
      scanIndependentVariable,
    );

    if (!plotOptions) return;

    // lazy import so it doesn't get downloaded at start
    const { jsPDF } = await import("jspdf");

    // Create container and add to DOM (hidden) - WebGL needs DOM element
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${WIDTH}px`;
    container.style.height = `${HEIGHT}px`;
    document.body.appendChild(container);

    const chart = echarts.init(container, null, {
      renderer: "canvas",
      width: WIDTH,
      height: HEIGHT,
    });
    chart.setOption(plotOptions);
    // Force resize to ensure everything renders
    chart.resize();

    // Wait for chart to finish rendering - need extra delay for 3D axis titles
    const captureAndSave = () => {
      if (!container.parentNode) return;
      // Force another resize to ensure axis titles render
      chart.resize();
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const canvas = chart.renderToCanvas();
      if (canvas) {
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [WIDTH, HEIGHT],
        });
        pdf.addImage(canvas, "png", 0, 0, WIDTH, HEIGHT);
        pdf.save(`${downloadName}.pdf`);
      }
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      chart.dispose();
    };

    chart.on("finished", () => {
      // Extra delay to ensure axis titles are fully rendered
      setTimeout(captureAndSave, 500);
    });

    // Fallback timeout - longer for 3D rendering with axis titles
    setTimeout(captureAndSave, 2000);
  };

  if (!result || result.type === "steadyState") {
    return null;
  }

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger>
        <IconButton label="Download">
          <DownloadIcon width="1em" height="1em" />
        </IconButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem name="Download as PNG" onSelect={handlePngDownload} />
        <DropdownMenuItem name="Download as PDF" onSelect={handlePdfDownload} />
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};

export default DownloadPlot3DButton;
