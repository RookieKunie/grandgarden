import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { baht } from '../lib/constants'

export default function Invoices() {
  const [list, setList] = useState([])
  useEffect(() => {
    supabase.from('invoices').select('*').order('issue_date', { ascending: false }).limit(200)
      .then(({ data }) => setList(data || []))
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>ใบแจ้งหนี้</h1>
      <table style={{ borderCollapse: 'collapse', background: '#fff', fontSize: 13, width: '100%' }}>
        <thead><tr style={{ background: '#f1f5f9' }}>
          <th style={th}>เลขที่</th><th style={th}>รอบบิล</th><th style={th}>วันที่ออก</th>
          <th style={th}>ครบกำหนด</th><th style={th}>จำนวนเงิน</th><th style={th}>สถานะ</th>
        </tr></thead>
        <tbody>
          {list.map(i => (
            <tr key={i.id}>
              <td style={td}>{i.invoice_number}</td>
              <td style={td}>{i.billing_period}</td>
              <td style={td}>{i.issue_date}</td>
              <td style={td}>{i.due_date}</td>
              <td style={{ ...td, textAlign: 'right' }}>{baht(i.total_amount)}</td>
              <td style={td}>{i.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const th = { padding: '8px 12px', border: '1px solid #e2e8f0' }
const td = { padding: '6px 12px', border: '1px solid #f1f5f9' }