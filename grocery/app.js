'use strict';
/* ร้านชำของฉัน — SPA ไม่มี backend เก็บข้อมูลใน localStorage */
const KEY = 'grocery.v1';
const LOW = 5;
const EXP_CATS = ['ค่าของเข้า', 'ค่าน้ำ', 'ค่าไฟ', 'ค่าเช่า', 'ค่าขนส่ง', 'อื่นๆ'];
const $ = (s, r = document) => r.querySelector(s);

let db = load();
let tab = 'pos';
let cart = {};          // productId -> qty
let posCat = 'ทั้งหมด', posQ = '';
let stockQ = '';
let dashMode = 'day';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.products) return d;
  } catch (e) {}
  return { products: [], sales: [], expenses: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('บันทึกไม่ได้ (พื้นที่เต็มหรือปิดการเก็บข้อมูล)'); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Math.round(n * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = t => dayKey(t).slice(0, 7);
const fmtDT = t => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = k => new Date(k + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });
const fmtMonth = k => new Date(k + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2200);
}
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hidden'); }
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheetBody').innerHTML = ''; }
$('.sheet-bg').onclick = closeSheet;

/* ---------- ตัวช่วย ---------- */
const cats = () => [...new Set(db.products.map(p => p.cat).filter(Boolean))].sort();
const lowItems = () => db.products.filter(p => p.qty < LOW);
const getP = id => db.products.find(p => p.id === id);
const cartLines = () => Object.entries(cart).map(([id, q]) => ({ p: getP(id), q })).filter(l => l.p);
const cartTotal = () => cartLines().reduce((s, l) => s + l.p.price * l.q, 0);
const cartCount = () => cartLines().reduce((s, l) => s + l.q, 0);

/* ---------- router ---------- */
const TITLES = { pos: 'ขายของ', stock: 'สต็อกสินค้า', expense: 'รายจ่าย', dash: 'สรุปรายรับ-รายจ่าย' };
function go(t) { tab = t; render(); window.scrollTo(0, 0); }
document.querySelectorAll('.bottom button').forEach(b => b.onclick = () => go(b.dataset.tab));

function render() {
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#title').textContent = TITLES[tab];
  const n = lowItems().length, bd = $('#alertBadge');
  bd.classList.toggle('hidden', !n); bd.textContent = `⚠ ใกล้หมด ${n}`;
  bd.onclick = () => { stockQ = ''; tab = 'stock'; render(); };
  ({ pos: renderPos, stock: renderStock, expense: renderExpense, dash: renderDash })[tab]();
}

/* ---------- POS ---------- */
function renderPos() {
  const list = db.products.filter(p =>
    (posCat === 'ทั้งหมด' || p.cat === posCat) &&
    (!posQ || (p.name + ' ' + p.code).toLowerCase().includes(posQ.toLowerCase())));
  const cnt = cartCount();
  $('#view').innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <input id="q" type="search" placeholder="ค้นหาชื่อ / พิมพ์-สแกนบาร์โค้ด" value="${esc(posQ)}" enterkeyhint="search">
      ${'BarcodeDetector' in window ? '<button class="btn sec fit" id="scan">📷</button>' : ''}
    </div>
    <div class="chips">${['ทั้งหมด', ...cats()].map(c => `<button class="chip ${c === posCat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${db.products.length === 0 ? '<div class="empty">ยังไม่มีสินค้า<br>ไปที่เมนู “สต็อก” เพื่อเพิ่มสินค้าก่อน</div>' :
      list.length === 0 ? '<div class="empty">ไม่พบสินค้า</div>' :
      `<div class="grid">${list.map(p => `
        <button class="prod ${p.qty <= 0 ? 'out' : ''}" data-id="${p.id}">
          <b>${esc(p.name)}</b>
          <div class="between"><span class="pr">฿${money(p.price)}</span>
          <span class="muted ${p.qty < LOW ? 'low' : ''}">เหลือ ${p.qty}${cart[p.id] ? ` · 🛒${cart[p.id]}` : ''}</span></div>
        </button>`).join('')}</div>`}
    ${cnt ? `<div class="cartbar"><button class="btn" id="cartBtn"><span>🛒 ตะกร้า (${cnt})</span><span>฿${money(cartTotal())}</span></button></div>` : ''}`;
  const q = $('#q');
  q.oninput = () => { posQ = q.value; const pos = q.selectionStart; renderPos(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  q.onkeydown = e => {
    if (e.key !== 'Enter') return;
    const hit = db.products.find(p => p.code && p.code === q.value.trim());
    if (hit) { addToCart(hit.id); posQ = ''; renderPos(); }
  };
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { posCat = c.dataset.c; renderPos(); });
  document.querySelectorAll('.prod').forEach(b => b.onclick = () => { addToCart(b.dataset.id); renderPos(); });
  if ($('#cartBtn')) $('#cartBtn').onclick = openCart;
  if ($('#scan')) $('#scan').onclick = () => scanBarcode(code => {
    const hit = db.products.find(p => p.code === code);
    if (hit) { addToCart(hit.id); renderPos(); } else toast('ไม่พบบาร์โค้ด ' + code);
  });
}
function addToCart(id) {
  const p = getP(id); if (!p) return;
  if ((cart[id] || 0) + 1 > p.qty) return toast(`“${p.name}” สต็อกไม่พอ (เหลือ ${p.qty})`);
  cart[id] = (cart[id] || 0) + 1;
}
function openCart() {
  const lines = cartLines();
  if (!lines.length) return closeSheet();
  const total = cartTotal();
  openSheet(`
    <h2>ตะกร้าสินค้า</h2>
    ${lines.map(({ p, q }) => `
      <div class="between" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1"><b>${esc(p.name)}</b><div class="muted">฿${money(p.price)} × ${q} = ฿${money(p.price * q)}</div></div>
        <div class="qty"><button data-a="-" data-id="${p.id}">−</button><span>${q}</span><button data-a="+" data-id="${p.id}">+</button></div>
      </div>`).join('')}
    <div class="between" style="margin:14px 0 4px;font-size:22px"><b>รวมทั้งหมด</b><b>฿${money(total)}</b></div>
    <label>เงินที่รับ (บาท)</label>
    <input id="recv" type="number" inputmode="decimal" placeholder="0">
    <div class="quick">
      <button class="btn sec sm" data-r="${total}">พอดี</button>
      ${[20, 50, 100, 500, 1000].filter(v => v >= total).slice(0, 3).map(v => `<button class="btn sec sm" data-r="${v}">${v}</button>`).join('')}
    </div>
    <div class="between" style="margin:12px 0;font-size:20px"><span>เงินทอน</span><b id="chg" class="muted">—</b></div>
    <div class="row"><button class="btn sec" id="clr">ล้างตะกร้า</button><button class="btn" id="pay" disabled>บันทึกการขาย</button></div>`);
  const recv = $('#recv');
  const upd = () => {
    const r = num(recv.value), ok = r >= total;
    $('#chg').textContent = recv.value === '' ? '—' : ok ? '฿' + money(r - total) : `ขาด ฿${money(total - r)}`;
    $('#chg').className = ok ? 'pos' : 'neg';
    $('#pay').disabled = !ok;
  };
  recv.oninput = upd;
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { recv.value = b.dataset.r; upd(); });
  document.querySelectorAll('.qty button').forEach(b => b.onclick = () => {
    const id = b.dataset.id, p = getP(id);
    if (b.dataset.a === '+') { if (cart[id] + 1 > p.qty) return toast('สต็อกไม่พอ'); cart[id]++; }
    else if (--cart[id] <= 0) delete cart[id];
    renderPos(); openCart();
  });
  $('#clr').onclick = () => { cart = {}; closeSheet(); renderPos(); };
  $('#pay').onclick = () => checkout(num(recv.value));
}
function checkout(received) {
  const lines = cartLines(), total = cartTotal();
  if (!lines.length || received < total) return;
  for (const { p, q } of lines) if (q > p.qty) return toast(`“${p.name}” สต็อกไม่พอ`);
  const sale = {
    id: uid(), ts: Date.now(), total, received, change: received - total,
    items: lines.map(({ p, q }) => ({ id: p.id, name: p.name, qty: q, price: p.price, cost: p.cost }))
  };
  lines.forEach(({ p, q }) => p.qty -= q);
  db.sales.push(sale); save(); cart = {};
  openSheet(`<h2>✅ ขายสำเร็จ</h2>
    <div class="card between"><span>ยอดรวม</span><b>฿${money(sale.total)}</b></div>
    <div class="card between"><span>รับเงิน</span><b>฿${money(sale.received)}</b></div>
    <div class="card between" style="font-size:24px"><span>เงินทอน</span><b class="pos">฿${money(sale.change)}</b></div>
    <button class="btn block" id="ok">ตกลง</button>`);
  $('#ok').onclick = () => { closeSheet(); render(); };
  render();
}
function scanBarcode(cb) {
  openSheet(`<h2>สแกนบาร์โค้ด</h2><video id="vid" playsinline muted style="width:100%;border-radius:12px;background:#000"></video>
    <button class="btn sec block" id="stopScan" style="margin-top:10px">ปิด</button>`);
  let stream, stop = false;
  const end = () => { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); closeSheet(); };
  $('#stopScan').onclick = end;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async s => {
    stream = s; const v = $('#vid'); if (!v) return end(); v.srcObject = s; await v.play();
    const det = new BarcodeDetector();
    const tick = async () => {
      if (stop) return;
      try { const r = await det.detect(v); if (r.length) { end(); return cb(r[0].rawValue); } } catch (e) {}
      setTimeout(tick, 250);
    };
    tick();
  }).catch(() => { toast('เปิดกล้องไม่ได้'); end(); });
}

/* ---------- สต็อก ---------- */
function renderStock() {
  const q = stockQ.toLowerCase();
  const list = db.products.filter(p => !q || (p.name + ' ' + p.code + ' ' + p.cat).toLowerCase().includes(q))
    .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name, 'th'));
  const low = lowItems().length;
  const value = db.products.reduce((s, p) => s + p.cost * p.qty, 0);
  $('#view').innerHTML = `
    <div class="stat" style="margin-bottom:10px">
      <div><span class="muted">สินค้า</span><b>${db.products.length}</b></div>
      <div><span class="muted">ใกล้หมด</span><b class="${low ? 'low' : ''}">${low}</b></div>
      <div><span class="muted">มูลค่าทุน</span><b>฿${money(value)}</b></div>
    </div>
    <div class="row" style="margin-bottom:10px">
      <input id="sq" type="search" placeholder="ค้นหาสินค้า" value="${esc(stockQ)}">
      <button class="btn fit" id="add">＋ เพิ่ม</button>
    </div>
    ${list.length ? list.map(p => `
      <div class="card between" data-id="${p.id}" style="cursor:pointer">
        <div style="min-width:0"><b>${esc(p.name)}</b>
          <div class="muted">${esc(p.cat || 'ไม่มีหมวด')}${p.code ? ' · ' + esc(p.code) : ''}</div>
          <div class="muted">ทุน ฿${money(p.cost)} · ขาย ฿${money(p.price)}</div></div>
        <div style="text-align:right"><div class="${p.qty < LOW ? 'low' : ''}" style="font-size:22px;font-weight:700">${p.qty}</div>
          ${p.qty < LOW ? '<div class="low" style="font-size:12px">ใกล้หมด</div>' : '<div class="muted" style="font-size:12px">ชิ้น</div>'}</div>
      </div>`).join('') : '<div class="empty">ยังไม่มีสินค้า กด “＋ เพิ่ม”</div>'}`;
  const sq = $('#sq');
  sq.oninput = () => { stockQ = sq.value; const pos = sq.selectionStart; renderStock(); const n = $('#sq'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#add').onclick = () => productForm();
  document.querySelectorAll('[data-id]').forEach(c => c.onclick = () => productForm(c.dataset.id));
}
function productForm(id, draft) {
  const p = draft || (id ? getP(id) : { code: '', name: '', cat: '', cost: '', price: '', qty: '' });
  openSheet(`
    <h2>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
    <label>รหัส / บาร์โค้ด</label>
    <div class="row"><input id="f_code" value="${esc(p.code)}" inputmode="numeric">${'BarcodeDetector' in window ? '<button class="btn sec fit" id="f_scan">📷</button>' : ''}</div>
    <label>ชื่อสินค้า *</label><input id="f_name" value="${esc(p.name)}">
    <label>หมวดหมู่</label><input id="f_cat" value="${esc(p.cat)}" list="catlist" placeholder="เช่น เครื่องดื่ม ขนม ของใช้">
    <datalist id="catlist">${cats().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="row">
      <div><label>ราคาทุน</label><input id="f_cost" type="number" inputmode="decimal" value="${p.cost}"></div>
      <div><label>ราคาขาย *</label><input id="f_price" type="number" inputmode="decimal" value="${p.price}"></div>
    </div>
    <label>จำนวนคงเหลือ</label><input id="f_qty" type="number" inputmode="numeric" value="${p.qty}">
    <div class="row" style="margin-top:16px">
      ${id ? '<button class="btn red fit" id="f_del">ลบ</button>' : ''}
      <button class="btn sec" id="f_cancel">ยกเลิก</button><button class="btn" id="f_ok">บันทึก</button>
    </div>`);
  $('#f_cancel').onclick = closeSheet;
  if ($('#f_scan')) $('#f_scan').onclick = () => {
    const d = { code: $('#f_code').value, name: $('#f_name').value, cat: $('#f_cat').value, cost: $('#f_cost').value, price: $('#f_price').value, qty: $('#f_qty').value };
    scanBarcode(c => productForm(id, { ...d, code: c }));
  };
  if (id) $('#f_del').onclick = () => {
    if (!confirm(`ลบ “${p.name}” ?`)) return;
    db.products = db.products.filter(x => x.id !== id); delete cart[id]; save(); closeSheet(); render(); toast('ลบแล้ว');
  };
  $('#f_ok').onclick = () => {
    const name = $('#f_name').value.trim(), code = $('#f_code').value.trim();
    if (!name) return toast('กรุณากรอกชื่อสินค้า');
    if ($('#f_price').value === '') return toast('กรุณากรอกราคาขาย');
    if (code && db.products.some(x => x.code === code && x.id !== id)) return toast('รหัส/บาร์โค้ดนี้มีอยู่แล้ว');
    const v = {
      code, name, cat: $('#f_cat').value.trim(), cost: Math.max(0, num($('#f_cost').value)),
      price: Math.max(0, num($('#f_price').value)), qty: Math.max(0, Math.floor(num($('#f_qty').value)))
    };
    if (id) Object.assign(p, v); else db.products.push({ id: uid(), ...v });
    save(); closeSheet(); render(); toast('บันทึกแล้ว');
  };
}

/* ---------- รายจ่าย ---------- */
function renderExpense() {
  const m = monthKey(Date.now());
  const list = [...db.expenses].sort((a, b) => b.ts - a.ts).slice(0, 100);
  const mTotal = db.expenses.filter(e => monthKey(e.ts) === m).reduce((s, e) => s + e.amount, 0);
  $('#view').innerHTML = `
    <div class="card between"><span>รายจ่ายเดือนนี้</span><b class="neg" style="font-size:22px">฿${money(mTotal)}</b></div>
    <button class="btn block" id="addExp" style="margin-bottom:10px">＋ บันทึกรายจ่าย</button>
    ${list.length ? list.map(e => `
      <div class="card between" data-id="${e.id}">
        <div><b>${esc(e.cat)}</b><div class="muted">${esc(e.note || '')}${e.note ? ' · ' : ''}${fmtDT(e.ts)}</div></div>
        <b class="neg">−฿${money(e.amount)}</b></div>`).join('') : '<div class="empty">ยังไม่มีรายจ่าย</div>'}`;
  $('#addExp').onclick = () => expenseForm();
  document.querySelectorAll('[data-id]').forEach(c => c.onclick = () => expenseForm(c.dataset.id));
}
function expenseForm(id) {
  const e = id ? db.expenses.find(x => x.id === id) : { cat: EXP_CATS[0], note: '', amount: '', ts: Date.now() };
  const d = new Date(e.ts), dv = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  openSheet(`
    <h2>${id ? 'แก้ไขรายจ่าย' : 'บันทึกรายจ่าย'}</h2>
    <label>ประเภท</label><select id="e_cat">${EXP_CATS.map(c => `<option ${c === e.cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <label>จำนวนเงิน (บาท) *</label><input id="e_amt" type="number" inputmode="decimal" value="${e.amount}">
    <label>วันที่</label><input id="e_date" type="date" value="${dv}">
    <label>บันทึกเพิ่มเติม</label><input id="e_note" value="${esc(e.note)}">
    <div class="row" style="margin-top:16px">
      ${id ? '<button class="btn red fit" id="e_del">ลบ</button>' : ''}
      <button class="btn sec" id="e_cancel">ยกเลิก</button><button class="btn" id="e_ok">บันทึก</button>
    </div>`);
  $('#e_cancel').onclick = closeSheet;
  if (id) $('#e_del').onclick = () => {
    if (!confirm('ลบรายจ่ายนี้?')) return;
    db.expenses = db.expenses.filter(x => x.id !== id); save(); closeSheet(); render();
  };
  $('#e_ok').onclick = () => {
    const amount = num($('#e_amt').value);
    if (amount <= 0) return toast('กรุณากรอกจำนวนเงิน');
    const dt = $('#e_date').value ? new Date($('#e_date').value + 'T12:00:00').getTime() : Date.now();
    const v = { cat: $('#e_cat').value, amount, note: $('#e_note').value.trim(), ts: dt };
    if (id) Object.assign(e, v); else db.expenses.push({ id: uid(), ...v });
    save(); closeSheet(); render(); toast('บันทึกแล้ว');
  };
}

/* ---------- สรุป ---------- */
function renderDash() {
  const keyOf = dashMode === 'day' ? dayKey : monthKey;
  const now = keyOf(Date.now());
  const agg = {};
  const g = k => agg[k] || (agg[k] = { inc: 0, cogs: 0, exp: 0, bills: 0 });
  db.sales.forEach(s => { const a = g(keyOf(s.ts)); a.inc += s.total; a.bills++; a.cogs += s.items.reduce((t, i) => t + i.cost * i.qty, 0); });
  db.expenses.forEach(e => { g(keyOf(e.ts)).exp += e.amount; });
  const cur = agg[now] || { inc: 0, cogs: 0, exp: 0, bills: 0 };
  const net = cur.inc - cur.exp;
  const keys = Object.keys(agg).sort().reverse().slice(0, dashMode === 'day' ? 14 : 12);
  const maxInc = Math.max(1, ...keys.map(k => agg[k].inc));

  // สินค้าขายดีในช่วงปัจจุบัน
  const top = {};
  db.sales.filter(s => keyOf(s.ts) === now).forEach(s => s.items.forEach(i => top[i.name] = (top[i.name] || 0) + i.qty));
  const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);

  $('#view').innerHTML = `
    <div class="seg"><button data-m="day" class="${dashMode === 'day' ? 'on' : ''}">รายวัน</button><button data-m="month" class="${dashMode === 'month' ? 'on' : ''}">รายเดือน</button></div>
    <div class="card">
      <div class="muted">${dashMode === 'day' ? 'วันนี้ ' + fmtDay(now) : fmtMonth(now)}</div>
      <div class="muted" style="margin-top:6px">กำไรสุทธิ (รายรับ − รายจ่าย)</div>
      <div class="${net >= 0 ? 'pos' : 'neg'}" style="font-size:34px;font-weight:700">${net < 0 ? '−' : ''}฿${money(Math.abs(net))}</div>
    </div>
    <div class="stat" style="margin-bottom:10px">
      <div><span class="muted">รายรับ</span><b class="pos">฿${money(cur.inc)}</b></div>
      <div><span class="muted">รายจ่าย</span><b class="neg">฿${money(cur.exp)}</b></div>
      <div><span class="muted">บิลขาย</span><b>${cur.bills}</b></div>
    </div>
    <div class="card between"><span class="muted">กำไรขั้นต้นจากการขาย (ขาย − ต้นทุนสินค้า)</span><b>฿${money(cur.inc - cur.cogs)}</b></div>
    ${topList.length ? `<div class="card"><b>สินค้าขายดี</b>${topList.map(([n, q]) => `<div class="between" style="margin-top:6px"><span>${esc(n)}</span><span class="muted">${q} ชิ้น</span></div>`).join('')}</div>` : ''}
    <div class="card"><b>ย้อนหลัง</b>
      ${keys.length ? keys.map(k => { const a = agg[k], n = a.inc - a.exp; return `
        <div style="margin-top:12px"><div class="between"><span>${dashMode === 'day' ? fmtDay(k) : fmtMonth(k)}</span><b class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : '−'}฿${money(Math.abs(n))}</b></div>
        <div class="muted" style="font-size:13px">รับ ฿${money(a.inc)} · จ่าย ฿${money(a.exp)}</div>
        <div class="bar"><i style="width:${a.inc / maxInc * 100}%"></i></div></div>`; }).join('') : '<div class="empty">ยังไม่มีข้อมูล</div>'}
    </div>
    <div class="card"><b>ข้อมูลและสำรอง</b>
      <p class="muted">ข้อมูลเก็บในเครื่องนี้เท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์จะหาย ควรสำรองเป็นระยะ</p>
      <div class="row"><button class="btn sec" id="exp">⬇ สำรองข้อมูล</button><button class="btn sec" id="imp">⬆ กู้คืน</button></div>
      <input type="file" id="file" accept="application/json" class="hidden">
      <button class="btn red block sm" id="wipe" style="margin-top:10px">ล้างข้อมูลทั้งหมด</button>
    </div>`;
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { dashMode = b.dataset.m; renderDash(); });
  $('#exp').onclick = exportData;
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = importData;
  $('#wipe').onclick = () => {
    if (confirm('ลบข้อมูลทั้งหมด (สินค้า ประวัติขาย รายจ่าย) ?') && confirm('ยืนยันอีกครั้ง — ลบแล้วกู้คืนไม่ได้')) {
      db = { products: [], sales: [], expenses: [] }; cart = {}; save(); render();
    }
  };
}
function exportData() {
  const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `ร้านชำ-สำรอง-${dayKey(Date.now())}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.products) || !Array.isArray(d.sales) || !Array.isArray(d.expenses)) throw 0;
      if (!confirm('กู้คืนจะแทนที่ข้อมูลปัจจุบันทั้งหมด ดำเนินการต่อ?')) return;
      db = d; cart = {}; save(); render(); toast('กู้คืนสำเร็จ');
    } catch (e) { toast('ไฟล์ไม่ถูกต้อง'); }
  };
  r.readAsText(f);
}

/* ---------- start ---------- */
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
