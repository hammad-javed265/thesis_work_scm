"use client";
import UploadBox from "./components/UploadBox";
import ProductsModal from "./components/ProductsModal";
import { useState } from "react";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [completeProducts, setCompleteProducts] = useState([]);
  const [brokenProducts, setBrokenProducts] = useState([]);

  const safeJson = async (res: Response): Promise<unknown[]> => {
    const text = await res.text();
    if (!text || text.trim() === "") return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.warn("safeJson: could not parse response body:", text.slice(0, 200));
      return [];
    }
  };

  const fetchAndDisplayProducts = async () => {
    try {
      const [completeRes, brokenRes] = await Promise.all([
        fetch("http://10.0.80.31:5678/webhook/10a7f9c2-0832-4b86-95bc-e4ac2a0b2806"),
        fetch("http://10.0.80.31:5678/webhook/6b0264ae-34a9-443d-b207-166c74f87acf")
      ]);

      const [completeData, brokenData] = await Promise.all([
        safeJson(completeRes),
        safeJson(brokenRes)
      ]);

      setCompleteProducts(completeData);
      setBrokenProducts(brokenData);
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to load products.");
    }
  };

  return (
    <main
      style={{
        fontFamily: "Inter, sans-serif",
        background: "radial-gradient(circle at top right, #f5f8ff, #eef2f7)",
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        marginTop: "-90px",
        paddingTop: "90px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <UploadBox onViewProducts={fetchAndDisplayProducts} />
      <ProductsModal
        open={modalOpen}
        setOpen={setModalOpen}
        completeProducts={completeProducts}
        brokenProducts={brokenProducts}
      />
    </main>
  );
}
