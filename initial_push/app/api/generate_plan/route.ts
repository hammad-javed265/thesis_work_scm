import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        console.log("Proxy: Received request");

        // Parse the incoming form data
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            console.log("Proxy: No file found");
            return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
        }

        console.log(`Proxy: Forwarding file ${file.name} to backend`);

        // Create a new FormData instance for the backend request
        const backendFormData = new FormData();
        backendFormData.append("file", file);

        // Forward to backend
        const backendUrl = "http://127.0.0.1:8000/generate_plan";
        const response = await fetch(backendUrl, {
            method: "POST",
            body: backendFormData,
            // Note: Do not set Content-Type header manually for FormData, fetch does it with boundary
        });

        console.log(`Proxy: Backend responded with ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Proxy: Backend error body:", errorText);
            try {
                // Try to pass through JSON error
                return NextResponse.json(JSON.parse(errorText), { status: response.status });
            } catch {
                return NextResponse.json({ detail: errorText || response.statusText }, { status: response.status });
            }
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Proxy: Internal Error:", error);
        return NextResponse.json(
            { detail: `Proxy Error: ${error.message}` },
            { status: 500 }
        );
    }
}
