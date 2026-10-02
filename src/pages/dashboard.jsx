import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { baht, CURRENT_YEAR_TH } from '../lib/constants'

export default function Dashboard() {
  const [stat, setStat] = useState(null)

  useEffect(() => {
    supabase.from('v_unit_arrears').select('*').then(({ data }) => {
      const rows = data || []
      setStat({
        total: rows.length,
        debtors: rows.filter(r => r.outstanding > 0).length,
        sum: rows.reduce((s, r) => s + Number(r.outstanding), 0),
        oldest: Math.min(...rows.filter(r => r.oldest_due_year).map(r => r.oldest_due_year)),
      })
    })
  }, [])

  if (!stat) return <p>กำลังโหลด...</p>
  const cards = [
    { label: 'จำนวนยูนิตทั้งหมด', value: `${stat.total} หลัง` },
    { label: 'ยูนิตที่ค้างชำระ', value: `${stat.debtors} หลัง`, red: true },
    { label: 'ยอดค้างสะสมรวม', value: `${baht(stat.sum)} บาท`, red: true },
    { label: 'ปีที่ค้างเก่าสุด', value: stat.oldest === Infinity ? 'ไม่มี' : `พ.ศ. ${stat.oldest}` },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>ภาพรวมนิติบุคคล</h1>
      <p style={{ color: '#64748b', marginBottom: 18 }}>ปีงบประมาณปัจจุบัน พ.ศ. {CURRENT_YEAR_TH}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <p style={{ color: '#64748b', fontSize: 13 }}>{c.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: c.red ? '#dc2626' : '#0f172a' }}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}