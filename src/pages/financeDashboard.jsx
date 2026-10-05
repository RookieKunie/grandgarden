import React, { useMemo } from "react";
export default function FinanceDashboard({
houses = [],
slips = [],
}) {
const financeStats = useMemo(() => {
const totalUnits = houses.length;
const debtors = houses.filter(
h => !h.isPaidArrears
).length;
const committeeCount = houses.filter(
h => h.isCommitteeDiscount
).length;
const pendingSlips = slips.filter(
s => s.status === "รอตรวจสอบ"
).length;
const totalDebt = houses.reduce(
(sum, h) => sum + Number(h.totalDebt || 0),
0
);
return {
totalUnits,
debtors,
committeeCount,
pendingSlips,
totalDebt,
};

}, [houses, slips]);
return (
<div className="space-y-6">
<div>
<h2 className="text-2xl font-bold text-slate-800">
Finance Dashboard
</h2>
<p className="text-sm text-slate-500">
ภาพรวมสถานะทางการเงินของหมู่บ้าน
</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
<div className="bg-white border rounded-2xl p-5 shadow-sm">
<p className="text-xs text-slate-500">
ยอดหนี้รวม
</p>
<p className="text-3xl font-bold text-rose-700 mt-2">
฿{financeStats.totalDebt.toLocaleString("th-TH", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
})}
</p>
</div>
<div className="bg-white border rounded-2xl p-5 shadow-sm">
<p className="text-xs text-slate-500">
ยูนิตทั้งหมด
</p>
<p className="text-3xl font-bold text-slate-800 mt-2">
{financeStats.totalUnits}
</p>
</div>
<div className="bg-white border rounded-2xl p-5 shadow-sm">
<p className="text-xs text-slate-500">
ลูกหนี้ค้างชำระ
</p>
<p className="text-3xl font-bold text-rose-600 mt-2">
{financeStats.debtors}
</p>
</div>
<div className="bg-white border rounded-2xl p-5 shadow-sm">
<p className="text-xs text-slate-500">
กรรมการหมู่บ้าน
</p>
<p className="text-3xl font-bold text-emerald-600 mt-2">
{financeStats.committeeCount}
</p>
</div>
<div className="bg-white border rounded-2xl p-5 shadow-sm">
<p className="text-xs text-slate-500">
สลิปรอตรวจสอบ
</p>
<p className="text-3xl font-bold text-amber-600 mt-2">
{financeStats.pendingSlips}
</p>
</div>
</div>
<div className="bg-white border rounded-2xl p-6 shadow-sm">
<h3 className="text-xl font-bold text-slate-800 mb-4 leading-tight">
GrandGarden Finance Center
</h3>
<p className="text-sm text-slate-500">
</p>

<div className="space-y-2 text-sm">
<div className="text-emerald-600">Completed : Finance Dashboard</div>
<div className="text-emerald-600">Completed : Summary Cards</div>
<div className="text-amber-600">Pending : Annual Debt Ledger</div>
<div className="text-amber-600">Pending : Payment Allocation Audit</div>
</div>
<div className="bg-white rounded-2xl border shadow-sm p-6">
<h3 className="text-lg font-bold text-slate-800 mb-4">
ลูกหนี้ยอดสูงสุด
</h3>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="border-b">
<th className="text-left py-2">บ้านเลขที่</th>
<th className="text-left py-2">เจ้าของบ้าน</th>
<th className="text-right py-2">ยอดหนี้</th>
</tr>
</thead>
<tbody>
{houses
.sort((a,b)=>
(b.totalDebt || 0) -
(a.totalDebt || 0)
)
.slice(0,20)
.map((h)=>(
<tr
key={h.id}
className="border-b"
>
<td className="py-2">
{h.houseNo}
</td>
<td className="py-2">
{h.ownerName}
</td>
<td className="py-2 text-right font-bold text-rose-600">
฿{Number(h.totalDebt || 0).toLocaleString("th-TH", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
})}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
</div>
);
}
