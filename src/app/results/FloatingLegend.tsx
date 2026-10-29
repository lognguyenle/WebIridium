import { useRef, useState, type CSSProperties } from "react";
import styles from "./FloatingLegend.module.css";
import type { GraphSettings } from "@/features/savedData";
import { type LineStyle, DASH_ARRAYS } from "@/features/lineStyle";

export interface LegendDataItem {
  title: string;
  color: string;
  dash: LineStyle;
}

export interface FloatingLegendProps {
  settings: GraphSettings["legend"];
  data: LegendDataItem[];
}

const LegendItem = ({
  settings,
  data,
}: {
  settings: GraphSettings["legend"];
  data: LegendDataItem;
}) => {
  return (
    <div className={styles.item}>
      <svg className={styles.line} width={settings.lineLength} height="10">
        <line
          x1="0"
          y1="5"
          x2={settings.lineLength}
          y2="5"
          stroke={data.color}
          strokeWidth="2"
          strokeDasharray={DASH_ARRAYS[data.dash].join(",")}
        />
      </svg>
      <span style={{ color: settings.textColor }}>{data.title}</span>
    </div>
  );
};

type Position = {
  x: number;
  y: number;
};

// TODO: add some tests for this? (snapshot)
// TODO: add clamping
const FloatingLegend = ({ settings, data }: FloatingLegendProps) => {
  const dragStartPosition = useRef<Position | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStartPosition.current = {
      // add the original position in case it was already dragged to account for the offset
      x: e.pageX - (position?.x ?? 0),
      y: e.pageY - (position?.y ?? 0),
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragStartPosition.current) {
      setPosition({
        x: e.pageX - dragStartPosition.current.x,
        y: e.pageY - dragStartPosition.current.y,
      });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    handleMouseMove(e);
    dragStartPosition.current = null;

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const style: CSSProperties & {
    ["--drag-x"]?: string;
    ["--drag-y"]?: string;
  } = {
    backgroundColor: settings.backgroundColor,
    border: `${settings.borderThickness}px solid ${settings.borderColor}`,
    padding: `${settings.padding}px`,
  };

  if (position) {
    style["--drag-x"] = position.x + "px";
    style["--drag-y"] = position.y + "px";
  }

  return (
    <div className={styles.legend} onMouseDown={handleMouseDown} style={style}>
      {data.map((dataItem) => (
        <LegendItem key={dataItem.title} settings={settings} data={dataItem} />
      ))}
    </div>
  );
};

export default FloatingLegend;
