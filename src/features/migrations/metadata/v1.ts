type IconColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type MetadataV1 = {
  versionTag: 1;
  name: string;
  created: number;
  updated: number;
  icon: {
    color: IconColor;
  };
};
