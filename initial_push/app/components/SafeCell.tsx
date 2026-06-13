export const SafeCell = ({ value, isEditing, onChange }: { value: any, isEditing: boolean, onChange: (val: string) => void }) => {
    let displayValue = value;
    if (typeof value === "object" && value !== null) {
        displayValue = JSON.stringify(value);
    }

    if (isEditing) {
        return (
            <input
                type="number"
                value={displayValue || ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-[40px] p-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white border-gray-600"
            />
        );
    }
    return <span title={displayValue} className="text-gray-900 font-medium">{String(displayValue || "")}</span>;
};

