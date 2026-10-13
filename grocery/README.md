# 🛒 ร้านชำของฉัน (Grocery POS)

เว็บแอปจัดการร้านขายของชำ — สต็อก, POS หน้าร้าน, รายรับ-รายจ่าย — ใช้งานบนมือถือเป็นหลัก
ไม่มี backend: เก็บข้อมูลใน `localStorage` ของเครื่อง · ติดตั้งเป็นแอปบนหน้าจอหลักได้ (PWA) · ใช้ออฟไลน์ได้

## โครงสร้าง
```
grocery/
├── index.html            # หน้าหลัก + เมนูล่าง
├── style.css             # สไตล์ Mobile-first (ปุ่มใหญ่)
├── app.js                # ตรรกะทั้งหมด (สต็อก / POS / รายจ่าย / สรุป / สำรองข้อมูล)
├── manifest.webmanifest  # PWA
├── sw.js                 # Service worker (ออฟไลน์)
└── icons/icon.svg
.github/workflows/pages-grocery.yml   # Deploy ขึ้น GitHub Pages อัตโนมัติ
```

## ฟีเจอร์
- **สต็อก**: เพิ่ม/แก้ไข/ลบ (บาร์โค้ด ชื่อ หมวด ราคาทุน ราคาขาย จำนวน) · แจ้งเตือนเมื่อเหลือ < 5 ชิ้น
- **ขายของ**: แตะสินค้าลงตะกร้า · ค้นหา/พิมพ์บาร์โค้ดแล้ว Enter · สแกนด้วยกล้อง (เบราว์เซอร์ที่รองรับ) · กรอกเงินรับ คำนวณเงินทอน · ตัดสต็อกอัตโนมัติ
- **รายจ่าย**: ค่าของเข้า/น้ำ/ไฟ/เช่า/ขนส่ง/อื่นๆ
- **สรุป**: รายรับ (จากการขาย) รายจ่าย กำไรสุทธิ รายวัน/รายเดือน · สินค้าขายดี · สำรอง/กู้คืนข้อมูลเป็นไฟล์ JSON

## ลองรันในเครื่อง
```bash
cd grocery && python3 -m http.server 8080   # แล้วเปิด http://localhost:8080
```

## นำขึ้น GitHub Pages (ทีละขั้น)
1. Commit และ push โค้ดขึ้น GitHub
   ```bash
   git add grocery .github/workflows/pages-grocery.yml
   git commit -m "เพิ่มแอปร้านชำ"
   git push -u origin <ชื่อ-branch>
   ```
2. เปิด Pull Request แล้ว **merge เข้า `main`** (workflow deploy ทำงานเมื่อ push เข้า `main`)
3. ที่ repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. แท็บ **Actions** → รอ “Deploy Grocery App to GitHub Pages” เป็นสีเขียว
   (ถ้าไม่รันเอง กด **Run workflow**)
5. เปิดลิงก์: `https://<ชื่อผู้ใช้>.github.io/<ชื่อ-repo>/` — ชื่อ repo นี้คือ `---` ถ้า URL แปลก แนะนำเปลี่ยนชื่อ repo ใน Settings → General
6. บนมือถือ: เปิดลิงก์ → เมนูเบราว์เซอร์ → **เพิ่มไปยังหน้าจอหลัก** (iOS: Safari → แชร์ → Add to Home Screen)

### ทางเลือก: Vercel
Import repo ที่ vercel.com → ตั้ง **Root Directory = `grocery`**, Framework = *Other*, ไม่ต้องมี build command → Deploy

## ข้อควรระวัง
- ข้อมูลอยู่ในเบราว์เซอร์เครื่องนั้นเท่านั้น (คนละเครื่อง/คนละเบราว์เซอร์ = คนละข้อมูล) ล้างข้อมูลเบราว์เซอร์แล้วหาย → กด **สำรองข้อมูล** ที่หน้าสรุปเป็นประจำ
