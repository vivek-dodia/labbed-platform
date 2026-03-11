"use client";

interface EditorialInputProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  rightLabel?: string;
}

export default function EditorialInput({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required = false,
  rightLabel,
}: EditorialInputProps) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.5rem",
        }}
      >
        <label
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: "Manrope, sans-serif",
            color: "#121212",
          }}
        >
          {label}
        </label>
        {rightLabel && (
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: "Manrope, sans-serif",
              color: "#121212",
              opacity: 0.5,
              cursor: "pointer",
            }}
          >
            {rightLabel}
          </span>
        )}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          width: "100%",
          padding: "1rem",
          border: "1px solid #121212",
          background: "transparent",
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.9rem",
          color: "#121212",
          outline: "none",
          transition: "background 0.2s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = "#fff";
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      />
    </div>
  );
}
