/**
 * Based off the pulse loader from react-spinners
 */

import { memo } from "react";

import styles from "./PulseLoader.module.css";
import type { CSSProperties } from "react";

export interface PulseLoaderProps {
  /** Color as CSS value. */
  color?: string;
  /** Size as CSS value. */
  size?: string;
  /** Spacing as CSS value. */
  spacing?: string;
  cssOverride?: CSSProperties;
  [prop: string]: unknown;
}

const PulseLoader = memo(
  ({
    color = "currentColor",
    size = "7px",
    spacing = "3px",
    cssOverride = {},
    ...additionalProps
  }: PulseLoaderProps) => {
    const wrapper: CSSProperties = {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing,
      ...cssOverride,
    };

    const style = (i: number): CSSProperties => {
      return {
        display: "inline-block",
        backgroundColor: color,
        width: size,
        height: size,
        animation: `${styles.pulse} 1s ${-0.2 * i}s infinite cubic-bezier(0.455, 0.030, 0.515, 0.955)`,
        animationFillMode: "both",
      };
    };

    return (
      <span style={wrapper} {...additionalProps}>
        <span style={style(1)} />
        <span style={style(2)} />
        <span style={style(3)} />
      </span>
    );
  },
);

export default PulseLoader;
