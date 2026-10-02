Version: 1.0
Last Updated: 2026-10-01
 
Owner: GrandGarden Project
Status: Approved

# Annual Debt Ledger
## annual_debts
วัตถุประสงค์:
เก็บยอดหนี้ค่าส่วนกลางรายปีของแต่ละบ้าน
 
| Field | Type | Description |
|---------|---------|---------|
| house_no | string | บ้านเลขที่ |
| year | number | ปี พ.ศ. |
| collection_fee | decimal | ค่าทวงถาม |
| penalty | decimal | ค่าปรับ |
| principal | decimal | ค่าส่วนกลาง |
| paid_amount | decimal | ยอดชำระสะสม |
| balance | decimal | ยอดคงเหลือ |
| status | string | OPEN / PARTIAL / CLOSED |
| created_date | date | วันที่สร้าง |
| last_update | date | วันที่แก้ไขล่าสุด |

# Payment Ledger
payment_id
house_no
payment_date
payment_amount
payment_method
reference_no
remark

# Allocation Ledger
payment_id
year
allocation_type
allocated_amount
sequence_no

# Business Rules
1. ตัดหนี้ปีเก่าสุดก่อน
2. ตัดค่าทวงถาม
3. ตัดค่าปรับ
4. ตัดค่าส่วนกลาง

# Relationships
houses
│
├── annual_debts
│
├── payments
│
└── payment_allocations
# Example
House 399/1
├─ annual_debts
│ ├─ 2556
│ ├─ 2557
│ └─ 2558
├─ payments
│ ├─ P0001
│ ├─ P0002
│ └─ P0003
└─ payment_allocations
├─ A0001
├─ A0002
└─ A0003
# Scenario
บ้าน 399/50
Annual Debt
2566
collection_fee = 500
penalty = 1350
principal = 9000
ยอดรวม = 10850
ลูกบ้านชำระ 5,000 บาท
Allocation
1. collection_fee 500
2. penalty 1350
3. principal 3150
คงเหลือ principal 5850

# Status Definition
OPEN = ยังไม่เคยชำระ
PARTIAL = ชำระบางส่วน
CLOSED = ชำระครบแล้ว
