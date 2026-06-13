"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { SafeCell } from "../components/SafeCell";
import WorkflowSteps from "../components/WorkflowSteps";

const STORE_COUNTS: { [key: string]: number } = {
    "A+1": 7,
    "A+2": 18,
    "A": 18,
    "B+": 11,
    "B": 52,
    "C1": 38,
    "C2": 73,
    "C3": 30,
    "D": 12
};

export default function MLPlanner() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [steps, setSteps] = useState<any[]>([]);

    const updateStep = (num: number, status: string, text: string) => {
        setSteps((prev) => {
            const updated = [...prev];
            // Ensure array has enough slots
            while (updated.length < num) updated.push({ num: updated.length + 1, status: 'pending', text: '' });
            updated[num - 1] = { num, status, text };
            return updated;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setError(null);
        }
    };

    const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
    const [manualRows, setManualRows] = useState([{
        Article: '',
        Color: '',
        Price: '',
        IP: '',
        Theme: ''
    }]);

    const handleManualChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const newRows = [...manualRows];
        newRows[index] = { ...newRows[index], [e.target.name]: e.target.value };
        setManualRows(newRows);
    };

    const addManualRow = () => {
        setManualRows([...manualRows, { Article: '', Color: '', Price: '', IP: '', Theme: '' }]);
    };

    const removeManualRow = (index: number) => {
        if (manualRows.length > 1) {
            const newRows = manualRows.filter((_, i) => i !== index);
            setManualRows(newRows);
        }
    };

    const generateExcelFromManual = () => {
        const data = manualRows.map(row => ({
            Article: row.Article,
            Color: row.Color,
            Price: Number(row.Price),
            IP: Number(row.IP),
            Theme: row.Theme
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new File([excelBuffer], "Manual_Plan.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    };

    const processFile = async (file: File) => {
        setIsLoading(true);
        setError(null);
        setSteps([]);

        const formData = new FormData();
        formData.append("file", file);

        try {
            updateStep(1, "active", "Initializing...");
            await new Promise(r => setTimeout(r, 500));
            updateStep(1, "completed", "Initialized");

            updateStep(2, "active", "Uploading File...");

            // Using Custom Next.js API Route Proxy
            const response = await fetch("/api/generate_plan", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let errorMessage = response.statusText;
                try {
                    const textBody = await response.text();
                    try {
                        const errorData = JSON.parse(textBody);
                        if (errorData.detail) errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
                        else errorMessage = JSON.stringify(errorData);
                    } catch { if (textBody) errorMessage = textBody; }
                } catch (e) { console.error(e); }
                throw new Error(`Server error (${response.status}): ${errorMessage}`);
            }

            updateStep(2, "completed", "File Uploaded");
            updateStep(3, "active", "Running ML Model...");
            // Simulate processing time if response is instant, just for visuals or if backend actually takes time, this step shows while awaiting

            const data = await response.json();
            updateStep(3, "completed", "ML Model Finished");

            updateStep(4, "active", "Processing Results...");

            let dataArray: any[] = [];
            if (Array.isArray(data)) {
                dataArray = data;
            } else if (typeof data === "object" && data !== null) {
                if (Array.isArray(data.plan)) {
                    dataArray = data.plan;
                } else if (Object.keys(data).length > 0 && typeof Object.values(data)[0] === 'object') {
                    dataArray = Object.values(data);
                } else {
                    dataArray = [data];
                }
            }

            // Flatten Allocations
            const flattenedData = dataArray.map(item => {
                const { Allocations, ...rest } = item;
                // Ensure numeric fields are numbers
                const newItem = { ...rest, ...(typeof Allocations === 'object' ? Allocations : {}) };
                // Ensure remaining packs is a number
                newItem.Remaining_Packs = parseFloat(newItem.Remaining_Packs || 0);
                return newItem;
            });

            await new Promise(r => setTimeout(r, 800)); // Small delay for visual flow
            setTableData(flattenedData);
            updateStep(4, "completed", "Results Ready");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to upload and process file.");
            updateStep(steps.length + 1, "error", "Failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (inputMode === 'upload') {
            if (!selectedFile) {
                setError("Please select a file first.");
                return;
            }
            await processFile(selectedFile);
        } else {
            // Manual mode validation
            const isValid = manualRows.every(row => row.Article && row.Color && row.Price && row.IP && row.Theme);
            if (!isValid) {
                setError("Please fill in all fields for all rows.");
                return;
            }
            const file = generateExcelFromManual();
            await processFile(file);
        }
    };

    const handleCellChange = (rowIndex: number, key: string, value: string) => {
        // Only enforce logic for cluster columns
        if (STORE_COUNTS[key] !== undefined) {
            const newData = [...tableData];
            const row = { ...newData[rowIndex] };

            const oldVal = parseFloat(row[key]) || 0;
            const newVal = parseFloat(value);

            if (isNaN(newVal) || newVal < 0) return; // invalid input

            const diff = newVal - oldVal;
            const stores = STORE_COUNTS[key];
            const pairsNeeded = diff * stores; // "packs or assortments" * stores. User said "1 means 7 packs... " so value is packs PER STORE.

            const currentRemaining = parseFloat(row["Remaining_Packs"]) || 0;
            const newRemaining = currentRemaining - pairsNeeded;

            // Check if we have enough remaining packs (only if we are adding)
            // User said: "not let me add ... until there quantity in remaing packs is acccording"
            // So if newRemaining < 0, block it.
            if (newRemaining < 0) {
                alert(`Cannot add ${diff} packs to ${key}. Needed: ${pairsNeeded}, Available: ${currentRemaining}`);
                return;
            }

            row[key] = newVal;
            row["Remaining_Packs"] = newRemaining;
            newData[rowIndex] = row;
            setTableData(newData);
        } else {
            // Normal edit for non-cluster columns (if any allowed)
            const newData = [...tableData];
            newData[rowIndex] = { ...newData[rowIndex], [key]: value };
            setTableData(newData);
        }
    };

    const handleDownload = () => {
        if (tableData.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(tableData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "DistributionPlan");
        XLSX.writeFile(workbook, "Approved_Distribution_Plan.xlsx");
    };

    const getHeaders = () => {
        if (tableData.length === 0) return [];
        const keys = Object.keys(tableData[0]);
        const priority = ["Article", "Color", "Theme", "Price", "Total_Pairs", "Remaining_Packs", "A+1", "A+2", "A", "B+", "B", "C1", "C2", "C3", "D"];

        keys.sort((a, b) => {
            const idxA = priority.indexOf(a);
            const idxB = priority.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1 && idxB === -1) return -1;
            if (idxB !== -1 && idxA === -1) return 1;
            return 0;
        });
        return keys;
    };

    const headers = getHeaders();

    return (
        <div className="min-h-[91vh] flex flex-col items-center justify-center p-8"
            style={{
                fontFamily: "Inter, sans-serif",
                background: "radial-gradient(circle at top right, #f5f8ff, #eef2f7)",
                backgroundImage: "url('/bg.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundAttachment: "fixed"
            }}>

            <div
                className={`bg-white rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-12 w-full max-w-[1200px] text-center transition-all backdrop-blur-[6px]`}
                style={{ borderRadius: "20px" }}
            >
                {/* Mode Toggle */}
                <div className="flex justify-center mb-8 gap-4">
                    <button
                        onClick={() => setInputMode('upload')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all border ${inputMode === 'upload' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        📄 File Upload
                    </button>
                    <button
                        onClick={() => setInputMode('manual')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all border ${inputMode === 'manual' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        ⌨️ Manual Input
                    </button>
                </div>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">ML Assortment Planner</h1>
                    <p className="text-gray-500">
                        {inputMode === 'upload'
                            ? "Upload your File.xlsx to generate distribution details."
                            : "Enter product details manually to generate distribution details."}
                    </p>
                </div>

                {/* Content Section */}
                <div className="flex flex-col items-center mb-5 w-full">

                    {inputMode === 'upload' ? (
                        <div className="w-full flex justify-center">
                            <label
                                className="group flex flex-col items-center justify-center w-full max-w-2xl p-12 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-500 transition-all mb-6 relative overflow-hidden"
                            >
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className="z-10 flex flex-col items-center transition-transform group-hover:scale-105">
                                    <div className="text-5xl mb-4 opacity-80 group-hover:opacity-100">📄</div>
                                    <div className="text-lg font-semibold text-gray-700">
                                        {selectedFile ? <span className="text-blue-600">{selectedFile.name}</span> : "Choose a file to upload"}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-2">Supports .xlsx, .xls</div>
                                </div>
                            </label>
                        </div>
                    ) : (
                        <div className="w-full max-w-5xl flex flex-col gap-4 mb-8">
                            {manualRows.map((row, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm items-end relative animate-fade-in group text-black">
                                    {/* Inputs */}
                                    <div className="flex flex-col text-left">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Article</label>
                                        <input type="text" name="Article" value={row.Article} onChange={(e) => handleManualChange(index, e)} placeholder="Code" className="p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Color</label>
                                        <input type="text" name="Color" value={row.Color} onChange={(e) => handleManualChange(index, e)} placeholder="Color" className="p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Category</label>
                                        <input type="text" name="Theme" value={row.Theme} onChange={(e) => handleManualChange(index, e)} placeholder="Category" className="p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Price</label>
                                        <input type="number" name="Price" value={row.Price} onChange={(e) => handleManualChange(index, e)} placeholder="Price" className="p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Total Order (IP)</label>
                                        <input type="number" name="IP" value={row.IP} onChange={(e) => handleManualChange(index, e)} placeholder="Total" className="p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                                    </div>

                                    {/* Delete Button */}
                                    <div className="flex justify-center pb-1">
                                        {manualRows.length > 1 && (
                                            <button
                                                onClick={() => removeManualRow(index)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                title="Remove row"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addManualRow}
                                className="self-center mt-2 px-6 py-2 bg-white border-2 border-dashed border-gray-300 text-gray-500 font-semibold rounded-lg hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center gap-2"
                            >
                                ＋ Add Another Product
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isLoading || (inputMode === 'upload' && !selectedFile)}
                        className={`px-10 py-2 rounded-xl text-lg font-bold text-white shadow-lg transition-transform transform active:scale-95 ${isLoading || (inputMode === 'upload' && !selectedFile)
                            ? "bg-gray-300 cursor-not-allowed shadow-none"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/40"
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processing...
                            </span>
                        ) : "Generate Plan"}
                    </button>

                    {error && (
                        <div className="mt-6 text-red-600 bg-red-50 px-6 py-3 rounded-xl border border-red-100 font-medium animate-pulse">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Workflow Steps */}
                <WorkflowSteps steps={steps} />

                {/* Results Section */}
                {tableData.length > 0 && (
                    <div className="mt-12 animate-fade-in text-left">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-[#1a1a1a]">Distribution Plan Output</h2>
                            <div className="flex gap-3">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-[#ffc107] hover:bg-[#e0a800] text-black rounded-lg shadow-sm text-sm font-medium transition-colors"
                                    >
                                        Edit Mode
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-2 bg-[#28a745] hover:bg-[#218838] text-white rounded-lg shadow-sm text-sm font-medium transition-colors"
                                    >
                                        Save View
                                    </button>
                                )}

                                <button
                                    onClick={handleDownload}
                                    className="px-4 py-2 bg-[#6f42c1] hover:bg-[#5a32a3] text-white rounded-lg shadow-sm text-sm font-medium transition-colors"
                                >
                                    Approve & Download
                                </button>
                            </div>
                        </div>

                        <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            {headers.map((header) => (
                                                <th key={header} className="px-4 py-2 font-semibold whitespace-nowrap bg-[#4f0055] text-white">
                                                    {header.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tableData.map((row, rowIndex) => (
                                            <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                                                {headers.map((key) => (
                                                    <td key={`${rowIndex}-${key}`} className="px-4 py-2 whitespace-nowrap">
                                                        <SafeCell
                                                            value={row[key]}
                                                            isEditing={isEditing && STORE_COUNTS[key] !== undefined} // Only allow editing cluster columns if desired, or all? User implied logic on clusters.
                                                            onChange={(val) => handleCellChange(rowIndex, key, val)}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
