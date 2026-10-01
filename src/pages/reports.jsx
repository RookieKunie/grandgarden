import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { baht } from '../lib/constants'

export default function Reports() {
  const [report, setReport] = useState([])
  useEffect(() => {
    supabase.from('v_unit_arrears').select('*').order('outstanding', { ascending: false })
      .then(({ data }) => setReport(data || []))
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>รายงานสรุปยอดค้างชำระตามบ้าน</h1>
      <table style={{ borderCollapse: 'collapse', background: '#fff', fontSize: 13, width: '100%' }}>
        <thead><tr style={{ background: '#f1f5f9' }}>
          <th style={th}>บ้านเลขที่</th><th style={th}>เจ้าของ</th><th style={th}>พื้นที่ (ตร.วา)</th>
          <th style={th}>ปีที่ค้างเก่าสุด</th><th style={th}>ยอดค้างรวม</th>
        </tr></thead>
        <tbody>
          {report.map(r => (
            <tr key={r.unit_number}>
              <td style={td}>{r.unit_number}</td>
              <td style={td}>{r.owner_name || '-'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{r.area_sq_wah}</td>
              <td style={{ ...td, textAlign: 'center' }}>{r.oldest_due_year || '-'}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.outstanding > 0 ? '#dc2626' : '#0f172a' }}>
                {baht(r.outstanding)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const th = { padding: '8px 12px', border: '1px solid #e2e8f0' }
const td = { padding: '6px 12px', border: '1px solid #f1f5f9' }