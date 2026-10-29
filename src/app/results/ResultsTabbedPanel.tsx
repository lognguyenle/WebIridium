import { useAtomValue } from "jotai";

import styles from "./results.module.css";

import GraphIcon from "@/assets/icons/GraphIcon.svg?react";
import TableIcon from "@/assets/icons/TableIcon.svg?react";
import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import ThreeDIcon from "@/assets/icons/ThreeDIcon.svg?react";

import TabbedPanel, { type TabInfo } from "@/components/TabbedPanel";
import PlotPanel from "./PlotPanel";
import TablePanel from "./TablePanel";
import Plot3DPanel from "./Plot3DPanel";
import SteadyStateTablePanel from "./SteadyStateTablePanel";
import SteadyState3DPanel from "./SteadyState3DPanel";

import DownloadPlotButton from "./downloadButtons/DownloadPlotButton";
import DownloadTableButton from "./downloadButtons/DownloadTableButton";
import DownloadPlot3DButton from "./downloadButtons/DownloadPlot3DButton";
import DownloadSteadyState3DButton from "./downloadButtons/DownloadSteadyState3DButton";

import { simulationResultAtom } from "@/globals/simulation";
import IconButton from "@/components/IconButton";

export interface ResultTabbedPanelProps {
  onClose: () => void;
}

const ResultTabbedPanel = ({ onClose }: ResultTabbedPanelProps) => {
  const simulationResult = useAtomValue(simulationResultAtom);
  let tabs: TabInfo[];
  if (simulationResult?.type === "steadyState") {
    tabs = [
      {
        name: "Tables",
        icon: <TableIcon width="20" height="20" />,
        render: () => <SteadyStateTablePanel />,
        renderActions: () => (
          <>
            <IconButton label="Close" onClick={onClose}>
              <CrossIcon width="1em" height="1em" />
            </IconButton>
          </>
        ),
      },
      {
        name: "3D",
        icon: <ThreeDIcon width="20" height="20" />,
        render: () => <SteadyState3DPanel />,
        renderActions: () => (
          <>
            <IconButton label="Close" onClick={onClose}>
              <CrossIcon width="1em" height="1em" />
            </IconButton>
            <DownloadSteadyState3DButton />
          </>
        ),
      },
    ];
  } else {
    tabs = [
      {
        name: "Plot",
        icon: <GraphIcon width="20" height="20" />,
        render: () => <PlotPanel />,
        renderActions: () => (
          <>
            <IconButton label="Close" onClick={onClose}>
              <CrossIcon width="1em" height="1em" />
            </IconButton>
            <DownloadPlotButton />
          </>
        ),
      },
      {
        name: "Table",
        icon: <TableIcon width="20" height="20" />,
        render: () => <TablePanel />,
        renderActions: () => (
          <>
            <IconButton label="Close" onClick={onClose}>
              <CrossIcon width="1em" height="1em" />
            </IconButton>
            <DownloadTableButton />
          </>
        ),
      },
      {
        name: "3D",
        icon: <ThreeDIcon width="20" height="20" />,
        render: () => <Plot3DPanel />,
        renderActions: () => (
          <>
            <IconButton label="Close" onClick={onClose}>
              <CrossIcon width="1em" height="1em" />
            </IconButton>
            <DownloadPlot3DButton />
          </>
        ),
      },
    ];
  }

  if (simulationResult) {
    return <TabbedPanel tabs={tabs} data-testid="results-panel" />;
  } else {
    return (
      <div className={styles.nothingContainer}>
        <div className={styles.nothingTopbar}>
          <IconButton label="Close" onClick={onClose}>
            <CrossIcon width="1em" height="1em" />
          </IconButton>
        </div>

        <div className={styles.nothingBody}>
          <p className={styles.nothingLabel}>No results.</p>
        </div>
      </div>
    );
  }
};

export default ResultTabbedPanel;
