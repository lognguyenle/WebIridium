type AxisSettings = {
  includeTitle: boolean;
  title: string;
  color: string;
};

type GridSettings = {
  enabled: {
    x: boolean;
    y: boolean;
  };
  xColor: string;
  yColor: string;
  xWidth: number;
  yWidth: number;
  numXGrids: number;
  numYGrids: number;
};

export type GraphSettingsV1 = {
  versionTag: 1;

  backgroundColor: string;
  drawingAreaColor: string;
  includeTitle: boolean;
  title: string;
  titleColor: string;
  includeBorder: boolean;
  borderColor: string;
  borderThickness: number;
  globalWidth: number;
  isAutoscaledX: boolean;
  minX: number;
  maxX: number;
  isAutoscaledY: boolean;
  minY: number;
  maxY: number;
  margin: number;
  xAxis: AxisSettings;
  yAxis: AxisSettings;
  majorGrid: GridSettings;
  minorGrid: GridSettings;
  legend: {
    visible: boolean;
    isFloating: boolean;

    // Floating only
    textColor: string;
    backgroundColor: string;
    borderColor: string;
    borderThickness: number;
    padding: number;
    lineLength: number;
  };
};
