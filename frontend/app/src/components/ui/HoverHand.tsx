interface HoverHandProps {
  style?: React.CSSProperties;
}

export default function HoverHand({ style }: HoverHandProps) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Arrow pointing up */}
      <path
        d="M20 4L28 16H12L20 4Z"
        fill="#000000"
        stroke="#000000"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <rect
        x="17"
        y="16"
        width="6"
        height="18"
        rx="0"
        fill="#000000"
        stroke="#000000"
        strokeWidth="1"
      />
    </svg>
  );
}
