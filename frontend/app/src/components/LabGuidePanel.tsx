"use client";
import { useState, useCallback } from "react";
import type { GuideResponse, GuideProgressResponse, ValidationResult, GuideStep } from "@/types/api";
import { api } from "@/lib/api";

const MONO = "'Space Mono', monospace";
const FONT = "'Manrope', sans-serif";
const BG = "#79f673";
const INK = "#0a0a0a";
const LABEL: React.CSSProperties = {
  fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, fontSize: "0.65rem",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#79f673",
  intermediate: "#ffbd2e",
  advanced: "#ff5f56",
};

interface Props {
  guide: GuideResponse;
  progress: GuideProgressResponse;
  labUUID: string;
  onProgressUpdate: (p: GuideProgressResponse) => void;
  onClose: () => void;
}

export default function LabGuidePanel({ guide, progress, labUUID, onProgressUpdate, onClose }: Props) {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [validating, setValidating] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, ValidationResult>>({});
  const [showTopology, setShowTopology] = useState(false);

  const isCompleted = (i: number) => progress.completedSteps?.includes(i);
  const completedCount = progress.completedSteps?.length || 0;
  const allDone = completedCount === guide.steps.length;

  const validateStep = useCallback(async (stepIndex: number) => {
    setValidating(stepIndex);
    try {
      const result = await api.post<ValidationResult>(`/api/v1/labs/${labUUID}/guide/validate`, { stepIndex });
      setResults((prev) => ({ ...prev, [stepIndex]: result }));
      if (result.passed) {
        onProgressUpdate({
          ...progress,
          completedSteps: [...(progress.completedSteps || []), stepIndex],
        });
        // Auto-advance to next step
        if (stepIndex < guide.steps.length - 1) {
          setTimeout(() => setExpandedStep(stepIndex + 1), 500);
        }
      }
    } catch {
      setResults((prev) => ({ ...prev, [stepIndex]: { passed: false, output: "Validation failed — is the lab running?", stepIndex } }));
    }
    setValidating(null);
  }, [labUUID, progress, onProgressUpdate, guide.steps.length]);

  const resetProgress = useCallback(async () => {
    try {
      await api.del(`/api/v1/templates/${guide.templateId}/guide/progress`);
      onProgressUpdate({ completedSteps: [], totalSteps: guide.steps.length });
      setResults({});
      setExpandedStep(0);
    } catch {}
  }, [guide.templateId, guide.steps.length, onProgressUpdate]);

  return (
    <div style={{
      width: 360, minWidth: 360, borderLeft: "1px solid rgba(255,255,255,0.08)",
      display: "flex", flexDirection: "column", overflow: "hidden", background: INK,
    }}>
      {/* Header */}
      <div style={{ padding: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ ...LABEL, fontSize: "0.7rem", color: BG, marginBottom: 4 }}>GUIDE</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: FONT, color: BG }}>{guide.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BG, cursor: "pointer", fontSize: "0.8rem", padding: 4 }}>{"\u2715"}</button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{
            ...LABEL, fontSize: "0.5rem", padding: "2px 6px", borderRadius: 99,
            border: `1px solid ${DIFFICULTY_COLORS[guide.difficulty] || BG}`,
            color: DIFFICULTY_COLORS[guide.difficulty] || BG,
          }}>
            {guide.difficulty}
          </span>
          {guide.estimatedTime && (
            <span style={{ ...LABEL, fontSize: "0.5rem", padding: "2px 6px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.4)" }}>
              {guide.estimatedTime}
            </span>
          )}
        </div>

        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, fontFamily: FONT }}>{guide.description}</div>

        {/* Concepts */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
          {guide.concepts?.map((c, i) => (
            <span key={i} style={{
              fontSize: "0.5rem", fontFamily: MONO, padding: "1px 5px",
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)",
              borderRadius: 2,
            }}>{c}</span>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ ...LABEL, fontSize: "0.5rem", opacity: 0.4 }}>PROGRESS</span>
            <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: allDone ? BG : "rgba(255,255,255,0.4)" }}>
              {completedCount}/{guide.steps.length}
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2, transition: "width 0.3s",
              width: `${guide.steps.length > 0 ? (completedCount / guide.steps.length) * 100 : 0}%`,
              background: allDone ? BG : "rgba(121,246,115,0.5)",
            }} />
          </div>
        </div>
      </div>

      {/* Topology notes toggle */}
      {guide.topologyNotes && (
        <button
          onClick={() => setShowTopology(!showTopology)}
          style={{
            width: "100%", padding: "0.5rem 0.75rem", border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.08)", background: "transparent",
            color: BG, cursor: "pointer", textAlign: "left",
            ...LABEL, fontSize: "0.55rem",
          }}
        >
          {showTopology ? "\u25BC" : "\u25B6"} TOPOLOGY OVERVIEW
        </button>
      )}
      {showTopology && (
        <div style={{
          padding: "0.5rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontSize: "0.65rem", lineHeight: 1.6, color: "rgba(255,255,255,0.5)",
          fontFamily: MONO, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
        }}>
          {guide.topologyNotes}
        </div>
      )}

      {/* Steps */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {guide.steps.map((step: GuideStep, i: number) => {
          const completed = isCompleted(i);
          const expanded = expandedStep === i;
          const result = results[i];
          const isValidating = validating === i;

          return (
            <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {/* Step header */}
              <button
                onClick={() => setExpandedStep(expanded ? null : i)}
                style={{
                  width: "100%", padding: "0.6rem 0.75rem", border: "none",
                  background: expanded ? "rgba(121,246,115,0.04)" : "transparent",
                  cursor: "pointer", textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700,
                  fontFamily: MONO, marginTop: 1,
                  background: completed ? BG : "transparent",
                  color: completed ? INK : "rgba(255,255,255,0.3)",
                  border: completed ? "none" : "1px solid rgba(255,255,255,0.15)",
                }}>
                  {completed ? "\u2713" : i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "0.7rem", fontWeight: 600, fontFamily: FONT,
                    color: completed ? "rgba(121,246,115,0.6)" : BG,
                    textDecoration: completed ? "line-through" : "none",
                    opacity: completed ? 0.6 : 1,
                  }}>
                    {step.title}
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {expanded && (
                <div style={{ padding: "0 0.75rem 0.75rem 2.75rem" }}>
                  <div style={{ fontSize: "0.65rem", lineHeight: 1.6, color: "rgba(255,255,255,0.5)", fontFamily: FONT, marginBottom: 10 }}>
                    {step.description}
                  </div>

                  {/* Hint toggle */}
                  {step.hint && (
                    <>
                      <button
                        onClick={() => setShowHint((prev) => ({ ...prev, [i]: !prev[i] }))}
                        style={{
                          ...LABEL, fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", background: "none",
                          border: "none", cursor: "pointer", padding: 0, marginBottom: showHint[i] ? 6 : 10,
                        }}
                      >
                        {showHint[i] ? "\u25BC HIDE HINT" : "\u25B6 SHOW HINT"}
                      </button>
                      {showHint[i] && (
                        <div style={{
                          fontSize: "0.6rem", lineHeight: 1.6, color: "rgba(121,246,115,0.4)", fontFamily: FONT,
                          padding: "0.5rem", background: "rgba(121,246,115,0.03)", borderLeft: `2px solid rgba(121,246,115,0.15)`,
                          marginBottom: 10,
                        }}>
                          {step.hint}
                        </div>
                      )}
                    </>
                  )}

                  {/* Validation result */}
                  {result && (
                    <div style={{
                      marginBottom: 10, padding: "0.4rem 0.5rem", fontSize: "0.6rem", fontFamily: MONO,
                      background: result.passed ? "rgba(121,246,115,0.06)" : "rgba(255,95,86,0.06)",
                      borderLeft: `2px solid ${result.passed ? BG : "#ff5f56"}`,
                      maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                      color: "rgba(255,255,255,0.5)",
                    }}>
                      <div style={{ ...LABEL, fontSize: "0.5rem", color: result.passed ? BG : "#ff5f56", marginBottom: 4 }}>
                        {result.passed ? "\u2713 PASSED" : "\u2717 NOT YET"}
                      </div>
                      {result.output}
                    </div>
                  )}

                  {/* Validate button */}
                  {step.validation && !completed && (
                    <button
                      onClick={() => validateStep(i)}
                      disabled={isValidating}
                      style={{
                        ...LABEL, fontSize: "0.55rem", padding: "5px 14px",
                        border: `1px solid ${BG}`, borderRadius: 99,
                        background: isValidating ? "transparent" : BG,
                        color: isValidating ? BG : INK,
                        cursor: isValidating ? "wait" : "pointer",
                      }}
                    >
                      {isValidating ? "CHECKING..." : "CHECK"}
                    </button>
                  )}

                  {/* Manual complete for steps without validation */}
                  {!step.validation && !completed && (
                    <button
                      onClick={() => validateStep(i)}
                      style={{
                        ...LABEL, fontSize: "0.55rem", padding: "5px 14px",
                        border: `1px solid ${BG}`, borderRadius: 99, background: BG, color: INK, cursor: "pointer",
                      }}
                    >
                      MARK COMPLETE
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", justifyContent: "space-between" }}>
        {allDone ? (
          <div style={{ ...LABEL, fontSize: "0.6rem", color: BG }}>ALL STEPS COMPLETE</div>
        ) : (
          <div />
        )}
        <button
          onClick={resetProgress}
          style={{
            ...LABEL, fontSize: "0.5rem", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "rgba(255,255,255,0.3)", cursor: "pointer", borderRadius: 99,
          }}
        >
          RESET
        </button>
      </div>
    </div>
  );
}
