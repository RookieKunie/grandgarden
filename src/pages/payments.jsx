import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { baht } from '../lib/constants'
import { previewAllocation } from '../lib/debtEngine'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'th-promptpay-qr'

export default function Payments() {
  const [units, setUnits] = useState([])
  const [unit, setUnit] = useState('')
  const [rows, setRows] = useState([])
  const [amount, setAmount] = useState('')
  const [promptpayId, setPromptpayId] = useState('')

  useEffect(() => {
    supabase.from('v_unit_arrears').select('*').order('unit_number')
      .then(({ data }) => setUnits(data || []))
    supabase.from('app_settings').select('*').eq('key', 'promptpay_id').single()
      .then(({ data }) => setPromptpayId(data?.value || ''))
  }, [])

  useEffect(() => {
    if (!unit) return setRows([])
    supabase.from('debt_year_detail').select('*')
      .eq('unit_number', unit).order('fiscal_year')
      .then(({ data }) => setRows(data || []))
  }, [unit])

  const plan = amount ? previewAllocation(rows, amount) : []
  const payload = promptpayId && amount ? generatePayload(promptpayId, { amount: Number(amount) }) : ''

  async function confirm() {
    if (!unit || !amount) return alert('กรุณาเลือกบ้านและกรอกจำนวนเงิน')
    if (!window.confirm(`ยืนยันรับชำระ ${baht(amount)} บาท จากบ้าน ${unit}?`)) return

    const { error: e1 } = await supabase.from('payment_slips').insert({
      house_no: unit, amount: Number(amount),
      date: new Date().toISOString().slice(0, 10),
      status: 'approved', type: 'promptpay',
    })
    if (e1) return alert(e1.message)

    const { data, error } = await supabase.rpc('allocate_payment', {
      p_unit: unit, p_amount: Number(amount), p_commit: true,
    })
    if (error) return alert(error.message)

    alert('ตัดยอดสำเร็จ:\n' + data.map(d =>
      `ปี ${d.fiscal_year ?? '-'} / ${d.bucket} = ${baht(d.applied)}`).join('\n'))
    setAmount('')
    const { data: fresh } = await supabase.from('debt_year_detail').select('*')
      .eq('unit_number', unit).order('fiscal_year')
    setRows(fresh || [])
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>รับชำระเงิน</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>
        กฎเหล็ก: ตัดปีเก่าสุดก่อนเสมอ → ค่าทวงถาม → ค่าปรับ → ค่าส่วนกลาง
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={unit} onChange={e => setUnit(e.target.value)}
          style={{ padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 260 }}>
          <option value="">-- เลือกบ้านเลขที่ --</option>
          {units.map(u => (
            <option key={u.unit_number} value={u.unit_number}>
              {u.unit_number} — ค้าง {baht(u.outstanding)} บาท (เก่าสุด {u.oldest_due_year ?? '-'})
            </option>
          ))}
        </select>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="จำนวนเงินที่รับ"
          style={{ padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', width: 180 }} />
        <button onClick={confirm}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none',
                   background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
          ยืนยันรับชำระ
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: 10 }}>ผลการตัดยอด (ตรวจก่อนยืนยัน)</h3>
          {plan.length === 0 ? <p style={{ color: '#94a3b8' }}>ยังไม่มีข้อมูล</p> : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>ลำดับ</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>ปี</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>หัวค่าใช้จ่าย</th>
                <th style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>จำนวนเงิน</th>
              </tr></thead>
              <tbody>
                {plan.map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 12px', border: '1px solid #f1f5f9' }}>{i + 1}</td>
                    <td style={{ padding: '6px 12px', border: '1px solid #f1f5f9' }}>{p.year ?? '-'}</td>
                    <td style={{ padding: '6px 12px', border: '1px solid #f1f5f9' }}>{p.bucket}</td>
                    <td style={{ padding: '6px 12px', border: '1px solid #f1f5f9', textAlign: 'right' }}>{baht(p.applied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {payload && (
          <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <h3 style={{ marginBottom: 10 }}>QR PromptPay</h3>
            <QRCodeSVG value={payload} size={190} />
            <p style={{ marginTop: 10, fontWeight: 700 }}>{baht(amount)} บาท</p>
          </div>
        )}
      </div>
    </div>
  )
}