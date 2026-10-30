/* =========================================================
   INVOICE MAKER | POS & DOKUMEN PENJUALAN
   Versi peningkatan: validasi transaksi, nota per format,
   arsip lokal, cetak dan PDF sesuai ukuran dokumen.
   ========================================================= */

const SUPABASE_URL = 'https://yrdsuepevxftxxkouajz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zAK3nmIMuYtd0LIV3C72dg__D615Jfg';
if (!window.dbClient && window.supabase) {
    window.dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const dataWarna = [
    { nama: 'Biru', warna: '#3b82f6' }, { nama: 'Hijau', warna: '#10b981' },
    { nama: 'Merah', warna: '#ef4444' }, { nama: 'Kuning', warna: '#d97706' },
    { nama: 'Ungu', warna: '#8b5cf6' }, { nama: 'Cyan', warna: '#06b6d4' },
    { nama: 'Pink', warna: '#ec4899' }, { nama: 'Navy', warna: '#1e293b' },
    { nama: 'Oranye', warna: '#f97316' }, { nama: 'Abu-abu', warna: '#475569' }
];

const readStore = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
};
let keranjang = readStore('pos_cart', []);
let daftarPelanggan = readStore('pos_customers', []);
let katalogProduk = readStore('pos_catalog', []);
let riwayatTransaksi = readStore('pos_history', []);
let grandTotal = 0;
let logoBase64 = localStorage.getItem('pos_logo') || '';
let sigBase64 = localStorage.getItem('pos_sig') || '';
let stampBase64 = localStorage.getItem('pos_stamp') || '';
let sedangMencetak = false;

const $ = id => document.getElementById(id);
const rupiah = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value) || 0);
const uang = value => `Rp ${rupiah(value)}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const tanggalHariIni = () => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth()+1).padStart(2, '0')}/${now.getFullYear()}`;
};
const tanggalISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
};
const tanggalIndonesia = iso => {
    if (!iso) return tanggalHariIni();
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};
const simpanData = () => localStorage.setItem('pos_cart', JSON.stringify(keranjang));
const simpanRiwayat = () => localStorage.setItem('pos_history', JSON.stringify(riwayatTransaksi));

// Autentikasi
window.prosesLogin = async function () {
    const email = $('loginEmail')?.value.trim();
    const password = $('loginPassword')?.value || '';
    const errEl = $('loginError');
    if (!email || !password) { tampilkanErrorLogin('Email dan kata sandi wajib diisi.'); return; }
    if (!window.dbClient) { tampilkanErrorLogin('Layanan login belum terhubung. Periksa konfigurasi Supabase.'); return; }
    const button = document.querySelector('.login-form button, #loginScreen button');
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Memeriksa akun...'; }
    try {
        const { data, error } = await window.dbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if ($('loginScreen')) $('loginScreen').style.display = 'none';
        if ($('userEmailDisplay')) $('userEmailDisplay').textContent = data.user?.email || email;
    } catch (error) {
        tampilkanErrorLogin(error.message || 'Login gagal. Periksa email dan kata sandi.');
    } finally {
        if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Masuk ke aplikasi'; }
    }
};
function tampilkanErrorLogin(pesan) {
    const el = $('loginError'); if (!el) return;
    el.textContent = pesan; el.style.display = 'block';
}
window.prosesLogout = async function () {
    if (window.dbClient) await window.dbClient.auth.signOut();
    if ($('loginScreen')) $('loginScreen').style.display = 'flex';
};

function muatWarnaNota() {
    const select = $('warnaNota'); if (!select) return;
    select.innerHTML = '';
    dataWarna.forEach((item, index) => select.add(new Option(item.nama, String(index))));
    select.value = localStorage.getItem('pos_color_index') || '0';
    gantiWarnaNota();
}
window.gantiWarnaNota = function () {
    const select = $('warnaNota'); if (!select) return;
    const item = dataWarna[Number(select.value)] || dataWarna[0];
    document.documentElement.style.setProperty('--primary', item.warna);
    localStorage.setItem('pos_color_index', String(select.value));
};

function muatPelanggan() {
    const select = $('pilihPelanggan'); if (!select) return;
    select.replaceChildren(new Option('-- Pilih pelanggan tersimpan --', ''));
    daftarPelanggan.forEach((p, i) => select.add(new Option(p.nama, String(i))));
}
window.simpanPelangganBaru = function () {
    const nama = $('namaKlienBaru').value.trim();
    const kontak = $('kontakKlienBaru').value.trim();
    if (!nama) return alert('Masukkan nama pelanggan terlebih dahulu.');
    daftarPelanggan.push({ nama, kontak });
    localStorage.setItem('pos_customers', JSON.stringify(daftarPelanggan));
    $('namaKlienBaru').value = ''; $('kontakKlienBaru').value = '';
    muatPelanggan(); $('pilihPelanggan').value = String(daftarPelanggan.length - 1);
    pilihPelangganAktif();
};
window.pilihPelangganAktif = function () {
    const index = $('pilihPelanggan')?.value;
    if (index === '' || index == null) return;
    const p = daftarPelanggan[Number(index)]; if (!p) return;
    $('inputEkstra').value = [p.nama, p.kontak].filter(Boolean).join(' | ');
};
function muatKatalog() {
    const select = $('pilihKatalog'); if (!select) return;
    select.replaceChildren(new Option('-- Pilih produk dari katalog --', ''));
    katalogProduk.forEach((p, i) => select.add(new Option(`${p.nama} · ${uang(p.harga)} · Stok ${p.stok}`, String(i))));
}
window.simpanProdukBaru = function () {
    const nama = $('namaProdukBaru').value.trim();
    const harga = Number($('hargaProdukBaru').value);
    const stok = Math.max(0, Number.parseInt($('stokProdukBaru').value, 10) || 0);
    if (!nama || !Number.isFinite(harga) || harga <= 0) return alert('Masukkan nama produk dan harga yang valid.');
    katalogProduk.push({ nama, harga, stok });
    localStorage.setItem('pos_catalog', JSON.stringify(katalogProduk));
    $('namaProdukBaru').value = ''; $('hargaProdukBaru').value = ''; $('stokProdukBaru').value = '';
    muatKatalog();
};
window.pilihProdukKatalog = function () {
    const index = $('pilihKatalog')?.value; if (index === '') return;
    const p = katalogProduk[Number(index)]; if (!p) return;
    $('nama').value = p.nama; $('harga').value = p.harga; $('qty').value = 1; $('diskon').value = 0; $('qty').focus();
};

window.tambahBarang = function () {
    const nama = $('nama').value.trim();
    const harga = Number($('harga').value);
    const diskon = Number($('diskon').value) || 0;
    const qty = Number($('qty').value);
    if (!nama || !Number.isFinite(harga) || harga <= 0 || !Number.isFinite(qty) || qty <= 0) return alert('Lengkapi nama item, harga, dan kuantitas dengan benar.');
    if (diskon < 0 || diskon > harga) return alert('Diskon per unit tidak boleh negatif atau melebihi harga satuan.');
    const subtotal = (harga - diskon) * qty;
    keranjang.push({ nama, harga, diskon, qty, subtotal });
    ['nama','harga','diskon','qty'].forEach(id => $(id).value = '');
    if ($('pilihKatalog')) $('pilihKatalog').value = '';
    $('nama').focus(); simpanData(); tampilkanTabel();
};
window.hapus = function (index) {
    if (!Number.isInteger(Number(index)) || !keranjang[index]) return;
    keranjang.splice(index, 1); simpanData(); tampilkanTabel();
};
function hitungTotal(items = keranjang) {
    return items.reduce((sum, item) => sum + (Number(item.subtotal) || ((Number(item.harga) - Number(item.diskon || 0)) * Number(item.qty))), 0);
}
function tampilkanTabel() {
    const tbody = $('tabelKeranjang'); if (!tbody) return;
    grandTotal = hitungTotal();
    if (!keranjang.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cart">Keranjang masih kosong. Tambahkan item untuk memulai transaksi.</td></tr>';
    } else {
        tbody.innerHTML = keranjang.map((item, i) => `<tr>
          <td>${i + 1}</td><td class="cart-item-name">${escapeHtml(item.nama)}</td>
          <td>${rupiah(item.harga)}</td><td>${rupiah(item.diskon || 0)}</td><td>${escapeHtml(item.qty)}</td>
          <td class="cart-subtotal">${rupiah(item.subtotal)}</td>
          <td><button type="button" onclick="hapus(${i})" class="btn btn-danger btn-small" aria-label="Hapus ${escapeHtml(item.nama)}">Hapus</button></td>
        </tr>`).join('');
    }
    if ($('teksTotal')) $('teksTotal').textContent = uang(grandTotal);
    hitungKembalian();
}
window.hitungKembalian = function () {
    const tunai = Number($('tunai')?.value) || 0;
    const el = $('txtKembalian'); if (!el) return;
    if (tunai >= grandTotal) {
        el.textContent = rupiah(tunai - grandTotal); el.style.color = 'var(--success, #15803d)';
    } else {
        el.textContent = grandTotal === 0 && tunai === 0 ? '0' : `Kurang ${rupiah(grandTotal - tunai)}`;
        el.style.color = 'var(--danger, #dc2626)';
    }
};
window.batal = function () {
    if (!keranjang.length) return;
    if (!confirm('Batalkan transaksi saat ini dan kosongkan keranjang?')) return;
    keranjang = []; $('tunai').value = ''; simpanData(); tampilkanTabel();
};
window.toggleTanggal = function (manual) {
    const input = $('manualTanggal'); if (!input) return;
    input.style.display = manual ? 'block' : 'none';
    if (manual && !input.value) input.value = tanggalISO();
};

function buatNomorNota(layout) {
    const prefix = layout === 'lay-sj' ? 'SJ' : layout === 'lay-thermal' ? 'TRX' : 'INV';
    const now = new Date();
    const tanggal = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const key = `pos_counter_${tanggal}_${prefix}`;
    const next = (Number(localStorage.getItem(key)) || 0) + 1;
    localStorage.setItem(key, String(next));
    return `${prefix}/${tanggal}/${String(next).padStart(4,'0')}`;
}
function kumpulkanTransaksi() {
    const layout = $('pilihLayout')?.value || 'lay-a4';
    const model = $('pilihModel')?.value || 'mod-1';
    const tipeTanggal = document.querySelector('input[name="tipeTanggal"]:checked')?.value || 'otomatis';
    const tanggal = tipeTanggal === 'manual' ? tanggalIndonesia($('manualTanggal')?.value) : tanggalHariIni();
    const items = keranjang.map(item => ({ ...item, subtotal: (Number(item.harga) - Number(item.diskon || 0)) * Number(item.qty) }));
    const subtotal = items.reduce((sum, item) => sum + item.harga * item.qty, 0);
    const totalDiskon = items.reduce((sum, item) => sum + (item.diskon || 0) * item.qty, 0);
    const total = subtotal - totalDiskon;
    const tunai = Number($('tunai')?.value) || 0;
    return {
        noNota: buatNomorNota(layout), tanggal, dibuatPada: new Date().toISOString(), layout, model,
        namaToko: $('namaToko')?.value.trim() || 'Nama Toko', kontakToko: $('kontakToko')?.value.trim() || '',
        inputEkstra: $('inputEkstra')?.value.trim() || '', items, subtotal, totalDiskon, total, tunai,
        kembalian: Math.max(0, tunai - total), warnaIndex: Number($('warnaNota')?.value) || 0,
        logoBase64, sigBase64, stampBase64,
        judulInvoice: layout === 'lay-sj' ? 'SURAT JALAN' : layout === 'lay-thermal' ? 'STRUK PEMBAYARAN' : layout === 'lay-a5' ? 'FAKTUR PENJUALAN' : 'INVOICE'
    };
}
function simpanTransaksi(trx) {
    riwayatTransaksi.unshift(trx);
    if (riwayatTransaksi.length > 300) riwayatTransaksi = riwayatTransaksi.slice(0, 300);
    simpanRiwayat(); tampilkanRiwayat();
}

function barisItemHTML(trx) {
    if (trx.layout === 'lay-sj') {
        return trx.items.map((item, i) => `<tr><td class="center">${i+1}</td><td>${escapeHtml(item.nama)}</td><td class="center">${escapeHtml(item.qty)}</td><td></td></tr>`).join('');
    }
    if (trx.layout === 'lay-thermal') {
        return trx.items.map((item, i) => `<tr class="thermal-item"><td colspan="4"><div class="thermal-product-name">${escapeHtml(item.nama)}</div><div class="thermal-product-math"><span>${escapeHtml(item.qty)} × ${rupiah(item.harga)}</span><span>${rupiah(item.subtotal)}</span></div>${Number(item.diskon) > 0 ? `<div class="thermal-discount">Diskon ${rupiah(item.diskon)} / unit</div>` : ''}</td></tr>`).join('');
    }
    return trx.items.map((item, i) => `<tr><td class="center">${i+1}</td><td>${escapeHtml(item.nama)}</td><td class="center">${escapeHtml(item.qty)}</td><td class="right">${rupiah(item.harga)}</td><td class="right">${rupiah(item.subtotal)}</td></tr>`).join('');
}
function pastikanGayaDokumen() {
    if ($('generatedDocumentStyles')) return;
    const style = document.createElement('style');
    style.id = 'generatedDocumentStyles';
    style.textContent = `
      #printArea .document-parties{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:0 0 20px;padding:13px 15px;background:#f7f9fc;border:1px solid #e1e7ef;border-radius:3px}
      #printArea .document-parties>div{display:flex;flex-direction:column;gap:4px;min-width:0}
      #printArea .party-label{font-size:8pt;font-weight:800;letter-spacing:.08em;color:#68788d}
      #printArea .document-parties strong{font-size:10pt;color:#26384d;overflow-wrap:anywhere}
      #printArea .document-parties p{margin:0;font-size:9pt;color:#58687c;overflow-wrap:anywhere}
      #printArea .amount-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:5px 0;font-size:9pt}
      #printArea .amount-row strong,#printArea .amount-row h2{margin:0;text-align:right;font-variant-numeric:tabular-nums}
      #printArea .grand-total-row{margin-top:7px;padding:12px 10px;background:#f1f5fa;border-top:2px solid var(--brand);font-weight:800}
      #printArea .grand-total-row h2{font-size:15pt;color:#172b43}
      #printArea .payment-note{max-width:48%;font-size:9pt;color:#56667a}
      #printArea .payment-note p{margin:5px 0;line-height:1.5}
      #printArea .doc-footer{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-top:20px}
      #printArea .total-box{min-width:44%;margin-left:auto}
      #printArea .signature-image{display:block;max-width:42mm;max-height:22mm;object-fit:contain;margin:8px auto 0}
      #printArea .stamp-image{position:absolute;max-width:24mm;max-height:24mm;object-fit:contain;opacity:.78;left:-8mm;top:0}
      #printArea .signature-stack{position:relative;min-height:24mm;display:flex;justify-content:center;align-items:center;margin:5px 0}
      #printArea .signature-space{display:block;height:23mm}
      #printArea .doc-sign{display:flex;justify-content:space-between;gap:20px;margin-top:23mm;text-align:center;font-size:9pt}
      #printArea .doc-sign>div{flex:1;min-width:0}
      #printArea .doc-sign p{margin:3px 0}
      #printArea .document-footer{display:flex;justify-content:space-between;gap:12px;margin-top:18px;padding-top:8px;border-top:1px solid #dce2e9;color:#7b8796;font-size:8pt}
      #printArea .lay-thermal .thermal-table thead{display:none}
      #printArea .lay-thermal .thermal-table{width:100%;table-layout:fixed;border-collapse:collapse}
      #printArea .lay-thermal .thermal-table tr.thermal-item{display:block;width:100%}
      #printArea .lay-thermal .thermal-table td,#printArea .lay-thermal .thermal-table td:first-child{display:block;width:100%!important;max-width:100%;border:0;border-bottom:1px dotted #bbb;padding:5px 0;vertical-align:top}
      #printArea .lay-thermal .thermal-product-name{display:block;width:100%;max-width:100%;font-weight:700;line-height:1.35;white-space:normal;overflow-wrap:break-word;word-break:normal}
      #printArea .lay-thermal .thermal-product-math{display:flex;width:100%;align-items:flex-start;justify-content:space-between;gap:6px;margin-top:2px}
      #printArea .lay-thermal .thermal-product-math span:first-child{min-width:0;flex:1 1 auto;overflow-wrap:normal;word-break:normal}
      #printArea .lay-thermal .thermal-product-math span:last-child{flex:0 0 auto;text-align:right;white-space:nowrap}
      #printArea .lay-thermal .thermal-discount{font-size:8px}
      #printArea .lay-thermal .thermal-total-line{display:flex;justify-content:space-between;gap:6px;margin:3px 0}
      #printArea .lay-thermal .doc-footer{display:block;margin-top:8px;padding-top:8px;border-top:1px dashed #111}
      #printArea .lay-thermal .total-box{min-width:0}
      #printArea .lay-thermal .total-box h2{border-top:1px dashed #111;padding-top:7px}
      #printArea .lay-thermal .doc-sign p{margin:3px 0}
      #printArea .lay-sj .document-parties{background:#fff;border:1px solid #d4dce6}
      @media(max-width:600px){#printArea .document-parties{grid-template-columns:1fr}}
      /* Finalisasi layout dokumen: proporsi kolom dan pemisahan cetak yang konsisten. */
      #printArea .lay-a5,#printArea .lay-a4,#printArea .lay-sj{box-sizing:border-box;overflow:visible;break-inside:auto}
      #printArea .lay-a5 .doc-header,#printArea .lay-a4 .doc-header,#printArea .lay-sj .doc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm}
      #printArea .lay-a5 .col-brand,#printArea .lay-a4 .col-brand,#printArea .lay-sj .col-brand{flex:1 1 56%;max-width:56%;min-width:0}
      #printArea .lay-a5 .col-meta,#printArea .lay-a4 .col-meta,#printArea .lay-sj .col-meta{flex:0 0 40%;width:40%;min-width:0;text-align:right}
      #printArea .lay-a5 .document-parties,#printArea .lay-a4 .document-parties,#printArea .lay-sj .document-parties{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
      #printArea .lay-a5 .item-table,#printArea .lay-a4 .item-table,#printArea .lay-sj .item-table{width:100%;table-layout:fixed;border-collapse:collapse}
      #printArea .lay-a5 .item-table th,#printArea .lay-a5 .item-table td{padding:2.2mm 1.8mm;font-size:8pt}
      #printArea .lay-a4 .item-table th,#printArea .lay-a4 .item-table td,#printArea .lay-sj .item-table th,#printArea .lay-sj .item-table td{padding:2.7mm 2.2mm}
      #printArea .lay-a5 .item-table th:first-child,#printArea .lay-a5 .item-table td:first-child{width:7%}
      #printArea .lay-a5 .item-table th:nth-child(2),#printArea .lay-a5 .item-table td:nth-child(2){width:39%}
      #printArea .lay-a5 .item-table th:nth-child(3),#printArea .lay-a5 .item-table td:nth-child(3){width:9%}
      #printArea .lay-a5 .item-table th:nth-child(4),#printArea .lay-a5 .item-table td:nth-child(4){width:22.5%}
      #printArea .lay-a5 .item-table th:nth-child(5),#printArea .lay-a5 .item-table td:nth-child(5){width:22.5%}
      #printArea .lay-a5 .doc-footer,#printArea .lay-a4 .doc-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:6mm}
      #printArea .lay-a5 .payment-note,#printArea .lay-a4 .payment-note{flex:1 1 45%;max-width:45%;min-width:0}
      #printArea .lay-a5 .total-box,#printArea .lay-a4 .total-box{flex:0 0 50%;width:50%;min-width:0;margin-left:auto}
      #printArea .lay-a5 .grand-total-row h2,#printArea .lay-a4 .grand-total-row h2{font-size:12pt;white-space:normal}
      #printArea .lay-thermal{box-sizing:border-box;width:72mm;max-width:72mm;margin:0 auto;padding:3mm;color:#111;background:#fff;overflow-wrap:anywhere}
      #printArea .lay-thermal .col-meta{width:100%;min-width:0;text-align:center}
      #printArea .lay-thermal .doc-footer{width:100%;min-width:0}
      #printArea .lay-thermal .total-box h2{white-space:normal;overflow-wrap:anywhere}
      #printArea .lay-sj .doc-sign{gap:5mm;margin-top:22mm}
      #printArea .lay-sj .doc-sign>div{flex:1 1 0}
      #printArea .document-footer{clear:both}
      @media print{
        #printArea{margin:0!important;padding:0!important;overflow:visible!important}
        #printArea .lay-a5,#printArea .lay-a4,#printArea .lay-sj{box-shadow:none!important;max-width:100%!important}
        #printArea .document-parties,#printArea .doc-footer,#printArea .doc-sign{break-inside:avoid;page-break-inside:avoid}
        #printArea .item-table thead{display:table-header-group}
        #printArea .item-table tr{break-inside:avoid;page-break-inside:avoid}
      }
    `;
    style.textContent += `

/* =========================================================
   SIX DISTINCT STORE IDENTITIES
   Gaya 1-6 sengaja berbeda pada struktur, tipografi, tabel,
   penekanan total, serta aturan struk thermal monokrom.
   ========================================================= */
/* 1 — Toko klasik: nota biru standar, rapi dan familier */
#printArea .mod-1:not(.lay-thermal) .doc-header{border-bottom:2.5px solid var(--brand,#2458a6);padding-bottom:7mm}
#printArea .mod-1:not(.lay-thermal) .item-table th{background:var(--brand,#2458a6);color:#fff;border-color:var(--brand,#2458a6);text-transform:none;letter-spacing:0}
#printArea .mod-1:not(.lay-thermal) .item-table td{border-color:#d7dee8}
#printArea .mod-1:not(.lay-thermal) .total-box h2{background:#edf3fb;border-top:3px solid var(--brand,#2458a6);color:#172b43}
#printArea .mod-1:not(.lay-thermal) .document-parties{background:#f7f9fc;border:1px solid #dfe6ef}

/* 2 — Minimalis modern: garis tipis, ruang lega, tanpa blok warna */
#printArea .mod-2:not(.lay-thermal){font-family:Arial,Helvetica,sans-serif;color:#20252b}
#printArea .mod-2:not(.lay-thermal) .doc-header{border:0;border-bottom:1px solid #bfc5cc;padding:0 0 8mm;margin-bottom:9mm}
#printArea .mod-2:not(.lay-thermal) .brand-info h2{font-weight:500;letter-spacing:.01em;color:#20252b}
#printArea .mod-2:not(.lay-thermal) .col-meta h1{font-size:20pt;font-weight:400;letter-spacing:.11em;color:#20252b}
#printArea .mod-2:not(.lay-thermal) .document-parties{background:#fff;border:0;border-top:1px solid #e1e4e8;border-bottom:1px solid #e1e4e8;padding:5mm 0}
#printArea .mod-2:not(.lay-thermal) .item-table th{background:#fff;color:#353b43;border:0;border-bottom:1.5px solid #343a40;padding-top:3mm;padding-bottom:3mm;text-transform:uppercase;letter-spacing:.04em}
#printArea .mod-2:not(.lay-thermal) .item-table td{border:0;border-bottom:1px solid #e5e7eb;padding-top:3.5mm;padding-bottom:3.5mm}
#printArea .mod-2:not(.lay-thermal) .item-table tbody tr:nth-child(even){background:#fff}
#printArea .mod-2:not(.lay-thermal) .total-box h2{background:#fff;border-top:1px solid #20252b;border-bottom:3px double #20252b;color:#20252b;font-weight:600}
#printArea .mod-2:not(.lay-thermal) .document-footer{border-top:1px solid #d7dce1;color:#777}

/* 3 — Korporat formal: kepala dokumen navy, tabel tegas */
#printArea .mod-3:not(.lay-thermal) .doc-header{background:#20364f;color:#fff;border:0;padding:8mm;margin-bottom:8mm}
#printArea .mod-3:not(.lay-thermal) .brand-info h2,#printArea .mod-3:not(.lay-thermal) .col-meta h1{color:#fff}
#printArea .mod-3:not(.lay-thermal) .brand-info p,#printArea .mod-3:not(.lay-thermal) .col-meta p{color:#e2eaf3}
#printArea .mod-3:not(.lay-thermal) .col-meta h1{font-size:19pt;letter-spacing:.08em}
#printArea .mod-3:not(.lay-thermal) .document-parties{background:#f0f3f7;border:1px solid #cbd4df;border-radius:0}
#printArea .mod-3:not(.lay-thermal) .party-label{color:#20364f}
#printArea .mod-3:not(.lay-thermal) .item-table th{background:#20364f;color:#fff;border-color:#20364f}
#printArea .mod-3:not(.lay-thermal) .item-table td{border-color:#bfc9d5}
#printArea .mod-3:not(.lay-thermal) .item-table tbody tr:nth-child(even){background:#f1f4f8}
#printArea .mod-3:not(.lay-thermal) .total-box h2{background:#e7edf4;border-top:3px solid #20364f;color:#20364f}
#printArea .mod-3:not(.lay-thermal) .document-footer{border-top:2px solid #20364f}

/* 4 — Retail / toko harian: aksen hijau, pita total yang menonjol */
#printArea .mod-4:not(.lay-thermal) .doc-header{background:#eff8f1;border:0;border-left:5px solid #218653;padding:7mm;margin-bottom:7mm}
#printArea .mod-4:not(.lay-thermal) .brand-info h2,#printArea .mod-4:not(.lay-thermal) .col-meta h1{color:#17683f}
#printArea .mod-4:not(.lay-thermal) .col-meta h1{font-size:21pt;letter-spacing:-.025em}
#printArea .mod-4:not(.lay-thermal) .document-parties{background:#fff;border:1px solid #b9dfc7;border-left:4px solid #218653;border-radius:0}
#printArea .mod-4:not(.lay-thermal) .item-table th{background:#218653;border-color:#218653;color:#fff}
#printArea .mod-4:not(.lay-thermal) .item-table td{border-color:#d7e8dc}
#printArea .mod-4:not(.lay-thermal) .item-table tbody tr:nth-child(even){background:#f2faf4}
#printArea .mod-4:not(.lay-thermal) .total-box h2{background:#218653;border:0;color:#fff;padding:4mm}
#printArea .mod-4:not(.lay-thermal) .grand-total-row{background:#e7f5eb;border-color:#218653}
#printArea .mod-4:not(.lay-thermal) .grand-total-row h2{color:#145c37}

/* 5 — Premium: tipografi serif, tinta arang, aksen emas */
#printArea .mod-5:not(.lay-thermal){font-family:Georgia,'Times New Roman',serif;color:#292722}
#printArea .mod-5:not(.lay-thermal) .doc-header{border-top:1px solid #b79b5b;border-bottom:1px solid #b79b5b;padding:7mm 0;margin-bottom:9mm}
#printArea .mod-5:not(.lay-thermal) .brand-info h2,#printArea .mod-5:not(.lay-thermal) .col-meta h1{font-family:Georgia,'Times New Roman',serif;color:#6d5528}
#printArea .mod-5:not(.lay-thermal) .col-meta h1{font-size:22pt;font-weight:400;letter-spacing:.04em}
#printArea .mod-5:not(.lay-thermal) .document-parties{background:#fbf8f0;border:1px solid #dfd2b3;border-radius:0;padding:5mm}
#printArea .mod-5:not(.lay-thermal) .party-label{color:#806a3d}
#printArea .mod-5:not(.lay-thermal) .item-table th{background:#35332e;color:#f8f1df;border-color:#35332e;font-weight:600;letter-spacing:.03em}
#printArea .mod-5:not(.lay-thermal) .item-table td{border-color:#ded7c8}
#printArea .mod-5:not(.lay-thermal) .item-table tbody tr:nth-child(even){background:#fbf9f4}
#printArea .mod-5:not(.lay-thermal) .total-box h2{background:#f6f0df;border-top:1px solid #b79b5b;border-bottom:1px solid #b79b5b;color:#5f4b25;font-family:Georgia,'Times New Roman',serif;font-weight:700}
#printArea .mod-5:not(.lay-thermal) .document-footer{border-top:1px solid #b79b5b;color:#806a3d}

/* 6 — Gudang / akuntansi: tabel padat, angka mudah diaudit */
#printArea .mod-6:not(.lay-thermal){font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#25313d}
#printArea .mod-6:not(.lay-thermal) .doc-header{border:1px solid #9aa8b7;border-bottom:3px solid #536b83;padding:5mm;margin-bottom:6mm}
#printArea .mod-6:not(.lay-thermal) .brand-info h2{color:#354d65;font-size:14pt}
#printArea .mod-6:not(.lay-thermal) .col-meta h1{color:#354d65;font-size:18pt;letter-spacing:.03em}
#printArea .mod-6:not(.lay-thermal) .document-parties{background:#f4f6f8;border:1px solid #c7d0d9;padding:3mm 4mm;margin-bottom:5mm}
#printArea .mod-6:not(.lay-thermal) .item-table{font-size:8pt}
#printArea .mod-6:not(.lay-thermal) .item-table th{background:#dfe6ed;color:#263a4d;border:1px solid #aebbc8;padding:2mm 1.5mm}
#printArea .mod-6:not(.lay-thermal) .item-table td{border:1px solid #c4cdd6;padding:2mm 1.5mm}
#printArea .mod-6:not(.lay-thermal) .item-table tbody tr:nth-child(even){background:#f6f8fa}
#printArea .mod-6:not(.lay-thermal) .doc-footer{margin-top:5mm;padding-top:4mm;border-top:1px solid #9eabb8}
#printArea .mod-6:not(.lay-thermal) .amount-row{padding:1.5mm 0}
#printArea .mod-6:not(.lay-thermal) .grand-total-row{background:#e8edf2;border:1px solid #9eabb8;padding:2.5mm}
#printArea .mod-6:not(.lay-thermal) .grand-total-row h2{color:#253d55;font-size:11pt}
#printArea .mod-6:not(.lay-thermal) .doc-sign{margin-top:12mm}

/* Thermal tetap monokrom seperti struk toko; tiap model punya karakter tata letak */
#printArea .lay-thermal.mod-1 .doc-header{display:block;text-align:center;border-bottom:1px dashed #111;padding-bottom:3mm}
#printArea .lay-thermal.mod-1 .col-brand{display:block;max-width:100%;text-align:center}
#printArea .lay-thermal.mod-1 .brand-info h2{font-weight:900;letter-spacing:.02em}
#printArea .lay-thermal.mod-1 .col-meta h1{font-weight:900}
#printArea .lay-thermal.mod-2 .doc-header{display:block;text-align:left;border-bottom:1px solid #555;padding-bottom:2mm}
#printArea .lay-thermal.mod-2 .col-brand{display:block;max-width:100%}
#printArea .lay-thermal.mod-2 .brand-info h2{font-weight:500}
#printArea .lay-thermal.mod-2 .thermal-table td{border-bottom:1px solid #ddd!important}
#printArea .lay-thermal.mod-2 .total-box h2{border-top:1px solid #111!important;border-bottom:1px solid #111}
#printArea .lay-thermal.mod-3 .doc-header{display:block;text-align:center;border-bottom:3px double #111;padding-bottom:3mm}
#printArea .lay-thermal.mod-3 .col-brand{display:block;max-width:100%;text-align:center}
#printArea .lay-thermal.mod-3 .brand-info h2{font-weight:900;text-transform:uppercase}
#printArea .lay-thermal.mod-3 .thermal-table td{border-bottom:1px dashed #111!important}
#printArea .lay-thermal.mod-3 .total-box h2{border-top:2px solid #111!important;font-size:12pt}
#printArea .lay-thermal.mod-4 .doc-header{display:block;text-align:center;border:2px solid #111;padding:2mm;margin-bottom:3mm}
#printArea .lay-thermal.mod-4 .col-brand{display:block;max-width:100%;text-align:center}
#printArea .lay-thermal.mod-4 .thermal-product-name{font-weight:900}
#printArea .lay-thermal.mod-4 .thermal-table td{border-bottom:1px dotted #555!important}
#printArea .lay-thermal.mod-4 .total-box h2{border:2px solid #111!important;padding:2mm!important;text-align:center}
#printArea .lay-thermal.mod-5 .doc-header{display:block;text-align:center;border-top:1px solid #111;border-bottom:1px solid #111;padding:3mm 0}
#printArea .lay-thermal.mod-5 .col-brand{display:block;max-width:100%;text-align:center}
#printArea .lay-thermal.mod-5 .brand-info h2{font-family:Georgia,'Times New Roman',serif;font-weight:400}
#printArea .lay-thermal.mod-5 .thermal-product-name{font-weight:500}
#printArea .lay-thermal.mod-5 .thermal-table td{border-bottom:1px solid #bbb!important}
#printArea .lay-thermal.mod-6 .doc-header{display:block;text-align:left;border-bottom:2px solid #111;padding-bottom:2mm}
#printArea .lay-thermal.mod-6 .col-brand{display:block;max-width:100%}
#printArea .lay-thermal.mod-6 .brand-info h2{font-size:10pt!important}
#printArea .lay-thermal.mod-6 .col-meta h1{font-size:9pt!important;text-align:left}
#printArea .lay-thermal.mod-6 .thermal-product-math{font-size:7.5pt!important}
#printArea .lay-thermal.mod-6 .thermal-table td{padding:1.5mm 0!important;border-bottom:1px solid #aaa!important}
#printArea .lay-thermal.mod-6 .total-box h2{font-size:10pt!important;border-top:2px solid #111!important}

/* Jaga agar nama barang tidak pecah per huruf pada format lebar */
#printArea .item-table td:nth-child(2){overflow-wrap:break-word;word-break:normal;hyphens:none}
#printArea .item-table td.right{white-space:nowrap;overflow-wrap:normal;word-break:normal}
#printArea .lay-a5 .item-table{font-size:7.7pt}
#printArea .lay-a5 .item-table th,#printArea .lay-a5 .item-table td{padding-left:1.4mm;padding-right:1.4mm}
#printArea .lay-thermal .thermal-product-name{word-break:normal;overflow-wrap:break-word;hyphens:none}

`;
    document.head.appendChild(style);
}

function renderThermal(trx, brand, logo) {
    return `<div class="${trx.layout} ${trx.model}" style="--brand:${brand}">
      <header class="doc-header"><div class="col-brand">${logo}<div class="brand-info"><h2>${escapeHtml(trx.namaToko)}</h2><p>${escapeHtml(trx.kontakToko)}</p></div></div>
      <div class="col-meta"><h1>${trx.judulInvoice}</h1><p>No: ${escapeHtml(trx.noNota)}</p><p>Tanggal: ${escapeHtml(trx.tanggal)}</p>${trx.inputEkstra ? `<p class="client-box">Pelanggan: ${escapeHtml(trx.inputEkstra)}</p>` : ''}</div></header>
      <table class="item-table thermal-table"><thead><tr><th>Rincian barang</th></tr></thead><tbody>${barisItemHTML(trx)}</tbody></table>
      <div class="doc-footer"><div class="thermal-total-line"><span>Subtotal</span><strong>${uang(trx.subtotal)}</strong></div>${trx.totalDiskon ? `<div class="thermal-total-line"><span>Total diskon</span><strong>-${rupiah(trx.totalDiskon)}</strong></div>` : ''}<div class="total-box"><h2>TOTAL ${uang(trx.total)}</h2>${trx.tunai > 0 ? `<p>Tunai: ${uang(trx.tunai)}<br>Kembalian: ${uang(trx.kembalian)}</p>` : `<p>Terima kasih atas transaksi Anda.</p>`}</div></div>
      <div class="doc-sign"><p>Terima kasih telah berbelanja.</p><div class="thermal-sign">Simpan struk ini sebagai bukti transaksi.</div></div></div>`;
}
function renderHtmlTemplate(trx) {
    pastikanGayaDokumen();
    const color = dataWarna[Number(trx.warnaIndex) || 0]?.warna || dataWarna[0].warna;
    const logo = trx.logoBase64 ? `<img src="${trx.logoBase64}" class="print-logo" alt="Logo usaha">` : '';
    const sig = trx.sigBase64 ? `<img src="${trx.sigBase64}" class="signature-image" alt="Tanda tangan">` : '';
    const stamp = trx.stampBase64 ? `<img src="${trx.stampBase64}" class="stamp-image" alt="Stempel usaha">` : '';
    if (trx.layout === 'lay-thermal') return renderThermal(trx, color, logo);

    const isSJ = trx.layout === 'lay-sj';
    const header = `<header class="doc-header"><div class="col-brand">${logo}<div class="brand-info"><h2>${escapeHtml(trx.namaToko)}</h2><p>${escapeHtml(trx.kontakToko)}</p></div></div>
      <div class="col-meta"><h1>${trx.judulInvoice}</h1><p><strong>No. Dokumen</strong>: ${escapeHtml(trx.noNota)}</p><p><strong>Tanggal</strong>: ${escapeHtml(trx.tanggal)}</p>${!isSJ ? `<p><strong>Jatuh tempo</strong>: Sesuai kesepakatan</p>` : ''}</div></header>`;
    const customer = `<section class="document-parties"><div><span class="party-label">${isSJ ? 'PENERIMA / TUJUAN' : 'DITAGIHKAN KEPADA'}</span><strong>${escapeHtml(trx.inputEkstra || (isSJ ? 'Penerima barang' : 'Pelanggan umum'))}</strong><p>${isSJ ? 'Periksa jumlah dan kondisi barang saat diterima.' : 'Mohon periksa rincian barang dan nilai tagihan.'}</p></div><div><span class="party-label">${isSJ ? 'INFORMASI PENGIRIMAN' : 'INFORMASI TRANSAKSI'}</span><strong>${isSJ ? escapeHtml(trx.namaToko) : escapeHtml(trx.tanggal)}</strong><p>${isSJ ? escapeHtml(trx.kontakToko || 'Kontak pengirim tidak dicantumkan') : `Nomor dokumen: ${escapeHtml(trx.noNota)}`}</p></div></section>`;
    const table = `<table class="item-table"><thead><tr><th>No.</th><th>${isSJ ? 'Nama barang / keterangan' : 'Deskripsi barang / layanan'}</th><th>${isSJ ? 'Qty kirim' : 'Qty'}</th>${isSJ ? '<th>Keterangan penerimaan</th>' : '<th>Harga satuan (Rp)</th><th>Jumlah (Rp)</th>'}</tr></thead><tbody>${barisItemHTML(trx)}</tbody></table>`;
    const totals = isSJ ? '' : `<section class="doc-footer"><div class="payment-note"><strong>Catatan</strong><p>${trx.tunai >= trx.total && trx.tunai > 0 ? 'Pembayaran diterima. Terima kasih telah berbelanja.' : 'Mohon simpan dokumen ini sebagai bukti transaksi.'}</p><p>Dokumen: ${escapeHtml(trx.noNota)}</p></div><div class="total-box"><div class="amount-row"><span>Subtotal</span><strong>${uang(trx.subtotal)}</strong></div>${trx.totalDiskon ? `<div class="amount-row"><span>Total diskon</span><strong>-${uang(trx.totalDiskon)}</strong></div>` : ''}<div class="amount-row grand-total-row"><span>Total tagihan</span><h2>${uang(trx.total)}</h2></div>${trx.tunai > 0 ? `<div class="amount-row"><span>Pembayaran tunai</span><strong>${uang(trx.tunai)}</strong></div><div class="amount-row"><span>Kembalian</span><strong>${uang(trx.kembalian)}</strong></div>` : ''}</div></section>`;
    const signatures = isSJ ? `<section class="doc-sign delivery-sign"><div><strong>Disiapkan oleh</strong><span class="signature-space"></span><p>( ____________________ )</p></div><div><strong>Pengemudi / kurir</strong><span class="signature-space"></span><p>( ____________________ )</p></div><div><strong>Diterima oleh</strong><span class="signature-space"></span><p>Nama dan tanggal: __________________</p></div></section>` : `<section class="doc-sign invoice-sign"><div><strong>Pelanggan</strong><span class="signature-space"></span><p>( ____________________ )</p></div><div class="issuer-sign"><strong>Hormat kami,</strong><div class="signature-stack">${stamp}${sig}</div><p><b>${escapeHtml(trx.namaToko)}</b></p></div></section>`;
    const footer = `<footer class="document-footer"><span>${isSJ ? 'Dokumen pengiriman barang' : 'Dokumen ini diterbitkan oleh ' + escapeHtml(trx.namaToko)}</span><span>${escapeHtml(trx.noNota)}</span></footer>`;
    return `<article class="${trx.layout} ${trx.model}" style="--brand:${color}"><div class="bg-watermark"></div>${header}${customer}<main class="doc-body">${table}</main>${totals}${signatures}${footer}</article>`;
}

function prosesNotaBaru() {
    const trx = kumpulkanTransaksi();
    simpanTransaksi(trx);
    return trx;
}
function siapkanDokumen(trx, untukPDF = false) {
    const area = $('printArea');
    area.innerHTML = renderHtmlTemplate(trx);
    area.setAttribute('aria-hidden', 'false');
    if (untukPDF) area.style.display = 'block';

    // Ukuran halaman cetak mengikuti jenis nota yang dipilih.
    let aturanHalaman = '@page { size: A4 portrait; margin: 10mm; }';
    if (trx.layout === 'lay-a5') aturanHalaman = '@page { size: A5 portrait; margin: 8mm; }';
    if (trx.layout === 'lay-thermal') aturanHalaman = '@page { size: 80mm auto; margin: 0; }';
    let gayaHalaman = document.getElementById('dynamicPrintPageStyle');
    if (!gayaHalaman) {
        gayaHalaman = document.createElement('style');
        gayaHalaman.id = 'dynamicPrintPageStyle';
        document.head.appendChild(gayaHalaman);
    }
    gayaHalaman.textContent = `@media print { ${aturanHalaman} }`;
    return area;
}
function pulihkanAreaCetak() {
    const area = $('printArea');
    if (area) { area.style.display = ''; area.setAttribute('aria-hidden', 'true'); }
}
function cetakNotaTerpisah(trx) {
    // Cetak melalui jendela dokumen khusus agar dashboard, kontrol aplikasi,
    // dan alamat file lokal tidak menjadi bagian dari lembar nota.
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) {
        alert('Jendela cetak diblokir browser. Izinkan pop-up untuk situs/file ini lalu coba lagi.');
        return false;
    }
    pastikanGayaDokumen();
    const areaHTML = renderHtmlTemplate(trx);
    const stylesheet = document.querySelector('link[rel="stylesheet"]');
    const cssHref = stylesheet ? stylesheet.href : '';
    const pageSize = trx.layout === 'lay-thermal'
        ? '80mm auto'
        : trx.layout === 'lay-a5' ? 'A5 portrait' : 'A4 portrait';
    const pageMargin = trx.layout === 'lay-thermal' ? '0' : '8mm';
    const inlineStyles = Array.from(document.querySelectorAll('#generatedDocumentStyles, #dynamicPrintPageStyle'))
        .map(el => el.textContent).join('\n');
    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nota ${escapeHtml(trx.noNota)}</title>${cssHref ? `<link rel="stylesheet" href="${escapeHtml(cssHref)}">` : ''}<style>
      ${inlineStyles}
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      html,body { margin:0!important; padding:0!important; width:100%; min-width:0!important; background:#fff!important; }
      body { color:#111; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      #printArea { display:block!important; width:100%; margin:0!important; padding:0!important; overflow:visible!important; background:#fff!important; }
      #printArea .lay-thermal { width:72mm!important; max-width:72mm!important; margin:0!important; padding:3mm 2mm!important; box-shadow:none!important; }
      #printArea .lay-a5 { width:100%!important; min-height:0!important; padding:0!important; margin:0!important; box-shadow:none!important; }
      #printArea .lay-a4,#printArea .lay-sj { width:100%!important; min-height:0!important; padding:0!important; margin:0!important; box-shadow:none!important; }
      #printArea .doc-header,#printArea .doc-footer,#printArea .doc-sign,#printArea .document-parties { break-inside:avoid; page-break-inside:avoid; }
      #printArea .item-table { width:100%; }
      #printArea .lay-thermal .thermal-table td,#printArea .lay-thermal .thermal-table td:first-child { width:100%!important; max-width:100%!important; }
      #printArea .lay-thermal .thermal-product-name { display:block; width:100%; white-space:normal; overflow-wrap:break-word; word-break:normal; }
      #printArea .lay-thermal .thermal-product-math { display:flex; width:100%; justify-content:space-between; gap:2mm; }
      #printArea .lay-thermal .thermal-product-math span:last-child { flex-shrink:0; white-space:nowrap; }
      /* Detail barang rata kiri; hanya nilai subtotal yang rata kanan. */
      #printArea .lay-thermal .thermal-table,
      #printArea .lay-thermal .thermal-table tbody,
      #printArea .lay-thermal .thermal-table tr.thermal-item,
      #printArea .lay-thermal .thermal-table td,
      #printArea .lay-thermal .thermal-product-name,
      #printArea .lay-thermal .thermal-product-math,
      #printArea .lay-thermal .thermal-product-math span:first-child { text-align:left!important; }
      #printArea .lay-thermal .thermal-product-math span:last-child { text-align:right!important; }
      #printArea .item-table thead { display:table-header-group; }
      #printArea .item-table tr { break-inside:avoid; page-break-inside:avoid; }
      @media screen { body { padding:12px!important; background:#eef1f5!important; } #printArea { width:max-content; max-width:100%; margin:0 auto!important; box-shadow:0 2px 16px #0001; } }
      @media print { html,body { margin:0!important; padding:0!important; background:#fff!important; } body { padding:0!important; } #printArea { box-shadow:none!important; } }
    </style></head><body><div id="printArea">${areaHTML}</div></body></html>`);
    popup.document.close();
    const doPrint = () => {
        try { popup.focus(); popup.print(); }
        catch (err) { console.error(err); alert('Jendela cetak tidak dapat dibuka. Coba unduh sebagai PDF.'); }
    };
    // Tunggu stylesheet dan logo lokal selesai dimuat sebelum membuka dialog cetak.
    const images = Array.from(popup.document.images);
    Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve; img.onerror = resolve;
    }))).then(() => setTimeout(doPrint, 250));
    popup.onafterprint = () => setTimeout(() => popup.close(), 300);
    return true;
}
window.cetakMatrix = function () {
    if (!keranjang.length) return alert('Tambahkan setidaknya satu item sebelum mencetak dokumen.');
    const trx = prosesNotaBaru();
    cetakNotaTerpisah(trx);
};
function opsiPDF(trx) {
    let format = 'a4';
    if (trx.layout === 'lay-a5') format = 'a5';
    if (trx.layout === 'lay-thermal') {
        const estimatedHeight = Math.max(120, 85 + trx.items.reduce((sum, item) => sum + 12 + Math.ceil(String(item.nama).length / 24) * 4, 0));
        format = [80, estimatedHeight];
    }
    return {
        margin: trx.layout === 'lay-thermal' ? [0, 0, 0, 0] : [0, 0, 0, 0],
        filename: `${trx.noNota.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
        jsPDF: { unit: 'mm', format, orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.doc-header', '.doc-footer', '.doc-sign'] }
    };
}
window.unduhPDF = async function () {
    if (!keranjang.length) return alert('Tambahkan setidaknya satu item sebelum mengunduh PDF.');
    if (!window.html2pdf) return alert('Pustaka PDF belum dimuat. Periksa koneksi internet lalu coba lagi.');
    const trx = prosesNotaBaru(); const area = siapkanDokumen(trx, true);
    try { await html2pdf().set(opsiPDF(trx)).from(area.firstElementChild).save(); }
    catch (error) { console.error(error); alert('PDF gagal dibuat. Silakan coba kembali melalui tombol cetak.'); }
    finally { pulihkanAreaCetak(); }
};
window.cetakUlang = function (index) {
    const trx = riwayatTransaksi[Number(index)];
    if (!trx) return alert('Data transaksi tidak ditemukan.');
    cetakNotaTerpisah(trx);
};
window.unduhPDFUlang = async function (index) {
    const trx = riwayatTransaksi[Number(index)]; if (!trx) return alert('Data transaksi tidak ditemukan.');
    if (!window.html2pdf) return alert('Pustaka PDF belum dimuat.');
    const area = siapkanDokumen(trx, true);
    try { await html2pdf().set(opsiPDF(trx)).from(area.firstElementChild).save(); }
    catch (error) { console.error(error); alert('PDF gagal dibuat. Silakan coba kembali.'); }
    finally { pulihkanAreaCetak(); }
};

function tampilkanRiwayat() {
    const container = $('daftarRiwayat'); if (!container) return;
    if (!riwayatTransaksi.length) {
        container.innerHTML = '<p class="empty-state">Belum ada riwayat transaksi.</p>'; return;
    }
    container.innerHTML = riwayatTransaksi.map((trx, index) => `<article class="history-item"><div class="history-item-info"><strong>${escapeHtml(trx.noNota || 'Dokumen lama')}</strong><span>${escapeHtml(trx.tanggal || '-')} · ${escapeHtml(trx.judulInvoice || 'Transaksi')}</span><b>${uang(trx.total)}</b><small>${escapeHtml(trx.inputEkstra || 'Pelanggan umum')}</small></div><div class="history-item-actions"><button type="button" class="btn btn-secondary btn-small" onclick="cetakUlang(${index})">Cetak</button><button type="button" class="btn btn-primary btn-small" onclick="unduhPDFUlang(${index})">PDF</button><button type="button" class="btn btn-danger btn-small" onclick="hapusItemRiwayat(${index})" aria-label="Hapus riwayat">Hapus</button></div></article>`).join('');
}
window.hapusItemRiwayat = function (index) {
    if (!riwayatTransaksi[Number(index)]) return;
    if (!confirm('Hapus dokumen ini dari riwayat pada perangkat ini?')) return;
    riwayatTransaksi.splice(Number(index), 1); simpanRiwayat(); tampilkanRiwayat();
};
window.hapusRiwayat = function () {
    if (!riwayatTransaksi.length) return;
    if (!confirm('Hapus seluruh riwayat transaksi pada perangkat ini? Tindakan ini tidak dapat dibatalkan.')) return;
    riwayatTransaksi = []; localStorage.removeItem('pos_history'); tampilkanRiwayat();
};

function bacaGambar(inputId, storageKey, setter, label) {
    const input = $(inputId); if (!input) return;
    input.addEventListener('change', event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Pilih file gambar yang valid.'); input.value = ''; return; }
        if (file.size > 2 * 1024 * 1024) { alert('Ukuran gambar maksimal 2 MB agar dokumen tetap ringan.'); input.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => { setter(reader.result); localStorage.setItem(storageKey, reader.result); alert(`${label} berhasil disimpan pada browser ini.`); };
        reader.onerror = () => alert(`Gagal membaca ${label.toLowerCase()}.`);
        reader.readAsDataURL(file);
    });
}

window.addEventListener('afterprint', () => {
    sedangMencetak = false;
    pulihkanAreaCetak();
});

document.addEventListener('DOMContentLoaded', async () => {
    if ($('tgl')) $('tgl').textContent = tanggalHariIni();
    if (window.dbClient) {
        try {
            const { data: { session } } = await window.dbClient.auth.getSession();
            if (session) {
                if ($('loginScreen')) $('loginScreen').style.display = 'none';
                if ($('userEmailDisplay')) $('userEmailDisplay').textContent = session.user.email || 'Akun aktif';
            } else if ($('loginScreen')) $('loginScreen').style.display = 'flex';
        } catch (error) { console.error('Pemeriksaan sesi gagal:', error); }
    }
    muatWarnaNota(); muatPelanggan(); muatKatalog(); tampilkanTabel(); tampilkanRiwayat();
    bacaGambar('logoUpload', 'pos_logo', value => logoBase64 = value, 'Logo usaha');
    bacaGambar('sigUpload', 'pos_sig', value => sigBase64 = value, 'Tanda tangan');
    bacaGambar('stampUpload', 'pos_stamp', value => stampBase64 = value, 'Stempel digital');
    if ($('manualTanggal')) $('manualTanggal').max = tanggalISO();
});
