  export const BUCKETS = [
    { key: 'dunning_fee', paid: 'paid_dunning', label: 'ค่าทวงถาม' },
    { key: 'penalty_fee', paid: 'paid_penalty', label: 'ค่าปรับ' },
    { key: 'common_fee',  paid: 'paid_common',  label: 'ค่าส่วนกลาง' },
  ];
  export function previewAllocation(rows, amount) {
    let remain = Number(amount) || 0;
    const result = [];
    const sorted = [...rows].sort((a, b) => a.fiscal_year - b.fiscal_year);
    for (const r of sorted) {
      if (remain <= 0) break;
      for (const b of BUCKETS) {
        if (remain <= 0) break;
        const due = Number(r[b.key]) - Number(r[b.paid]);
        if (due <= 0) continue;
        const pay = Math.min(remain, due);
        remain -= pay;
        result.push({ year: r.fiscal_year, bucket: b.label, applied: pay });
      }
    }
    if (remain > 0) result.push({ year: null, bucket: 'เงินเหลือ (เครดิตยกไป)', applied: remain });
    return result;
  }
  export const outstandingOf = r =>
    (Number(r.common_fee) + Number(r.penalty_fee) + Number(r.dunning_fee)) -
    (Number(r.paid_common) + Number(r.paid_penalty) + Number(r.paid_dunning));