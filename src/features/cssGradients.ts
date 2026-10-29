export type CssGradient = (typeof CSS_GRADIENTS)[number];
export const CSS_GRADIENTS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

export const getPropertyFromCssGradient = (gradient: CssGradient) =>
  `var(--gradient-${gradient})`;

export const getRandomCssGradient = (): CssGradient => {
  return CSS_GRADIENTS[Math.floor(Math.random() * CSS_GRADIENTS.length)];
};
