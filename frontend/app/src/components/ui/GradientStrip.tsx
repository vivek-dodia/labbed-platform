interface Props {
  direction?: "horizontal" | "vertical";
  height?: string;
}

export default function GradientStrip({
  direction = "horizontal",
  height,
}: Props) {
  const grad =
    direction === "horizontal"
      ? "linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)"
      : "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)";

  return (
    <div
      style={{
        background: grad,
        height: height || (direction === "horizontal" ? "8vw" : "100%"),
        width: direction === "vertical" ? height || "100%" : "100%",
        gridColumn: direction === "horizontal" ? "span 4" : undefined,
      }}
    />
  );
}
