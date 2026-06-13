"use client";
import React from 'react';

interface Step {
    num: number;
    status: "active" | "completed" | "pending";
    text: string;
}

export default function WorkflowSteps({ steps }: { steps: Step[] }) {
    if (steps.length === 0) return null;

    return (
        <div
            style={{
                marginTop: "40px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gridGap: "20px 15px",
                justifyItems: "center",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 500,
                color: "#000",
                width: "100%"
            }}
        >
            {steps.map((s, i) => (
                <div
                    key={i}
                    className={`step-box`}
                    style={{
                        position: "relative",
                        padding: "8px",
                        borderRadius: "10px",
                        width: "100%",
                        fontSize: "13px",
                        fontWeight: 500,
                        background:
                            s.status === "completed"
                                ? "#e8fff0"
                                : s.status === "active"
                                    ? "#eaf3ff"
                                    : "#f0f4f9",
                        border:
                            s.status === "completed"
                                ? "2px solid #28a745"
                                : s.status === "active"
                                    ? "2px solid #007bff"
                                    : "1px solid #e0e0e0",
                        transition: "all 0.4s ease",
                        minHeight: "65px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    {s.status === "active" ? (
                        <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mb-1"></span>
                    ) : s.status === "completed" ? (
                        <div style={{ fontSize: "18px", color: "#28a745", marginBottom: "2px" }}>✓</div>
                    ) : (
                        <div style={{ fontSize: "18px", color: "#999", marginBottom: "2px" }}>•</div>
                    )}
                    <span>{s.text}</span>

                    {/* Arrow */}
                    {((i + 1) % 5 !== 0 && i !== steps.length - 1) && (
                        <span style={{ position: "absolute", right: "-12px", top: "50%", transform: "translateY(-50%)", color: "#ccc" }}>→</span>
                    )}
                </div>
            ))}
        </div>
    );
}
