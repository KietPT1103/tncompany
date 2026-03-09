type ResultRowProps = {
  label: string;
  value: number;
  percent: number;
  bold?: boolean;
  highlight?: boolean;
};

export default function ResultRow({
  label,
  value,
  percent,
  bold = false,
  highlight = false,
}: ResultRowProps) {
  return (
    <tr
      className={`${bold ? "font-bold" : ""} ${
        highlight ? "bg-green-100" : ""
      }`}
    >
      <td className="border p-2">{label}</td>
      <td className="border p-2 text-right">
        {value.toLocaleString()}
      </td>
      <td className="border p-2 text-right">
        {percent.toFixed(2)}%
      </td>
    </tr>
  );
}
