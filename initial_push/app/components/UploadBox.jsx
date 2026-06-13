"use client";
import { useState } from "react";

export default function UploadBox({ onViewProducts }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [steps, setSteps] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);

    const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

    const updateStep = (num, status, text) => {
        setSteps((prev) => {
            const updated = [...prev];
            updated[num - 1] = { num, status, text };
            return updated;
        });
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            alert("Please select a file before uploading!");
            return;
        }

        setUploading(true);
        setSteps([]);

        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            // Step 1
            updateStep(1, "active", "Extracting plan from file...");
            await new Promise((r) => setTimeout(r, 3000));
            updateStep(1, "completed", "Extracted plan from file.");

            // Step 2
            updateStep(2, "active", "Getting data from Microsoft Fabric...");
            await new Promise((r) => setTimeout(r, 3000));
            updateStep(2, "completed", "Data fetched from Microsoft Fabric.");

            // Step 3
            updateStep(3, "active", "Getting assortment categories...");
            await new Promise((r) => setTimeout(r, 3000));
            updateStep(3, "completed", "Assortment categories retrieved.");

            // Step 4
            updateStep(4, "active", "Getting store details according to clusters...");
            await new Promise((r) => setTimeout(r, 10000));
            updateStep(4, "completed", "Store details fetched.");

            // Step 5
            updateStep(5, "active", "Getting PO receiving articles data...");
            await new Promise((r) => setTimeout(r, 15000));
            updateStep(5, "completed", "PO receiving data ready.");

            // Step 6
            updateStep(6, "active", "Distributing assortments to stores...");
            await new Promise((r) => setTimeout(r, 15000));
            updateStep(6, "completed", "Assortments distributed.");

            // Step 7
            updateStep(7, "active", "Breaking into sizes and allocating pairs...");
            await new Promise((r) => setTimeout(r, 15000));
            updateStep(7, "completed", "Sizes and pairs allocated.");

            // Step 8
            updateStep(8, "active", "Preparing file for upload in Dynamics...");
            const response = await fetch(
                "http://10.0.80.31:5678/webhook/dcef1de0-2391-4307-9739-7717e079606b",
                {
                    method: "POST",
                    body: formData,
                }
            );
            updateStep(8, "completed", "File prepared for Dynamics.");

            // Step 9
            updateStep(9, "active", "Completing process and downloading file...");
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                if (data.binary && data.binary.data) {
                    const fileInfo = data.binary.data;
                    const blob = new Blob([atob(fileInfo.data)], { type: "text/csv" });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = fileInfo.fileName || "output.csv";
                    link.click();
                }
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "TO Loading.csv";
                link.click();
            }

            updateStep(9, "completed", "TO Loading file has been downloaded.");
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleViewProducts = async () => {
        setLoadingProducts(true);
        try {
            await onViewProducts();
        } finally {
            setLoadingProducts(false);
        }
    };

    return (
        <div
            className="upload-box"
            style={{
                background: "#ffffff",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
                padding: "60px 50px",
                width: "800px",
                textAlign: "center",
                backdropFilter: "blur(6px)",
            }}
        >
            {/* <img src="/Stylo-logo.png" alt="Stylo Logo" className="mx-auto mb-3 w-40" /> */}
            <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
                Initial Push Workflow
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                Easily view products and upload your allocation plan below.
            </p>

            {/* View Products Box */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    border: "2px dashed #ababab",
                    borderRadius: "5px",
                    padding: "12px",
                    marginBottom: "20px",
                }}
            >
                <span className="text-[15px] text-gray-800 font-medium">
                    View products available in the warehouse for the first-time initial push:
                </span>
                <button
                    onClick={handleViewProducts}
                    disabled={loadingProducts}
                    style={{
                        backgroundColor: "#28a745",
                        color: "#fff",
                        padding: "8px 20px",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "14px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: "0 3px 8px rgba(40,167,69,0.22)",
                        opacity: loadingProducts ? 0.8 : 1,
                    }}
                >
                    {loadingProducts ? "⏳ Loading..." : "View"}
                </button>
            </div>

            {/* File Upload */}
            <label
                htmlFor="fileInput"
                style={{
                    border: "2px dashed #007bff",
                    background: "#f7faff",
                    borderRadius: "14px",
                    padding: "35px",
                    color: "#444",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    fontSize: "15px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: "30px",
                }}
                className="hover:bg-[#eef5ff] hover:border-[#0056b3]"
            >
                <i style={{ fontSize: "36px", marginBottom: "10px" }}>📄</i>
                Choose a file to upload
                <input id="fileInput" type="file" hidden onChange={handleFileChange} />
                {selectedFile && (
                    <div style={{ marginTop: "8px", fontSize: "14px", color: "#007bff" }}>
                        📄 {selectedFile.name}
                    </div>
                )}
            </label>

            <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                    backgroundColor: "#007bff",
                    color: "#fff",
                    border: "none",
                    padding: "14px 34px",
                    borderRadius: "10px",
                    fontSize: "16px",
                    fontWeight: "500",
                    cursor: "pointer",
                    boxShadow: "0 6px 15px rgba(0,123,255,0.25)",
                    transition: "all 0.3s ease",
                    opacity: uploading ? 0.8 : 1,
                }}
            >
                {uploading ? "⏳ Processing..." : "Upload Allocation Plan"}
            </button>

            {/* Workflow Steps */}
            {steps.length > 0 && (
                <div
                    id="result"
                    style={{
                        marginTop: "40px",
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gridGap: "20px 15px",
                        justifyItems: "center",
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#000",
                    }}
                >
                    {steps.map((s, i) => (
                        <div
                            key={i}
                            className={`step-box ${s.status}`}
                            style={{
                                position: "relative",
                                padding: "4px",
                                borderRadius: "10px",
                                width: "100%",
                                fontSize: "13px",
                                fontWeight: "500",
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
                                            : "none",
                                transition: "all 0.4s ease",
                                minHeight: "65px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {/* Spinner or Checkmark */}
                            {s.status === "active" ? (
                                <div className="spinner mb-1"></div>
                            ) : s.status === "completed" ? (
                                <div style={{ fontSize: "20px", color: "#28a745", marginBottom: "2px" }}>✅</div>
                            ) : (
                                <div style={{ fontSize: "20px", color: "#999", marginBottom: "2px" }}>•</div>
                            )}


                            <span>{s.text || `Step ${i + 1}`}</span>

                            {/* Animated arrow except last in row */}
                            {((i + 1) % 5 !== 0 && i !== steps.length - 1) && (
                                <span
                                    className="arrow"
                                    style={{
                                        position: "absolute",
                                        right: "-18px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        fontSize: "16px",
                                        animation: "arrowMove 1.2s linear infinite",
                                    }}
                                >
                                    ➡️
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
