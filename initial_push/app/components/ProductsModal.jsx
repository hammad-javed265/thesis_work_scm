"use client";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

export default function ProductsModal({ open, setOpen, completeProducts, brokenProducts }) {
  const [activeTab, setActiveTab] = useState("");

  const warehouses = useMemo(() => {
    const ws = new Set();
    completeProducts.forEach((p) => p.Warehouse && ws.add(p.Warehouse));
    brokenProducts.forEach((p) => p.Warehouse && ws.add(p.Warehouse));
    return Array.from(ws).sort();
  }, [completeProducts, brokenProducts]);

  // Sync state with props (warehouses)
  if (open && warehouses.length > 0 && (!activeTab || !warehouses.includes(activeTab))) {
    setActiveTab(warehouses[0]);
  }

  const currentTab = activeTab || (warehouses.length > 0 ? warehouses[0] : "");

  const filteredComplete = useMemo(() => {
    if (!currentTab) return completeProducts;
    return completeProducts.filter((p) => p.Warehouse === currentTab);
  }, [currentTab, completeProducts]);

  const filteredBroken = useMemo(() => {
    if (!currentTab) return brokenProducts;
    return brokenProducts.filter((p) => p.Warehouse === currentTab);
  }, [currentTab, brokenProducts]);

  const totalQty = (arr) => arr.reduce((sum, p) => sum + parseInt(p.QTY || 0), 0);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Process each warehouse
    warehouses.forEach((warehouse) => {
      const warehouseComplete = completeProducts.filter((p) => p.Warehouse === warehouse);
      const warehouseBroken = brokenProducts.filter((p) => p.Warehouse === warehouse);

      // Prepare data for the sheet
      const sheetData = [];

      // Add Complete Assortment section
      sheetData.push(["Complete Assortment"]);
      sheetData.push([`Articles Count: ${warehouseComplete.length}`]);
      sheetData.push([`Total QTY: ${totalQty(warehouseComplete)}`]);
      sheetData.push([]); // Empty row
      sheetData.push(["Warehouse", "Item ID", "Color", "QTY"]); // Headers
      warehouseComplete.forEach((p) => {
        sheetData.push([p.Warehouse, p.ITEMID, p.INVENTCOLOR, p.QTY]);
      });

      sheetData.push([]); // Empty row separator
      sheetData.push([]); // Empty row separator

      // Add Broken Assortment section
      sheetData.push(["Broken Assortment"]);
      sheetData.push([`Articles Count: ${warehouseBroken.length}`]);
      sheetData.push([`Total QTY: ${totalQty(warehouseBroken)}`]);
      sheetData.push([]); // Empty row
      sheetData.push(["Warehouse", "Item ID", "Color", "QTY"]); // Headers
      warehouseBroken.forEach((p) => {
        sheetData.push([p.Warehouse, p.ITEMID, p.INVENTCOLOR, p.QTY]);
      });

      // Create worksheet and add to workbook
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, warehouse);
    });

    // Generate Excel file as base64 string
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

    // Create download link with data URL
    const link = document.createElement('a');
    link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + excelBuffer;
    link.download = 'Products_in_Warehouse.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!open) return null;

  const renderTable = (title, products) => (
    <div className="mt-6">
      <h4 className="text-md font-semibold mb-2">{title}</h4>
      <p>
        Articles Count: <span className="text-red-500">{products.length}</span>
      </p>
      <p>
        Total QTY: <span className="text-red-500">{totalQty(products)}</span>
      </p>

      <table className="w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="text-left p-2">Warehouse</th>
            <th className="text-left p-2">Item ID</th>
            <th className="text-left p-2">Color</th>
            <th className="text-left p-2">QTY</th>
          </tr>
        </thead>
        <tbody>
          {products.length > 0 ? (
            products.map((p, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-2">{p.Warehouse}</td>
                <td className="p-2">{p.ITEMID}</td>
                <td className="p-2">{p.INVENTCOLOR}</td>
                <td className="p-2">{p.QTY}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" className="p-4 text-center text-gray-500">
                No products found for this warehouse.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 text-gray-800"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl p-6 w-11/12 max-w-3xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Products Ready for Push Initial</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              Export Excel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 text-xl font-bold cursor-pointer hover:text-gray-800"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Warehouse Tabs */}
        {warehouses.length > 0 && (
          <div className="flex space-x-2 border-b mb-4 overflow-x-auto">
            {warehouses.map((w) => (
              <button
                key={w}
                onClick={() => setActiveTab(w)}
                className={`py-2 px-4 border-b-2 transition-colors duration-200 whitespace-nowrap ${currentTab === w
                    ? "border-blue-500 text-blue-600 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                {w}
              </button>
            ))}
          </div>
        )}

        {renderTable("Complete Assortment", filteredComplete)}
        {renderTable("Broken Assortment", filteredBroken)}
      </div>
    </div>
  );
}
