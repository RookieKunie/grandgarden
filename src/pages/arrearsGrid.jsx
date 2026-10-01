import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_YEARS, EDITABLE_YEARS, CURRENT_YEAR_TH, baht } from '../lib/constants'
import { outstandingOf } from '../lib/debtEngine'
import { Search, Save } from 'lucide-react'

export default function ArrearsGrid() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [editUnit, setEditUnit] = useState(null)
  const [draft, setDraft] = useState([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('debt_year_detail').select('*').order('unit_number').order('fiscal_year')
    setRows(data || [])
    setLoading(false)
  }

  const units = useMemo(() => {
    const map = {}
    for (const r of rows) {
      map[r.unit_number] ??= { unit_number: r.unit_number, years: {}, total: 0 }
      map[r.unit_number].years[r.fiscal_year] = r
      map[r.unit_number].total += Math.max(outstandingOf(r), 0)
    }
    return Object.values(map).filter(u => u.unit_number.toLowerCase().includes(q.toLowerCase()))
  }, [rows, q])

  function openEdit(unit) {
    setEditUnit(unit)
    setDraft(EDITABLE_YEARS.map(y => ({
      ...(unit.years[y] || { unit_number: unit.unit_number, fiscal_year: y, common_fee: 0, penalty_fee: 0, dunning_fee: 0, paid_common: 0, paid_penalty: 0, paid_dunning: 0 })
    })))
    setReason('')
  }

  async function save() {
    if (!reason.trim()) return alert('กรุณาระบุเหตุผลการแก้ไข (บังคับ)')
    const payload = draft.map(d => ({
      ...d,
      common_fee: Number(d.common_fee) || 0,
      penalty_fee: Number(d.penalty_fee) || 0,
      dunning_fee: Number(d.dunning_fee) || 0,
      note: reason,
      updated_at: new Date().toISOString()
    }))
    const { error } = await supabase.from('debt_year_detail').upsert(payload, { onConflict: 'unit_number,fiscal_year' })
    if (error) return alert(error.message)
    setEditUnit(null)
    load()
    alert('บันทึกเรียบร้อย')
  }

  if (loading) return <p>กำลังโหลด...</p>

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>ยอดค้างค่าส่วนกลางยกมารายปี</h1>
      <p style={{ color: '#64748b', marginBottom: 12 }}>แก้ไขได้เฉพาะปี 2556–{CURRENT_YEAR_TH - 1}</p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาบ้านเลขที่..." style={{ padding: 8, marginBottom: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: 8 }}>บ้านเลขที่</th>
              {ALL_YEARS.map(y => <th key={y} style={{ padding: 8 }}>{y}</th>)}
              <th style={{ padding: 8 }}>รวมค้าง</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.unit_number}>
                <td style={{ padding: 8, fontWeight: 600 }}>{u.unit_number}</td>
                {ALL_YEARS.map(y => {
                  const v = Math.max(outstandingOf(u.years[y] || {}), 0)
                  return <td key={y} style={{ padding: 8, textAlign: 'right', color: v > 0 ? '#dc2626' : '#cbd5e1' }}>{v > 0 ? baht(v) : '-'}</td>
                })}
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{baht(u.total)}</td>
                <td style={{ padding: 8 }}><button onClick={() => openEdit(u)} style={{ padding: '4px 8px', cursor: 'pointer' }}>แก้ไข</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editUnit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setEditUnit(null)}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 12, width: 620, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3>แก้ไขยอดค้าง — บ้านเลขที่ {editUnit.unit_number}</h3>
            <div style={{ maxHeight: 320, overflowY: 'auto', margin: '10px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f1f5f9' }}><th style={{ padding: 6 }}>ปี</th><th style={{ padding: 6 }}>ส่วนกลาง</th><th style={{ padding: 6 }}>ค่าปรับ</th><th style={{ padding: 6 }}>ทวงถาม</th></tr></thead>
                <tbody>
                  {draft.map((d, i) => (
                    <tr key={d.fiscal_year}>
                      <td style={{ padding: 6 }}>{d.fiscal_year}</td>
                      <td style={{ padding: 6 }}><input type="number" value={d.common_fee} onChange={e => { const n = [...draft]; n[i].common_fee = e.target.value; setDraft(n); }} style={{ width: 90 }} /></td>
                      <td style={{ padding: 6 }}><input type="number" value={d.penalty_fee} onChange={e => { const n = [...draft]; n[i].penalty_fee = e.target.value; setDraft(n); }} style={{ width: 80 }} /></td>
                      <td style={{ padding: 6 }}><input type="number" value={d.dunning_fee} onChange={e => { const n = [...draft]; n[i].dunning_fee = e.target.value; setDraft(n); }} style={{ width: 80 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เหตุผลการแก้ไข (บังคับกรอก)" style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6, border: '1px solid #cbd5e1' }} />
            <button onClick={save} style={{ background: '#2563eb', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Save size={14} /> บันทึก</button>
          </div>
        </div>
      )}
    </div>
  )
}