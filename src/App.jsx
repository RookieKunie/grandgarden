import React, { useState, useEffect, useMemo } from "react";
import {
  Home, LogOut, Wallet, AlertTriangle, Receipt, Bell, Wrench, Users,
  LayoutDashboard, Settings as Cog, Building2, CheckCircle2, Search, Plus, Edit3, Trash2, ShieldCheck, QrCode, Calculator, Check, X, DollarSign, Send, FileText, QrCode as ScanIcon, Key, Lock, Upload, TrendingUp, Award, Zap, RefreshCw, ShieldAlert, Shield, Copy, History, FileCheck, Sparkles
} from "lucide-react";

import { supabase } from "./lib/supabaseClient";
import ArrearsGrid from "./pages/ArrearsGrid";
import Payments from "./pages/Payments";
import { supabase } from "./lib/supabaseClient";

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
    phone: num === 1 ? "**********" : num === 2 ? "**********" : num === 3 ? "**********" : num === 50 ? "**********" : `08${String(num).padStart(8, '0')}`,
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
// MODULE 2: FINANCIAL CALCULATION CORE
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
  const [pass, setPass] = useState("");
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
      
      const registeredPhone = found.phone ? String(found.phone).trim() : "";
      if (registeredPhone && registeredPhone !== "-" && registeredPhone !== "**********" && pass !== registeredPhone) {
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
          <p className="text-sm text-slate-500">ระบบจัดการค่าส่วนกลาง</p>
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
// MODULE 4: RESIDENT PORTAL MODULE
// ==========================================
function ResidentApp({ session, settings, bankInfo, onLogout, addSlip, slips }) {
  const h = session.house;
  const [payDateStr, setPayDateStr] = useState("2026-02-02");
  const acc = useMemo(() => simulate(h, settings, payDateStr), [h, settings, payDateStr]);
  const [tab, setTab] = useState("home");
  const [simPayAmount, setSimPayAmount] = useState(() => r2(acc.dunningGrandTotal + acc.fullYearNet));

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAmount, setUploadAmount] = useState(simPayAmount);
  const [uploadType, setUploadType] = useState("ชำระค่าส่วนกลางประจำปี 2569");

  const mySlips = useMemo(() => slips.filter(s => s.houseNo === h.houseNo), [slips, h.houseNo]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(String(text)).then(() => {
      alert(`คัดลอก${label}สำเร็จ: ${text}`);
    }).catch(() => {
      alert(`คัดลอกไม่สำเร็จ`);
    });
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
        <div className="bg-blue-950 px-3 py-2.5 flex justify-between items-center gap-2 font-bold w-full min-w-0">
          <h2 className="text-sm font-bold text-white tracking-wide truncate min-w-0 flex-1">{settings.villageName}</h2>
          <button onClick={onLogout} className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs flex items-center gap-1 font-normal shadow-sm shrink-0">
            <LogOut className="w-3 h-3" /> ออก
          </button>
        </div>
        <div className="bg-slate-900 text-slate-100 px-3 pt-2 pb-1 flex justify-between items-center text-xs font-semibold text-slate-200 w-full min-w-0 gap-2">
          <span className="truncate min-w-0 flex-1">บ้านเลขที่ {h.houseNo}</span>
          <span className="text-slate-400 font-normal shrink-0">[{h.area} ตารางวา]</span>
        </div>
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
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => setSimPayAmount(r2(acc.dunningGrandTotal + acc.fullYearNet))}
                  className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${simPayAmount === r2(acc.dunningGrandTotal + acc.fullYearNet) ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div>
                    <p className="font-bold text-slate-800 text-xs">⭐ ชำระหนี้เก่า + ล่วงหน้าทั้งปี (ลด 5%)</p>
                  </div>
                  <span className="font-extrabold text-emerald-700 text-sm">฿{fmt(acc.dunningGrandTotal + acc.fullYearNet)}</span>
                </button>
              </div>

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
                    <Copy className="w-3.5 h-3.5" /> คัดลอก
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">กสิกรไทย กระแสรายวัน: {bankInfo.accountNo}</span>
                  <button onClick={() => copyToClipboard(bankInfo.accountNo, "เลขบัญชี")} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">คัดลอก</button>
                </div>
              </div>

              <button onClick={() => { setUploadAmount(simPayAmount); setShowUploadModal(true); }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5">
                <Upload className="w-4 h-4" /> แจ้งสลิปโอนเงิน
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" /> ประวัติการส่งสลิป ({mySlips.length} รายการ)
              </h3>
              {mySlips.map(s => (
                <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800">฿{fmt(s.amount)} — {s.type}</p>
                    <p className="text-[10px] text-slate-500">วันที่: {s.date}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${s.status === 'อนุมัติแล้ว' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "repair" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">🔧 แจ้งซ่อมบำรุง</h3>
            <textarea rows={3} placeholder="ระบุรายละเอียดปัญหา..." className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none" />
            <button onClick={() => alert("ส่งเรื่องแจ้งซ่อมเรียบร้อย")} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">ส่งเรื่องแจ้งซ่อม</button>
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">📤 แจ้งโอนเงิน / แนบสลิป</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmitSlip} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">ยอดเงินที่โอน (บาท)</label>
                <input type="number" step="0.01" value={uploadAmount} onChange={e => setUploadAmount(r2(e.target.value))} className="w-full px-3 py-2 border rounded-xl font-bold text-indigo-700" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-sm">ยืนยัน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <nav className="bg-white border-t border-slate-200 flex justify-around p-2 fixed bottom-0 max-w-md w-full shadow-lg">
        <button onClick={() => setTab("home")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "home" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Home className="w-4 h-4" /> หน้าหลัก</button>
        <button onClick={() => setTab("bills")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "bills" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Wallet className="w-4 h-4" /> บิล</button>
        <button onClick={() => setTab("repair")} className={`flex flex-col items-center text-[10px] gap-0.5 py-1 px-3 rounded-xl ${tab === "repair" ? "text-emerald-600 font-bold bg-emerald-50" : "text-slate-400"}`}><Wrench className="w-4 h-4" /> แจ้งซ่อม</button>
      </nav>
    </div>
  );
}

// ==========================================
// MODULE 5: ADMIN DASHBOARD MODULE
// ==========================================
function AdminApp({ session, settings, houses, setHouses, slips, setSlips, repairs, setRepairs, adminAccounts, rolePermissions, setRolePermissions, onLogout }) {
  const role = session.role;
  const currentPermissions = rolePermissions[role] || {};

  const [adminTab, setAdminTab] = useState("houses");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingHouse, setEditingHouse] = useState(null);

  const stats = useMemo(() => {
    let totalUnits = houses.length;
    let lockedCount = houses.filter(h => !h.isPaidArrears).length;
    let totalArrearsExpected = houses.reduce((sum, h) => sum + simulate(h, settings, "2026-02-02").dunningGrandTotal, 0);
    return { totalUnits, lockedCount, totalArrearsExpected };
  }, [houses, settings]);

  const filteredHouses = houses.filter(h => h.houseNo.includes(searchTerm) || (h.ownerName && h.ownerName.includes(searchTerm)));

  const handleSaveEditHouse = (e) => {
    e.preventDefault();
    if (!editingHouse) return;
    setHouses(houses.map(h => h.id === editingHouse.id ? editingHouse : h));
    alert("อัปเดตข้อมูลสำเร็จ");
    setEditingHouse(null);
  };

  const handleApproveSlip = (slipId, houseNo) => {
    setSlips(slips.map(s => s.id === slipId ? { ...s, status: "อนุมัติแล้ว" } : s));
    setHouses(houses.map(h => h.houseNo === houseNo ? { ...h, isPaidArrears: true } : h));
    alert(`อนุมัติและปลดล็อกบ้าน ${houseNo} สำเร็จ`);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 pb-20 font-sans relative">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-md">
          <div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 uppercase">{session.name}</span>
            <h2 className="text-xl font-bold mt-1.5">ระบบบริหารจัดการ {settings.villageName} ({houses.length} ยูนิต) [Supabase Live]</h2>
          </div>
          <button onClick={onLogout} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><LogOut className="w-4 h-4" /> ออกจากระบบ</button>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border text-xs font-bold gap-1 overflow-x-auto">
          <button onClick={() => setAdminTab("overview")} className={`py-2 px-4 rounded-xl ${adminTab === "overview" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>📊 ภาพรวม</button>
          <button onClick={() => setAdminTab("houses")} className={`py-2 px-4 rounded-xl ${adminTab === "houses" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>🏠 ทะเบียนบ้าน</button>
          <button onClick={() => setAdminTab("slips")} className={`py-2 px-4 rounded-xl ${adminTab === "slips" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>🧾 ตรวจสลิป</button>
        </div>

        {adminTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs text-slate-500">ยูนิตทั้งหมด</p><p className="text-3xl font-bold text-slate-800">{stats.totalUnits}</p></div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs text-slate-500">บ้านถูกล็อกสิทธิ์</p><p className="text-3xl font-bold text-rose-600">{stats.lockedCount}</p></div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-xs text-slate-500">ยอดหนี้ค้างรวม</p><p className="text-3xl font-bold text-emerald-600">฿{fmt(stats.totalArrearsExpected)}</p></div>
          </div>
        )}

        {adminTab === "houses" && (
          <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">รายชื่อหลังคาเรือนจาก Supabase ({houses.length} ยูนิต)</h3>
              <input type="text" placeholder="ค้นหา..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border rounded-xl text-xs" />
            </div>
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-3">บ้านเลขที่</th>
                    <th className="p-3">เจ้าของบ้าน</th>
                    <th className="p-3">เบอร์โทร</th>
                    <th className="p-3">พื้นที่ (ตร.ว.)</th>
                    <th className="p-3">สถานะหนี้</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredHouses.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{h.houseNo}</td>
                      <td className="p-3 font-semibold">{h.ownerName}</td>
                      <td className="p-3 font-mono">{h.phone}</td>
                      <td className="p-3">{h.area}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.isPaidArrears ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{h.isPaidArrears ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                      <td className="p-3 text-right"><button onClick={() => setEditingHouse({ ...h })} className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {adminTab === "slips" && (
          <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">🧾 รายการสลิปรอตรวจสอบ</h3>
            {slips.map((s) => (
              <div key={s.id} className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center text-xs">
                <div><p className="font-bold text-sm">บ้านเลขที่ {s.houseNo} — ฿{fmt(s.amount)}</p><span className="text-amber-700 font-bold">{s.status}</span></div>
                {s.status === "รอตรวจสอบ" && <button onClick={() => handleApproveSlip(s.id, s.houseNo)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold">อนุมัติ</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingHouse && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-sm">✏️ แก้ไขข้อมูลบ้าน: {editingHouse.houseNo}</h3>
            <form onSubmit={handleSaveEditHouse} className="space-y-3 text-xs">
              <input type="text" value={editingHouse.ownerName} onChange={e => setEditingHouse({ ...editingHouse, ownerName: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
              <input type="text" value={editingHouse.phone} onChange={e => setEditingHouse({ ...editingHouse, phone: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setEditingHouse(null)} className="flex-1 py-2 bg-slate-200 rounded-xl">ยกเลิก</button><button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl">บันทึก</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODULE 6: ROOT APP & SUPABASE SYNC
// ==========================================
export default function App() {
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rolePermissions, setRolePermissions] = useState(INITIAL_ROLE_PERMISSIONS);
  const [adminAccounts] = useState(INITIAL_ADMIN_ACCOUNTS);
  const [houses, setHouses] = useState(GENERATED_HOUSES);
  const [slips, setSlips] = useState(INITIAL_SLIPS);
  const [repairs, setRepairs] = useState(INITIAL_REPAIRS);

  // ดึงข้อมูลจริงจาก Supabase ตาราง residents_debt ทันทีเมื่อเปิดเว็บ
  useEffect(() => {
    async function fetchSupabaseData() {
      try {
        const { data, error } = await supabase.from("residents_debt").select("*");
        if (!error && data && data.length > 0) {
          const mapped = data.map((item, index) => ({
            id: item.id || (index + 1),
            houseNo: item.unit_number || `399/${index + 1}`,
            ownerName: item.owner_name || `คุณลูกบ้าน ${index + 1}`,
            phone: item.phone ? String(item.phone) : `08${String(index + 1).padStart(8, '0')}`,
            area: item.area_sq_wah || 50,
            isPaidArrears: false,
            isCommitteeDiscount: index === 2,
          }));
          setHouses(mapped);
        }
      } catch (err) {
        console.error("Supabase fetch error:", err);
      }
    }
    fetchSupabaseData();
  }, []);

  const addSlip = (newSync) => setSlips([newSync, ...slips]);
  const handleLogin = (sessData) => setSession(sessData);

  if (!session) return <LoginPage onLogin={handleLogin} settings={settings} houses={houses} adminAccounts={adminAccounts} />;
  return session.kind === "admin"
    ? <AdminApp session={session} settings={settings} houses={houses} setHouses={setHouses} slips={slips} setSlips={setSlips} repairs={repairs} setRepairs={repairs} adminAccounts={adminAccounts} rolePermissions={rolePermissions} setRolePermissions={setRolePermissions} onLogout={() => setSession(null)} />
    : <ResidentApp session={session} settings={settings} bankInfo={{ accountNo: "134-1-40037-2" }} onLogout={() => setSession(null)} addSlip={addSlip} slips={slips} />;
}