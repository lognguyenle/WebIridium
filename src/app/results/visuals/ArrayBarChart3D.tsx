/**
 * This is used for steady state.
 */

import { useRef, useLayoutEffect, useEffect } from "react";
import * as echarts from "echarts/core";
import { type ECharts } from "echarts/core";

import styles from "./visuals.module.css";

import { type SimulationResult } from "@/features/simulation/Simulator";
import { generateSteadyState3DParameters } from "../generateSteadyState3DParameters";
import { useAtomValue } from "jotai";
import { graphSettingsAtom } from "@/globals/graphPresets";
import type { SteadyState3DItem as SteadyStateDisplayItem } from "../SteadyState3DPanel";

export interface ArrayBarChart3DProps {
  result: SimulationResult;
  item: SteadyStateDisplayItem;
}

const ArrayBarChart3D = ({ result, item }: ArrayBarChart3DProps) => {
  const graphSettings = useAtomValue(graphSettingsAtom);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  // sychronize size
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize();
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        updateSize();
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [containerRef]);

  // sychronize data
  useEffect(() => {
    if (containerRef.current && !chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    const plotOptions = generateSteadyState3DParameters(
      result,
      graphSettings,
      item,
    );

    if (!plotOptions) return;

    chartRef.current?.setOption(plotOptions, false);
  }, [item, result, graphSettings]);

  return <div className={styles.arrayBarChart3D} ref={containerRef} />;
};

export default ArrayBarChart3D;
