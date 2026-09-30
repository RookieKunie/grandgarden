import { supabase, isSupabaseReady } from "./lib/supabaseClient";
import React, { useState, useEffect, useMemo } from "react";
import {
  Home, LogOut, Wallet, AlertTriangle, Receipt, Bell, Wrench, Users,
  LayoutDashboard, Settings as Cog, Building2, CheckCircle2, Search, Plus, Edit3, Trash2, ShieldCheck, QrCode, Calculator, Check, X, DollarSign, Send, FileText, QrCode as ScanIcon, Key, Lock, Upload, TrendingUp, Award, Zap, RefreshCw, ShieldAlert, Shield, Copy, History, FileCheck, Sparkles
} from "lucide-react";

// ==========================================
// MODULE 1: CONFIGURATION & DEFAULTS (LOCKED)
// ==========================================
const DEFAULT_SETTINGS = {
  villageName: "หมู่บ้านกัลปพฤกษ์ แกรนด์ การ์เดนท์",
  ratePerSqw: 15,
  penaltyPct: 15,
  dunningFee: 500,
  dueDay: 7,
  systemStart: "2025-01",
};

const INITIAL_ADMIN_ACCOUNTS = [
  { id: "super_admin", label: "👑 Super Admin (ประธานหมู่บ้าน)", pass: "Boss@2026!" },
  { id: "office", label: "📋 Admin (เจ้าหน้าที่ธุรการ)", pass: "office1234" },
  { id: "accountant", label: "💰 Account (ฝ่ายบัญชี)", pass: "acc1234" },
  { id: "maintenance", label: "🔧 Maintenance (ช่างซ่อมบำรุง)", pass: "maint1234" },
  { id: "security", label: "🛡️ Security (รปภ. / รักษาความปลอดภัย)", pass: "sec1234" },
];

const INITIAL_ROLE_PERMISSIONS = {
  super_admin: { overview: true, houses: true, slips: true, finance: true, repairs: true, security: true, broadcast: true, settings: true },
  office: { overview: true, houses: true, slips: true, finance: false, repairs: true, security: false, broadcast: false, settings: false },
  accountant: { overview: false, houses: false, slips: false, finance: true, repairs: false, security: false, broadcast: false, settings: false },
  maintenance: { overview: false, houses: false, slips: false, finance: false, repairs: true, security: false, broadcast: false, settings: false },
  security: { overview: false, houses: false, slips: false, finance: false, repairs: false, security: true, broadcast: false, settings: false }
};

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fmt = (n) => r2(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GENERATED_HOUSES = Array.from({ length: 287 }, (_, index) => {
  const num = index + 1;
  return {
    id: num,
    houseNo: `399/${num}`,
    ownerName: num === 3 ? "คุณประธาน กรรมการ" : num === 50 ? "สุทิน กุลัดนาม" : `คุณลูกบ้าน ${num}`,
    phone: num === 1 ? "0812345678" : num === 2 ? "0898765432" : num === 3 ? "0811111111" : num === 50 ? "0816657276" : `08${String(num).padStart(8, '0')}`,
    area: num === 3 ? 80 : num === 50 ? 100 : 50,
    isPaidArrears: num === 2 || num === 3 || num === 50,
    isCommitteeDiscount: num === 3,
  };
});

const INITIAL_SLIPS = [
  { id: 1, houseNo: "399/1", amount: 10850, date: "2026-02-01", status: "รอตรวจสอบ", type: "ชำระหนี้เก่า" },
  { id: 2, houseNo: "399/50", amount: 21630.20, date: "2026-02-02", status: "อนุมัติแล้ว", type: "ชำระหนี้เก่า + ส่วนกลางปี 2569" }
];

const INITIAL_REPAIRS = [
  { id: 1, houseNo: "399/1", detail: "ไฟส่องสว่างหน้าบ้านดับ", status: "รอดำเนินการ", photo: "" },
  { id: 2, houseNo: "399/2", detail: "ท่อระบายน้ำอุดตันส่วนกลาง", status: "กำลังดำเนินการ", photo: "" }
];

// ==========================================
// MODULE 2: FINANCIAL CALCULATION CORE (FROZEN & LOCKED - EXACT 2 DECIMAL)
// ==========================================
function simulate(house, s, paymentDateStr) {
  const area = house.area || 50;
  const rate = Number(s.ratePerSqw) || 15;
  const monthlyBase = r2(area * rate);
  let annualFee = r2(monthlyBase * 12);
  
  if (house.isCommitteeDiscount) {
    annualFee = r2(annualFee * 0.5);
  }

  const deadline = new Date("2026-02-07");
  const payDate = new Date(paymentDateStr);
  const isEarlyBird = payDate <= deadline;

  const fullYearNet = isEarlyBird ? r2(annualFee * 0.95) : annualFee;
  const halfYearNet = isEarlyBird ? r2((monthlyBase * (house.isCommitteeDiscount ? 3 : 6)) * 0.98) : r2(monthlyBase * (house.isCommitteeDiscount ? 3 : 6));
  const monthlyNet = house.isCommitteeDiscount ? r2(monthlyBase * 0.5) : monthlyBase;

  const principal2568 = annualFee;
  const pPct = Number(s.penaltyPct) >= 1 ? Number(s.penaltyPct) : 15;
  const penaltyRate = pPct / 100;
  const penalty2568 = r2(principal2568 * penaltyRate * 1);
  const dunningFeeVal = Number(s.dunningFee) || 500;
  const dunning2568 = r2(dunningFeeVal * 1);
  const subtotal2568 = r2(principal2568 + penalty2568 + dunning2568);

  const effectiveArrears = subtotal2568;

  return {
    annualFee,
    monthlyBase,
    fullYearNet,
    halfYearNet,
    monthlyNet,
    isEarlyBird,
    penaltyUsedPct: pPct,
    arrearsDetail: [
      { year: 2568, principal: principal2568, penalty: penalty2568, dunningFee: dunning2568, subtotal: effectiveArrears }
    ],
    dunningGrandTotal: effectiveArrears,
  };
}

function analyzePaymentIntent(acc, payAmount) {
  let rem = r2(Number(payAmount) || 0);
  const arrearsTotal = acc.dunningGrandTotal;

  const paidArrears = r2(Math.min(rem, arrearsTotal));
  rem = r2(rem - paidArrears);
  const arrearsFullyPaid = paidArrears >= arrearsTotal;

  let matchedIntent = "none";
  let shortfallInfo = null;

  if (arrearsFullyPaid && rem > 0) {
    if (rem >= acc.fullYearNet) {
      matchedIntent = "fullYear";
    } else if (rem >= acc.halfYearNet) {
      matchedIntent = "halfYear";
    }
  }

  const remainArrears = r2(arrearsTotal - paidArrears);

  return {
    paidArrears,
    arrearsFullyPaid,
    matchedIntent,
    remainArrears,
    shortfallInfo,
    isLocked: remainArrears > 0
  };
}

// ==========================================
// MODULE 3: AUTHENTICATION MODULE (LOGIN)
// ==========================================
function LoginPage({ onLogin, settings, houses, adminAccounts }) {
  const [tab, setTab] = useState("resident");
  const [houseNo, setHouseNo] = useState("399/1");
  const [pass, setPass] = useState("0812345678");
  const [adminRole, setAdminRole] = useState("super_admin");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (tab === "admin") {
      const targetAdmin = adminAccounts.find(a => a.id === adminRole);
      if (!targetAdmin) return;
      if (pass !== targetAdmin.pass) return setErr("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง");
      
      let name = targetAdmin.label;
      let isChairman = adminRole === "super_admin";
      return onLogin({ kind: "admin", name, role: adminRole, isChairman });
    } else {
      const found = houses.find(h => h.houseNo.trim().toLowerCase() === houseNo.trim().toLowerCase());
      if (!found) return setErr("ไม่พบข้อมูลบ้านเลขที่นี้ในระบบ");
      
      const registeredPhone = found.phone ? found.phone.trim() : "";
      if (registeredPhone && registeredPhone !== "-" && pass !== registeredPhone) {
        return setErr("เบอร์โทรศัพท์ (รหัสผ่าน) ไม่ถูกต้อง");
      }
      return onLogin({ kind: "resident", house: found });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-6 space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">{settings.villageName}</h2>
          <p className="text-sm text-slate-500">ระบบจัดการค่าส่วนกลาง (287 ยูนิต)</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-medium">
          <button onClick={() => { setTab("resident"); setErr(""); }} className={`flex-1 py-2 rounded-lg transition-all ${tab === "resident" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>ลูกบ้าน</button>
          <button onClick={() => { setTab("admin"); setErr(""); }} className={`flex-1 py-2 rounded-lg transition-all ${tab === "admin" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>เจ้าหน้าที่ / ผู้ดูแลระบบ</button>
        </div>
        {err && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-xl">{err}</div>}
        <div className="space-y-4">
          {tab === "resident" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 text-sm mb-1">บ้านเลขที่</label>
                <input type="text" value={houseNo} onChange={e => setHouseNo(e.target.value)} placeholder="เช่น 399/1" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">เบอร์โทรศัพท์ (รหัสผ่าน)</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="ระบุเบอร์โทรศัพท์" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 text-sm mb-1 font-medium">เลือกกลุ่มผู้ใช้งาน (5 กลุ่มสิทธิ์)</label>
                <select value={adminRole} onChange={e => setAdminRole(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white">
                  {adminAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">รหัสผ่าน</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
            </div>
          )}
          <button onClick={submit} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors">เข้าสู่ระบบ</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODULE 4: RESIDENT PORTAL MODULE (CUSTOMIZED HEADER)
// ==========================================
function ResidentApp({ session, settings, bankInfo, onLogout, updateHousePayment, addSlip, slips }) {
  const h = session.house;
  const [payDateStr, setPayDateStr] = useState("2026-02-02");
  const acc = useMemo(() => simulate(h, settings, payDateStr), [h, settings, payDateStr]);
  const [tab, setTab] = useState("home");
  const [simPayAmount, setSimPayAmount] = useState(() => r2(acc.dunningGrandTotal + acc.fullYearNet));
  const analysis = useMemo(() => analyzePaymentIntent(acc, simPayAmount), [acc, simPayAmount]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAmount, setUploadAmount] = useState(simPayAmount);
  const [uploadType, setUploadType] = useState("ชำระค่าส่วนกลางประจำปี 2569");

  const mySlips = useMemo(() => slips.filter(s => s.houseNo === h.houseNo), [slips, h.houseNo]);

  const copyToClipboard = (text, label) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        alert(`คัดลอก${label}สำเร็จ: ${text}`);
      }).catch(() => {
        fallbackCopyText(text, label);
      });
    } else {
      fallbackCopyText(text, label);
    }
  };

  const fallbackCopyText = (text, label) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert(`คัดลอก${label}สำเร็จ: ${text}`);
    } catch (err) {
      alert(`กรุณากดเลือกข้อความเพื่อคัดลอกด้วยตนเอง`);
    }
    document.body.removeChild(textArea);
  };

  const handleSubmitSlip = (e) => {
    e.preventDefault();
    const newSlip = {
      id: Date.now(),
      houseNo: h.houseNo,
      amount: r2(Number(uploadAmount)),
      date: new Date().toISOString().split('T')[0],
      status: "รอตรวจสอบ",
      type: uploadType
    };
    addSlip(newSlip);
    setShowUploadModal(false);
    alert("📤 ส่งสลิปให้เจ้าหน้าที่ตรวจสอบเรียบร้อยแล้ว!");
  };
  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto relative shadow-2xl flex flex-col justify-between font-sans">

<div className="w-full max-w-full overflow-hidden shadow-md rounded-b-2xl">
  {/* แถวที่ 1: ชื่อหมู่บ้าน (ล็อกไม่ให้ล้นจอ) */}
  <div className="bg-blue-950 px-3 py-2.5 flex justify-between items-center gap-2 font-bold w-full min-w-0">
    <h2 className="text-sm font-bold text-white tracking-wide truncate min-w-0 flex-1">{settings.villageName}</h2>
    <button onClick={onLogout} className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs flex items-center gap-1 font-normal shadow-sm shrink-0">
      <LogOut className="w-3 h-3" /> ออก
    </button>
  </div>

  {/* แถวที่ 2: บ้านเลขที่ และขนาดพื้นที่ */}
  <div className="bg-slate-900 text-slate-100 px-3 pt-2 pb-1 flex justify-between items-center text-xs font-semibold text-slate-200 w-full min-w-0 gap-2">
    <span className="truncate min-w-0 flex-1">บ้านเลขที่ {h.houseNo}</span>
    <span className="text-slate-400 font-normal shrink-0">[{h.area} ตารางวา]</span>
  </div>

  {/* แถวที่ 3: ชื่อเจ้าของบ้าน และอัตราค่าบริการ */}
  <div className="bg-slate-900 text-slate-100 px-3 pb-2 pt-1 flex justify-between items-center text-xs text-slate-400 border-t border-slate-800 w-full min-w-0 gap-2">
    <span className="truncate min-w-0 flex-1">เจ้าของ: <strong className="text-slate-200">{h.ownerName}</strong></span>
    <span className="shrink-0">[{settings.ratePerSqw || 15}.-/ตรว/เดือน]</span>
  </div>
</div>

      <div className="p-4 flex-1 space-y-4 overflow-y-auto">
        {tab === "home" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm text-center space-y-3">
              <h3 className="font-bold text-slate-800 text-base">ยอดแนะนำ (ชำระล่วงหน้าทั้งปี)</h3>
              <p className="text-3xl font-extrabold text-emerald-600">฿{fmt(acc.dunningGrandTotal + acc.fullYearNet)}</p>
              <p className="text-xs text-slate-500">รวมหนี้เก่าและส่วนกลางปี 2569 (ลด 5% สุทธิ)</p>
              
              <button onClick={() => setTab("bills")} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5" /> ไปหน้าชำระเงิน / คัดลอกยอด
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTab("bills")} className="p-4 bg-white border border-slate-200 rounded-2xl text-left shadow-sm hover:border-emerald-500">
                <Wallet className="w-6 h-6 text-emerald-600 mb-2" />
                <p className="font-bold text-sm text-slate-800">บิลของฉัน</p>
                <p className="text-xs text-slate-400">ตรวจสอบบิลและสลิป</p>
              </button>
              <button onClick={() => setTab("repair")} className="p-4 bg-white border border-slate-200 rounded-2xl text-left shadow-sm hover:border-emerald-500">
                <Wrench className="w-6 h-6 text-emerald-600 mb-2" />
                <p className="font-bold text-sm text-slate-800">แจ้งซ่อม</p>
                <p className="text-xs text-slate-400">แจ้งปัญหาในหมู่บ้าน</p>
              </button>
            </div>
          </div>
        )}

        {tab === "bills" && (
          <div className="space-y-4">
            <div className="bg-white border-2 border-emerald-500 rounded-2xl p-4 space-y-4 shadow-md">
              <div className="text-center border-b pb-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center justify-center gap-1 mx-auto w-max">
                  <Sparkles className="w-3.5 h-3.5" /> เลือกแพ็กเกจชำระเงินด่วน (Easy Pay)
                </span>
                <p className="text-xs text-slate-500 mt-1">แตะปุ่มด้านล่างเพื่อเลือกยอดที่ต้องการโอนได้ทันที</p>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => setSimPayAmount(r2(acc.dunningGrandTotal + acc.fullYearNet))}
                  className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${simPayAmount === r2(acc.dunningGrandTotal + acc.fullYearNet) ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div>
                    <p className="font-bold text-slate-800 text-xs">⭐ ชำระหนี้เก่า + ล่วงหน้าทั้งปี (ลด 5%)</p>
                    <p className="text-[10px] text-slate-500">คุ้มค่าที่สุด ประหยัดกว่า</p>
                  </div>
                  <span className="font-extrabold text-emerald-700 text-sm">฿{fmt(acc.dunningGrandTotal + acc.fullYearNet)}</span>
                </button>

                <button 
                  onClick={() => setSimPayAmount(r2(acc.dunningGrandTotal + acc.halfYearNet))}
                  className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${simPayAmount === r2(acc.dunningGrandTotal + acc.halfYearNet) ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div>
                    <p className="font-bold text-slate-800 text-xs">⭐ ชำระหนี้เก่า + ล่วงหน้า 6 เดือน (ลด 2%)</p>
                    <p className="text-[10px] text-slate-500">ทยอยชำระครึ่งปีแรก</p>
                  </div>
                  <span className="font-extrabold text-teal-700 text-sm">฿{fmt(acc.dunningGrandTotal + acc.halfYearNet)}</span>
                </button>

                <button 
                  onClick={() => setSimPayAmount(r2(acc.dunningGrandTotal))}
                  className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${simPayAmount === r2(acc.dunningGrandTotal) ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div>
                    <p className="font-bold text-slate-800 text-xs">🔒 ชำระเฉพาะหนี้เก่าปี 2568</p>
                    <p className="text-[10px] text-rose-600">จำเป็นต้องเคลียร์ก่อนเพื่อปลดล็อกสิทธิ์</p>
                  </div>
                  <span className="font-extrabold text-rose-700 text-sm">฿{fmt(acc.dunningGrandTotal)}</span>
                </button>
              </div>

              {/* Amount Input & Copy */}
              <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 space-y-2">
                <label className="block text-xs font-bold text-indigo-900">💰 ยอดเงินที่จะนำไปโอน (บาท):</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    value={simPayAmount} 
                    onChange={e => setSimPayAmount(e.target.value === "" ? "" : r2(e.target.value))} 
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-sm font-bold text-indigo-900 outline-none" 
                  />
                  <button onClick={() => copyToClipboard(simPayAmount, "ยอดเงิน")} className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-sm">
                    <Copy className="w-3.5 h-3.5" /> คัดลอกยอด
                  </button>
                </div>
              </div>

              {/* Waterfall Breakdown & Dynamically Corrected Discount Display */}
              <div className="space-y-3 text-xs">
                <p className="font-bold text-slate-700 border-b pb-1">📊 ตารางแจงยอดการหักเงินอัตโนมัติ (Waterfall):</p>
                
                {acc.arrearsDetail.map((r, idx) => {
                  const totalDue = r.dunningFee + r.penalty + r.principal;
                  const enteredPay = Number(simPayAmount) || 0;
                  const effectivePaid = Math.min(enteredPay, totalDue);

                  let rem = effectivePaid;
                  const paidDunning = Math.min(rem, r.dunningFee);
                  rem = Math.max(0, rem - paidDunning);

                  const paidPenalty = Math.min(rem, r.penalty);
                  rem = Math.max(0, rem - paidPenalty);

                  const paidPrincipal = Math.min(rem, r.principal);
                  const remainTotal = totalDue - effectivePaid;
                  const amountFor2569 = Math.max(0, enteredPay - totalDue);

                  const isFullYear = amountFor2569 >= acc.fullYearNet - 1;
                  const isHalfYear = !isFullYear && amountFor2569 >= acc.halfYearNet - 1;
                  const halfMonths = h.isCommitteeDiscount ? 3 : 6;
                  const halfYearBase = r2(acc.monthlyBase * halfMonths);

                  return (
                    <div key={idx} className="space-y-3">
                      {/* หนี้เก่าปี 2568 */}
                      <div className="bg-slate-50 p-3 rounded-xl border space-y-1.5 text-slate-700">
                        <div className="flex justify-between font-bold text-slate-900 border-b pb-1">
                          <span>หนี้เก่าปี 2568 (ยอดค้างรวม: ฿{fmt(totalDue)})</span>
                          <span>ชำระแล้ว: ฿{fmt(effectivePaid)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>· 1. หักค่าทวงถาม:</span>
                          <span className="font-bold text-emerald-700">฿{fmt(paidDunning)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>· 2. หักค่าปรับ 15%:</span>
                          <span className="font-bold text-emerald-700">฿{fmt(paidPenalty)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>· 3. หักค่าส่วนกลางค้างเก่า:</span>
                          <span className="font-bold text-emerald-700">฿{fmt(paidPrincipal)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1.5 font-bold text-rose-700">
                          <span>ยอดหนี้เก่าคงค้างสุทธิ:</span>
                          <span>฿{fmt(remainTotal > 0 ? remainTotal : 0)}</span>
                        </div>
                      </div>

                      {/* ยอดชำระล่วงหน้าปี 2569 */}
                      {enteredPay > totalDue && (
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1.5 text-slate-700">
                          <div className="flex justify-between font-bold text-emerald-900 border-b border-emerald-200 pb-1">
                            <span>ยอดชำระล่วงหน้าปี 2569</span>
                            <span>จำนวนเงิน: ฿{fmt(amountFor2569)}</span>
                          </div>

                          {isFullYear ? (
                            <>
                              <div className="flex justify-between">
                                <span>· ค่าส่วนกลางปี 2569 (เต็มปี):</span>
                                <span className="font-semibold text-slate-800">฿{fmt(acc.annualFee)}</span>
                              </div>
                              {acc.isEarlyBird && (
                                <div className="flex justify-between text-emerald-700">
                                  <span>· ส่วนลด Early Bird (ลด 5% สุทธิ):</span>
                                  <span className="font-semibold">-฿{fmt(acc.annualFee * 0.05)}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-bold text-emerald-800">
                                <span>สถานะปี 2569:</span>
                                <span>✓ ชำระล่วงหน้าเต็มปีเรียบร้อย</span>
                              </div>
                            </>
                          ) : isHalfYear ? (
                            <>
                              <div className="flex justify-between">
                                <span>· ค่าส่วนกลางปี 2569 (ล่วงหน้า {halfMonths} เดือน):</span>
                                <span className="font-semibold text-slate-800">฿{fmt(halfYearBase)}</span>
                              </div>
                              {acc.isEarlyBird && (
                                <div className="flex justify-between text-emerald-700">
                                  <span>· ส่วนลด Early Bird (ลด 2% สุทธิ):</span>
                                  <span className="font-semibold">-฿{fmt(halfYearBase * 0.02)}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-bold text-emerald-800">
                                <span>สถานะปี 2569:</span>
                                <span>✓ ชำระล่วงหน้า 6 เดือนเรียบร้อย</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>· ชำระสะสมเข้ากองทุนส่วนกลาง 2569:</span>
                                <span className="font-semibold text-slate-800">฿{fmt(amountFor2569)}</span>
                              </div>
                              <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-bold text-emerald-800">
                                <span>สถานะปี 2569:</span>
                                <span>ชำระบางส่วน (ยังไม่ครบแพ็กเกจส่วนลด)</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bank Info */}
              <div className="bg-slate-50 p-3.5 rounded-xl border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">กสิกรไทย กระแสรายวัน</span>
                  <button onClick={() => copyToClipboard(bankInfo.accountNo, "เลขบัญชี")} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <Copy className="w-3 h-3" /> คัดลอกเลขบัญชี ({bankInfo.accountNo})
                  </button>
                </div>
              </div>

              <button onClick={() => { setUploadAmount(simPayAmount); setShowUploadModal(true); }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5">
                <Upload className="w-4 h-4" /> โอนเงินแล้ว แจ้งสลิปเพื่อบันทึกเข้าระบบ
              </button>
            </div>

            {/* Slip History */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" /> ประวัติการส่งสลิป ({mySlips.length} รายการ)
              </h3>
              {mySlips.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-2">ยังไม่มีประวัติการส่งสลิป</p>
              ) : (
                <div className="space-y-2">
                  {mySlips.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800">฿{fmt(s.amount)} — {s.type}</p>
                        <p className="text-[10px] text-slate-500">วันที่แจ้ง: {s.date}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${s.status === 'อนุมัติแล้ว' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "repair" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">🔧 แจ้งซ่อมบำรุง</h3>
            <textarea rows={3} placeholder="ระบุรายละเอียดปัญหา..." className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500" />
            <button onClick={() => alert("ส่งเรื่องแจ้งซ่อมเรียบร้อย")} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">ส่งเรื่องแจ้งซ่อม</button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">📤 แจ้งโอนเงิน / แนบสลิป</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmitSlip} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">บ้านเลขที่</label>
                <input type="text" value={h.houseNo} disabled className="w-full px-3 py-2 bg-slate-100 border rounded-xl font-bold text-slate-700" />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">ยอดเงินที่โอน (บาท)</label>
                <input type="number" step="0.01" value={uploadAmount} onChange={e => setUploadAmount(r2(e.target.value))} className="w-full px-3 py-2 border rounded-xl font-bold text-indigo-700" required />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">เลือกรูปสลิปในมือถือ</label>
                <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center text-slate-500 bg-slate-50 cursor-pointer hover:border-emerald-500 font-bold">
                  📷 แตะเพื่อเลือกรูปสลิปจากอัลบั้ม
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm">ยืนยันการส่งสลิป</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <nav className="bg-white border-t border-slate-200 flex justify-around p-2 fixed bottom-0 max-w-md w-full shadow-lg">
        <button onClick={() => setTab("home")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "home" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Home className="w-4 h-4" /> หน้าหลัก</button>
        <button onClick={() => setTab("bills")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "bills" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Wallet className="w-4 h-4" /> บิลของฉัน</button>
        <button onClick={() => setTab("repair")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "repair" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Wrench className="w-4 h-4" /> แจ้งซ่อม</button>
      </nav>
    </div>
  );
}

// ==========================================
// MODULE 5: ADMIN DASHBOARD MODULE
// ==========================================
function AdminApp({ session, settings, setSettings, bankInfo, setBankInfo, houses, setHouses, slips, setSlips, repairs, setRepairs, adminAccounts, setAdminAccounts, rolePermissions, setRolePermissions, onLogout }) {
  const role = session.role;
  const currentPermissions = rolePermissions[role] || {};

  const defaultTab = useMemo(() => {
    if (currentPermissions.overview) return "overview";
    if (currentPermissions.houses) return "houses";
    if (currentPermissions.slips) return "slips";
    if (currentPermissions.finance) return "finance";
    if (currentPermissions.repairs) return "repairs";
    if (currentPermissions.security) return "security";
    if (currentPermissions.broadcast) return "broadcast";
    if (currentPermissions.settings) return "settings";
    return "overview";
  }, [currentPermissions]);

  const [adminTab, setAdminTab] = useState(defaultTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [editingHouse, setEditingHouse] = useState(null);

  const stats = useMemo(() => {
    let totalUnits = houses.length;
    let lockedCount = houses.filter(h => !h.isPaidArrears).length;
    let totalArrearsExpected = houses.reduce((sum, h) => {
      const sim = simulate(h, settings, "2026-02-02");
      return sum + sim.dunningGrandTotal;
    }, 0);
    return { totalUnits, lockedCount, totalArrearsExpected };
  }, [houses, settings]);

  const filteredHouses = houses.filter(h => h.houseNo.includes(searchTerm) || h.ownerName.includes(searchTerm));

  const handleOpenEditModal = (house) => {
    if (!currentPermissions.houses) return alert("❌ ปฏิเสธสิทธิ์");
    setEditingHouse({ ...house });
  };

  const handleSaveEditHouse = (e) => {
    e.preventDefault();
    if (!editingHouse) return;
    setHouses(houses.map(h => h.id === editingHouse.id ? editingHouse : h));
    alert(`อัปเดตข้อมูลบ้านสำเร็จ`);
    setEditingHouse(null);
  };

  const handleDeleteHouse = (id) => {
    if (role !== "super_admin") return alert("❌ เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์ลบข้อมูลบ้าน");
    if (confirm("⚠️ ต้องการลบข้อมูลบ้านหลังนี้ออกจากระบบใช่หรือไม่?")) {
      setHouses(houses.filter(h => h.id !== id));
      alert("ลบข้อมูลบ้านสำเร็จ");
    }
  };

  const handleTogglePermission = (targetRole, permKey) => {
    if (role !== "super_admin") return;
    setRolePermissions(prev => ({
      ...prev,
      [targetRole]: {
        ...prev[targetRole],
        [permKey]: !prev[targetRole][permKey]
      }
    }));
  };

  const handleApproveSlip = (slipId, houseNo) => {
    if (!currentPermissions.slips) return alert("❌ ปฏิเสธสิทธิ์");
    setSlips(slips.map(s => s.id === slipId ? { ...s, status: "อนุมัติแล้ว" } : s));
    setHouses(houses.map(h => h.houseNo === houseNo ? { ...h, isPaidArrears: true } : h));
    alert(`อนุมัติและปลดล็อกสิทธิ์บ้านเลขที่ ${houseNo} สำเร็จ!`);
  };

  const handleUpdateRepairStatus = (id, newStatus) => {
    if (!currentPermissions.repairs) return alert("❌ ปฏิเสธสิทธิ์");
    setRepairs(repairs.map(r => r.id === id ? { ...r, status: newStatus } : r));
    alert("อัปเดตสถานะงานซ่อมเรียบร้อย");
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 pb-20 font-sans relative">
      <div className="max-w-5xl mx-auto space-y-5">
        
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
              role === 'super_admin' ? 'bg-amber-400 text-slate-950' : 
              role === 'office' ? 'bg-sky-400 text-slate-950' : 
              role === 'accountant' ? 'bg-emerald-400 text-slate-950' : 
              role === 'maintenance' ? 'bg-orange-400 text-slate-950' : 'bg-purple-400 text-slate-950'
            }`}>
              {session.name}
            </span>
            <h2 className="text-xl font-bold mt-1.5">ระบบบริหารจัดการ {settings.villageName} ({houses.length} ยูนิต)</h2>
          </div>
          <button onClick={onLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold overflow-x-auto gap-1">
          {currentPermissions.overview && (
            <button onClick={() => setAdminTab("overview")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "overview" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>📊 ภาพรวมโครงการ</button>
          )}
          {currentPermissions.houses && (
            <button onClick={() => setAdminTab("houses")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "houses" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>🏠 ทะเบียนหลังคาเรือน</button>
          )}
          {currentPermissions.slips && (
            <button onClick={() => setAdminTab("slips")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "slips" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>🧾 ตรวจสอบสลิป</button>
          )}
          {currentPermissions.finance && (
            <button onClick={() => setAdminTab("finance")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "finance" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>💰 รายงานการเงิน & จัดการต้นทุน</button>
          )}
          {currentPermissions.repairs && (
            <button onClick={() => setAdminTab("repairs")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "repairs" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>🔧 บริหารงานแจ้งซ่อม</button>
          )}
          {currentPermissions.security && (
            <button onClick={() => setAdminTab("security")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "security" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>🛡️ สแกน QR (Visitor Pass)</button>
          )}
          {currentPermissions.broadcast && (
            <button onClick={() => setAdminTab("broadcast")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "broadcast" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>📢 ประกาศหมู่บ้าน</button>
          )}
          {currentPermissions.settings && (
            <button onClick={() => setAdminTab("settings")} className={`py-2.5 px-3 rounded-xl transition-all ${adminTab === "settings" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>⚙️ ตั้งค่าระบบ & สิทธิ์</button>
          )}
        </div>

        {/* Tab 1: Overview */}
        {adminTab === "overview" && currentPermissions.overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <p className="text-xs text-slate-500 font-medium">จำนวนยูนิตทั้งหมดในระบบ</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalUnits} <span className="text-sm font-normal text-slate-400">หลังคาเรือน</span></p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <p className="text-xs text-slate-500 font-medium">บ้านที่ถูกล็อกสิทธิ์ (ค้างหนี้เก่า)</p>
                <p className="text-3xl font-bold text-rose-600">{stats.lockedCount} <span className="text-sm font-normal text-slate-400">ยูนิต</span></p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <p className="text-xs text-slate-500 font-medium">ยอดหนี้เก่าค้างรวม (เป้าหมายเรียกเก็บ)</p>
                <p className="text-3xl font-bold text-emerald-600">฿{fmt(stats.totalArrearsExpected)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Houses */}
        {adminTab === "houses" && currentPermissions.houses && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">รายชื่อหลังคาเรือนทั้งหมด ({houses.length} ยูนิต)</h3>
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type="text" placeholder="ค้นหาบ้านเลขที่ / ชื่อ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs outline-none" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-3">บ้านเลขที่</th>
                    <th className="p-3">เจ้าของบ้าน</th>
                    <th className="p-3">เบอร์โทร (รหัสผ่าน)</th>
                    <th className="p-3">พื้นที่ (ตร.ว.)</th>
                    <th className="p-3">สถานะหนี้เก่า</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHouses.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{h.houseNo}</td>
                      <td className="p-3 text-slate-700 font-semibold">{h.ownerName}</td>
                      <td className="p-3 text-slate-600 font-mono">{h.phone || "-"}</td>
                      <td className="p-3 text-slate-600">{h.area} ตร.ว.</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.isPaidArrears ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {h.isPaidArrears ? '✓ ชำระแล้ว' : '🔒 ค้างชำระ'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        <button onClick={() => handleOpenEditModal(h)} title="แก้ไขข้อมูล" className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg inline-flex items-center"><Edit3 className="w-3.5 h-3.5" /></button>
                        {role === "super_admin" && (
                          <button onClick={() => handleDeleteHouse(h.id)} title="ลบข้อมูลบ้าน" className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg inline-flex items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Slips */}
        {adminTab === "slips" && currentPermissions.slips && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">🧾 รายการสลิปโอนเงินรอตรวจสอบ ({slips.length} รายการ)</h3>
            <div className="space-y-3">
              {slips.map((s) => (
                <div key={s.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">บ้านเลขที่ {s.houseNo} — โอนเงิน ฿{fmt(s.amount)}</p>
                    <p className="text-slate-500">ประเภท: {s.type} | วันที่: {s.date}</p>
                    <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] mt-1">{s.status}</span>
                  </div>
                  {s.status === "รอตรวจสอบ" ? (
                    <button onClick={() => handleApproveSlip(s.id, s.houseNo)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1 shadow-sm">
                      <Check className="w-4 h-4" /> อนุมัติและปลดล็อก
                    </button>
                  ) : (
                    <span className="text-emerald-600 font-bold">✓ อนุมัติแล้ว</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Finance */}
        {adminTab === "finance" && currentPermissions.finance && (
          <div className="space-y-4">
            <div className="bg-emerald-700 text-white p-5 rounded-2xl shadow-md space-y-2">
              <h3 className="text-lg font-bold">รายงานการเงิน & ควบคุมต้นทุนประหยัด</h3>
              <p className="text-xs text-emerald-100">ยอดรับชำระตรงเข้าบัญชีกสิกรไทยกระแสรายวัน 134-1-40037-2 (100% ไม่เสียค่าธรรมเนียมเปอร์เซ็นต์)</p>
            </div>
          </div>
        )}

        {/* Tab 5: Repairs */}
        {adminTab === "repairs" && currentPermissions.repairs && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">🔧 รายการแจ้งซ่อมบำรุง</h3>
            <div className="space-y-3">
              {repairs.map((r) => (
                <div key={r.id} className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">บ้านเลขที่ {r.houseNo}</p>
                    <p className="text-slate-600 mt-0.5">{r.detail}</p>
                  </div>
                  <select value={r.status} onChange={e => handleUpdateRepairStatus(r.id, e.target.value)} className="px-3 py-1.5 bg-white border rounded-lg font-bold text-slate-700">
                    <option value="รอดำเนินการ">รอดำเนินการ</option>
                    <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                    <option value="ซ่อมเสร็จแล้ว">ซ่อมเสร็จแล้ว</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Security */}
        {adminTab === "security" && currentPermissions.security && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
            <h3 className="font-bold text-slate-800 text-sm">🛡️ ระบบสแกน QR Code (Visitor Pass)</h3>
            <div className="max-w-xs mx-auto p-6 bg-slate-50 rounded-2xl border border-dashed space-y-3">
              <ScanIcon className="w-12 h-12 text-emerald-600 mx-auto" />
              <input type="text" placeholder="ระบุรหัส QR Pass..." value={scanCode} onChange={e => setScanCode(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs text-center" />
              <button onClick={() => alert("ตรวจสอบสิทธิ์สำเร็จ")} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">ตรวจสอบ</button>
            </div>
          </div>
        )}

        {/* Tab 7: Broadcast */}
        {adminTab === "broadcast" && currentPermissions.broadcast && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">📢 ส่งประกาศสำคัญถึงลูกบ้าน</h3>
            <textarea rows={4} placeholder="พิมพ์ข้อความประกาศ..." value={broadcastText} onChange={e => setBroadcastText(e.target.value)} className="w-full p-3 border rounded-xl text-xs outline-none" />
            <button onClick={() => { alert("ส่งประกาศเรียบร้อย"); setBroadcastText(""); }} className="py-2.5 px-5 bg-emerald-600 text-white font-bold rounded-xl text-xs">ส่งประกาศทันที</button>
          </div>
        )}

        {/* Tab 8: Settings & RBAC */}
        {adminTab === "settings" && currentPermissions.settings && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" /> Module กำหนดสิทธิ์ผู้ใช้งาน (Role-Based Access Control)
              </h3>
              {role === "super_admin" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">กลุ่มผู้ใช้งาน</th>
                        <th className="p-2.5 text-center">ภาพรวม</th>
                        <th className="p-2.5 text-center">ทะเบียนบ้าน</th>
                        <th className="p-2.5 text-center">สลิป</th>
                        <th className="p-2.5 text-center">การเงิน</th>
                        <th className="p-2.5 text-center">แจ้งซ่อม</th>
                        <th className="p-2.5 text-center">รปภ.</th>
                        <th className="p-2.5 text-center">ประกาศ</th>
                        <th className="p-2.5 text-center">ตั้งค่า</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.keys(rolePermissions).map((rKey) => {
                        const perm = rolePermissions[rKey];
                        const labelName = adminAccounts.find(a => a.id === rKey)?.label || rKey;
                        return (
                          <tr key={rKey} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{labelName}</td>
                            {Object.keys(perm).map((pKey) => (
                              <td key={pKey} className="p-2.5 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={perm[pKey]} 
                                  onChange={() => handleTogglePermission(rKey, pKey)} 
                                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                                  disabled={rKey === "super_admin" && pKey === "settings"} 
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl">⚠️ เฉพาะ Super Admin เท่านั้นที่กำหนดสิทธิ์ได้</div>
              )}
            </div>
          </div>
        )}

      </div>

      {editingHouse && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 text-sm">✏️ แก้ไขข้อมูลบ้าน: {editingHouse.houseNo}</h3>
            <form onSubmit={handleSaveEditHouse} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">ชื่อเจ้าของบ้าน</label>
                <input type="text" value={editingHouse.ownerName} onChange={e => setEditingHouse({ ...editingHouse, ownerName: e.target.value })} className="w-full px-3 py-2 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">เบอร์โทรศัพท์ (รหัสผ่านลูกบ้าน)</label>
                <input type="text" value={editingHouse.phone} onChange={e => setEditingHouse({ ...editingHouse, phone: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">ขนาดพื้นที่ (ตารางวา)</label>
                <input type="number" step="0.1" value={editingHouse.area} onChange={e => setEditingHouse({ ...editingHouse, area: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="editPaid" checked={editingHouse.isPaidArrears} onChange={e => setEditingHouse({ ...editingHouse, isPaidArrears: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded accent-emerald-600" />
                <label htmlFor="editPaid" className="text-slate-700 font-medium cursor-pointer">ชำระหนี้เก่าปี 2568 เรียบร้อยแล้ว (ปลดล็อกสิทธิ์)</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editComm" checked={editingHouse.isCommitteeDiscount} onChange={e => setEditingHouse({ ...editingHouse, isCommitteeDiscount: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded accent-emerald-600" />
                <label htmlFor="editComm" className="text-slate-700 font-medium cursor-pointer">บ้านกรรมการ (ได้รับส่วนลดค่าส่วนกลาง 50%)</label>
              </div>
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setEditingHouse(null)} className="flex-1 py-2 bg-slate-200 font-bold rounded-xl">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODULE 6: ROOT APP & SUPABASE SYNC (NEW)
// ==========================================
// --- ตัวแปลงข้อมูล: Supabase row -> House object ที่ Module เดิมเข้าใจ ---
const mapRowToHouse = (row, idx) => ({
  id: row.id,
  houseNo: String(row.unit_number ?? "").trim(), // ดึงจาก unit_number โดยตรง
  ownerName: row.owner_name ?? "-",             // ดึงจาก owner_name
  phone: String(row.phone ?? "").trim(),        // ดึงจาก phone
  area: Number(row.area_sq_wah ?? 50),          // ดึงจาก area_sq_wah
  isCommitteeDiscount: Boolean(row.is_committee),
  isPaidArrears: Boolean(row.is_paid_arrears ?? (Number(row.total_debt ?? 0) <= 0)),
});

// ฟังก์ชันจัดเรียงบ้านเลขที่ตามตัวเลขจริง (ป้องกัน 399/10 ขึ้นมาก่อน 399/2)
const sortByUnit = (list) =>
  [...list].sort((a, b) => {
    const na = parseInt(String(a.houseNo).split("/").pop(), 10) || 0;
    const nb = parseInt(String(b.houseNo).split("/").pop(), 10) || 0;
    return na - nb;
  });

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  // --- ค่าตั้งค่าระบบ / สิทธิ์ ยังเก็บใน localStorage ตามเดิม (ไม่กระทบของเก่า) ---
  const [settings, setSettings] = useState(() => {
    try { const s = localStorage.getItem("village_settings"); return s ? JSON.parse(s) : DEFAULT_SETTINGS; } catch (e) { return DEFAULT_SETTINGS; }
  });
  const [rolePermissions, setRolePermissions] = useState(() => {
    try { const s = localStorage.getItem("village_role_permissions"); return s ? JSON.parse(s) : INITIAL_ROLE_PERMISSIONS; } catch (e) { return INITIAL_ROLE_PERMISSIONS; }
  });
  const [adminAccounts, setAdminAccounts] = useState(INITIAL_ADMIN_ACCOUNTS);

  // --- ข้อมูลหลัก: ดึงจาก Supabase ---
  const [houses, setHouses] = useState([]);
  const [slips, setSlips] = useState(INITIAL_SLIPS);
  const [repairs, setRepairs] = useState(INITIAL_REPAIRS);

  // โหลดข้อมูลบ้านจากตาราง residents_debt
  useEffect(() => {
    const loadHouses = async () => {
      if (!isSupabaseReady) {
        setDbError("ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
        setHouses(GENERATED_HOUSES);   // fallback กันจอขาว
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("residents_debt")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        setDbError(error.message);
        setHouses(GENERATED_HOUSES);   // fallback
      } else if (data && data.length > 0) {
        setHouses(sortByUnit(data.map(mapRowToHouse)));
      } else {
        setHouses(GENERATED_HOUSES);
      }
      setLoading(false);
    };
    loadHouses();
  }, []);

  // โหลดสลิป (ถ้ายังไม่มีตาราง slips จะข้ามไปเงียบๆ ไม่พัง)
  useEffect(() => {
    if (!isSupabaseReady) return;
    (async () => {
      const { data, error } = await supabase.from("slips").select("*").order("id", { ascending: false });
      if (!error && data) {
        setSlips(data.map(r => ({
          id: r.id, houseNo: r.house_no ?? r.houseNo, amount: Number(r.amount),
          date: r.date, status: r.status, type: r.type
        })));
      }
    })();
  }, []);

  useEffect(() => { try { localStorage.setItem("village_settings", JSON.stringify(settings)); } catch (e) {} }, [settings]);
  useEffect(() => { try { localStorage.setItem("village_role_permissions", JSON.stringify(rolePermissions)); } catch (e) {} }, [rolePermissions]);

  // --- เขียนกลับ Supabase (ปลดล็อกสิทธิ์) ---
  const updateHousePayment = async (houseNo, isPaid) => {
    setHouses(prev => prev.map(h => h.houseNo === houseNo ? { ...h, isPaidArrears: isPaid } : h));
    if (isSupabaseReady) {
      await supabase.from("residents_debt").update({ is_paid_arrears: isPaid }).eq("house_no", houseNo);
    }
  };

  // --- เพิ่มสลิปใหม่ ---
  const addSlip = async (newSlip) => {
    setSlips(prev => [newSlip, ...prev]);
    if (isSupabaseReady) {
      await supabase.from("slips").insert({
        house_no: newSlip.houseNo, amount: newSlip.amount,
        date: newSlip.date, status: newSlip.status, type: newSlip.type
      });
    }
  };

  // --- Wrapper: ให้ AdminApp แก้ข้อมูลบ้านแล้ว sync ขึ้น Supabase อัตโนมัติ ---
  const setHousesSync = (next) => {
    const newList = typeof next === "function" ? next(houses) : next;
    setHouses(newList);
    if (!isSupabaseReady) return;
    newList.forEach(h => {
      const old = houses.find(o => o.houseNo === h.houseNo);
      if (!old) return;
      if (old.ownerName !== h.ownerName || old.phone !== h.phone ||
          old.area !== h.area || old.isPaidArrears !== h.isPaidArrears ||
          old.isCommitteeDiscount !== h.isCommitteeDiscount) {
        supabase.from("residents_debt").update({
          owner_name: h.ownerName, phone: h.phone, area: h.area,
          is_paid_arrears: h.isPaidArrears, is_committee_discount: h.isCommitteeDiscount
        }).eq("house_no", h.houseNo).then(() => {});
      }
    });
  };

  const setSlipsSync = (next) => {
    const newList = typeof next === "function" ? next(slips) : next;
    setSlips(newList);
    if (!isSupabaseReady) return;
    newList.forEach(s => {
      const old = slips.find(o => o.id === s.id);
      if (old && old.status !== s.status) {
        supabase.from("slips").update({ status: s.status }).eq("id", s.id).then(() => {});
      }
    });
  };

  const handleLogin = (sessData) => setSession({ ...sessData, adminAccountsList: adminAccounts });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <RefreshCw className="w-8 h-8 text-emerald-600 mx-auto animate-spin" />
          <p className="text-sm text-slate-600 font-bold">กำลังเชื่อมต่อฐานข้อมูล...</p>
        </div>
      </div>
    );
  }

  const bank = { bankName: "กสิกรไทย (KBank)", accountNo: "134-1-40037-2" };

  return (
    <>
      {dbError && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-[11px] px-3 py-1.5 text-center font-bold">
          ⚠️ ใช้ข้อมูลสำรองชั่วคราว: {dbError}
        </div>
      )}
      {!session ? (
        <LoginPage onLogin={handleLogin} settings={settings} houses={houses} adminAccounts={adminAccounts} />
      ) : session.kind === "admin" ? (
        <AdminApp
          session={{ ...session, adminAccountsList: adminAccounts }}
          settings={settings} setSettings={setSettings}
          bankInfo={bank} setBankInfo={setSettings}
          houses={houses} setHouses={setHousesSync}
          slips={slips} setSlips={setSlipsSync}
          repairs={repairs} setRepairs={setRepairs}
          adminAccounts={adminAccounts} setAdminAccounts={setAdminAccounts}
          rolePermissions={rolePermissions} setRolePermissions={setRolePermissions}
          onLogout={() => setSession(null)}
        />
      ) : (
        <ResidentApp
          session={session} settings={settings} bankInfo={bank}
          onLogout={() => setSession(null)}
          updateHousePayment={updateHousePayment}
          addSlip={addSlip} slips={slips}
        />
      )}
    </>
  );
}