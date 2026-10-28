// ==========================================
// 0. KONFIGURASI SUPABASE AMAN & GLOBAL
// ==========================================
const SUPABASE_URL = 'https://yrdsuepevxftxxkouajz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zAK3nmIMuYtd0LIV3C72dg__D615Jfg';

let supabase = null;
try {
    if (window.supabase && !window.supabaseClientInstance) {
        window.supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    supabase = window.supabaseClientInstance;
} catch (err) {
    console.error("Ralat memulakan Supabase:", err);
}

// Cek Sesi Pengguna saat halaman dimuat
document.addEventListener("DOMContentLoaded", async () => {
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('userEmailDisplay').innerText = session.user.email;
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
        }
    }
});

// Fungsi Login Global
window.prosesLogin = async function prosesLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errEl = document.getElementById('loginError');

    if (!email || !password) {
        errEl.innerText = "Email dan password wajib diisi!";
        errEl.style.display = 'block';
        return;
    }

    if (!supabase) {
        errEl.innerText = "Koneksi Supabase belum siap!";
        errEl.style.display = 'block';
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        errEl.innerText = "Login gagal: " + error.message;
        errEl.style.display = 'block';
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        location.reload();
    }
};

// Fungsi Logout Global
window.prosesLogout = async function prosesLogout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    location.reload();
};

// ==========================================
// 1. DATABASE WARNA, PELANGGAN, KATALOG & RIWAYAT
// ==========================================
const dataWarna = [
    { nama: 'Biru', warna: '#3b82f6' },
    { nama: 'Hijau', warna: '#10b981' },
    { nama: 'Merah', warna: '#ef4444' },
    { nama: 'Kuning', warna: '#d97706' },
    { nama: 'Ungu', warna: '#8b5cf6' },
    { nama: 'Cyan', warna: '#06b6d4' },
    { nama: 'Pink', warna: '#ec4899' },
    { nama: 'Navy', warna: '#1e293b' },
    { nama: 'Oranye', warna: '#f97316' },
    { nama: 'Abu-abu', warna: '#475569' }
];

let keranjang = JSON.parse(localStorage.getItem('pos_cart')) || [];
let daftarPelanggan = JSON.parse(localStorage.getItem('pos_customers')) || [];
let katalogProduk = JSON.parse(localStorage.getItem('pos_catalog')) || [];
let riwayatTransaksi = JSON.parse(localStorage.getItem('pos_history')) || [];

let grandTotal = 0;
let logoBase64 = localStorage.getItem('pos_logo') || '';
let sigBase64 = localStorage.getItem('pos_sig') || '';
let stampBase64 = localStorage.getItem('pos_stamp') || '';

document.getElementById('tgl').innerText = new Date().toLocaleDateString('id-ID');
const selWarna = document.getElementById('warnaNota');

function muatWarnaNota() {
    selWarna.innerHTML = '';
    dataWarna.forEach((item, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.innerText = item.nama;
        selWarna.appendChild(opt);
    });
    gantiWarnaNota();
}

function gantiWarnaNota() {
    let indexDipilih = selWarna.value;
    let item = dataWarna[indexDipilih];
    document.documentElement.style.setProperty('--primary', item.warna);
}

// Manajemen Pelanggan
function muatPelanggan() {
    const select = document.getElementById('pilihPelanggan');
    if (!select) return;
    select.innerHTML = '<option value="">-- Belum Ada Pelanggan Tersimpan --</option>';
    daftarPelanggan.forEach((pelanggan, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.innerText = pelanggan.nama;
        select.appendChild(opt);
    });
}

function simpanPelangganBaru() {
    let nama = document.getElementById('namaKlienBaru').value.trim();
    let kontak = document.getElementById('kontakKlienBaru').value.trim();
    if (!nama) return alert("Mohon masukkan nama klien terlebih dahulu.");
    
    daftarPelanggan.push({ nama, kontak });
    localStorage.setItem('pos_customers', JSON.stringify(daftarPelanggan));
    
    document.getElementById('namaKlienBaru').value = '';
    document.getElementById('kontakKlienBaru').value = '';
    muatPelanggan();
    alert("Data pelanggan berhasil disimpan.");
}

function pilihPelangganAktif() {
    let index = document.getElementById('pilihPelanggan').value;
    if (index === "") return;
    let p = daftarPelanggan[index];
    document.getElementById('inputEkstra').value = `${p.nama} (${p.kontak})`;
}

// Manajemen Katalog Produk & Stok
function muatKatalog() {
    const select = document.getElementById('pilihKatalog');
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Produk dari Katalog --</option>';
    katalogProduk.forEach((prod, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.innerText = `${prod.nama} — Rp ${formatRp(prod.harga)} (Stok: ${prod.stok})`;
        select.appendChild(opt);
    });
}

function simpanProdukBaru() {
    let nama = document.getElementById('namaProdukBaru').value.trim();
    let harga = parseFloat(document.getElementById('hargaProdukBaru').value) || 0;
    let stok = parseInt(document.getElementById('stokProdukBaru').value) || 0;
    
    if (!nama || harga <= 0) return alert("Mohon lengkapi nama dan harga produk.");
    
    katalogProduk.push({ nama, harga, stok });
    localStorage.setItem('pos_catalog', JSON.stringify(katalogProduk));
    
    document.getElementById('namaProdukBaru').value = '';
    document.getElementById('hargaProdukBaru').value = '';
    document.getElementById('stokProdukBaru').value = '';
    muatKatalog();
    alert("Produk berhasil ditambahkan ke katalog.");
}

function pilihProdukKatalog() {
    let index = document.getElementById('pilihKatalog').value;
    if (index === "") return;
    let prod = katalogProduk[index];
    
    document.getElementById('nama').value = prod.nama;
    document.getElementById('harga').value = prod.harga;
    document.getElementById('qty').value = 1;
    document.getElementById('diskon').value = 0;
    document.getElementById('qty').focus();
}

// Manajemen Riwayat Struk Berdasarkan Tanggal
function tampilkanRiwayat() {
    const container = document.getElementById('daftarRiwayat');
    if (!container) return;
    
    if (riwayatTransaksi.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #94a3b8; font-size: 13px; margin:0;">Belum ada riwayat transaksi.</p>`;
        return;
    }

    let kelompokTanggal = {};
    riwayatTransaksi.forEach((trx, originalIndex) => {
        if (!kelompokTanggal[trx.tanggal]) {
            kelompokTanggal[trx.tanggal] = [];
        }
        kelompokTanggal[trx.tanggal].push({ ...trx, originalIndex });
    });

    let html = '';
    for (let tgl in kelompokTanggal) {
        html += `<div style="margin-bottom: 8px; font-size: 12px; font-weight: bold; color: var(--primary); border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">📅 ${tgl}</div>`;
        kelompokTanggal[tgl].forEach(trx => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border);">
                    <div>
                        <span style="font-weight: bold; color: #1e293b;">${trx.noNota}</span><br>
                        <span style="color: #64748b; font-size: 11px;">Total: Rp ${formatRp(trx.total)} | Ref: ${trx.inputEkstra || '-'}</span>
                    </div>
                    <div>
                        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; cursor:pointer;" onclick="cetakUlang(${trx.originalIndex})">Cetak</button>
                        <button class="btn btn-success" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; cursor:pointer;" onclick="unduhPDFUlang(${trx.originalIndex})">PDF</button>
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px; cursor:pointer;" onclick="hapusItemRiwayat(${trx.originalIndex})" title="Hapus Riwayat Ini">X</button>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

function hapusItemRiwayat(index) {
    if (confirm("Hapus riwayat transaksi ini?")) {
        riwayatTransaksi.splice(index, 1);
        localStorage.setItem('pos_history', JSON.stringify(riwayatTransaksi));
        tampilkanRiwayat();
    }
}

function hapusRiwayat() {
    if (confirm("Hapus seluruh riwayat transaksi tersimpan?")) {
        riwayatTransaksi = [];
        localStorage.removeItem('pos_history');
        tampilkanRiwayat();
    }
}

function toggleTanggal(isManual) {
    const inputTgl = document.getElementById('manualTanggal');
    inputTgl.style.display = isManual ? 'block' : 'none';
    if (isManual && !inputTgl.value) {
        inputTgl.value = new Date().toISOString().split('T')[0];
    }
}

muatWarnaNota();
muatPelanggan();
muatKatalog();
tampilkanTabel();
tampilkanRiwayat();

// Upload Logo
document.getElementById('logoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) { 
            logoBase64 = evt.target.result; 
            localStorage.setItem('pos_logo', logoBase64); 
            alert("Logo berhasil disimpan!"); 
        };
        reader.readAsDataURL(file);
    }
});

// Upload Tanda Tangan
document.getElementById('sigUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) { 
            sigBase64 = evt.target.result; 
            localStorage.setItem('pos_sig', sigBase64); 
            alert("Tanda tangan digital berhasil disimpan!"); 
        };
        reader.readAsDataURL(file);
    }
});

// Upload Stempel Digital
document.getElementById('stampUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) { 
            stampBase64 = evt.target.result; 
            localStorage.setItem('pos_stamp', stampBase64); 
            alert("Stempel digital berhasil disimpan!"); 
        };
        reader.readAsDataURL(file);
    }
});

function formatRp(angka) { return new Intl.NumberFormat('id-ID').format(angka); }
function simpanData() { localStorage.setItem('pos_cart', JSON.stringify(keranjang)); }

function tambahBarang() {
    let nama = document.getElementById("nama").value.trim();
    let harga = parseFloat(document.getElementById("harga").value) || 0;
    let diskon = parseFloat(document.getElementById("diskon").value) || 0;
    let qty = parseFloat(document.getElementById("qty").value) || 0;
    if (!nama || harga <= 0 || qty <= 0) return alert("Mohon lengkapi data item dengan benar.");
    
    keranjang.push({ nama, harga, diskon, qty, subtotal: (harga - diskon) * qty });
    
    document.getElementById("nama").value = ""; 
    document.getElementById("harga").value = ""; 
    document.getElementById("diskon").value = ""; 
    document.getElementById("qty").value = ""; 
    document.getElementById("pilihKatalog").value = "";
    document.getElementById("nama").focus();
    
    simpanData(); 
    tampilkanTabel();
}

function tampilkanTabel() {
    let tbody = document.getElementById("tabelKeranjang"); tbody.innerHTML = ""; grandTotal = 0;
    if (keranjang.length === 0) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Belum ada item transaksi</td></tr>`;
    else {
        keranjang.forEach((item, index) => {
            grandTotal += item.subtotal;
            tbody.innerHTML += `<tr><td>${index + 1}</td><td style="font-weight:600;">${item.nama}</td><td>${formatRp(item.harga)}</td><td>${formatRp(item.diskon)}</td><td>${item.qty}</td><td style="font-weight:bold;">${formatRp(item.subtotal)}</td><td style="text-align:center;"><button onclick="hapus(${index})" class="btn-danger" style="padding:4px 10px; font-weight:bold;">X</button></td></tr>`;
        });
    }
    document.getElementById("teksTotal").innerText = "Rp " + formatRp(grandTotal); hitungKembalian();
}

function hapus(index) { keranjang.splice(index, 1); simpanData(); tampilkanTabel(); }
function hitungKembalian() {
    let tunai = parseFloat(document.getElementById("tunai").value) || 0; let kemb = tunai - grandTotal;
    let el = document.getElementById("txtKembalian");
    if (kemb >= 0) { el.innerText = formatRp(kemb); el.style.color = "var(--success)"; } else { el.innerText = "Nominal Kurang"; el.style.color = "var(--danger)"; }
}
function batal() { if (keranjang.length > 0 && confirm("Konfirmasi: Batalkan seluruh transaksi ini?")) { keranjang = []; document.getElementById("tunai").value = ""; simpanData(); tampilkanTabel(); } }

function buatHtmlDokumen(noNota, tanggal) {
    const layout = document.getElementById('pilihLayout').value;
    const model = document.getElementById('pilihModel').value;

    const namaToko = document.getElementById('namaToko').value.trim() || "";
    const kontak = document.getElementById('kontakToko').value.trim() || "";
    
    const inputEkstra = document.getElementById('inputEkstra').value.trim() || "-";
    let tunai = parseFloat(document.getElementById('tunai').value) || 0;
    
    let judulInvoice = "INVOICE";
    if (layout === 'lay-sj') judulInvoice = "DELIVERY NOTE";
    else if (layout === 'lay-thermal') judulInvoice = ""; 
    
    let dataBaru = {
        noNota,
        tanggal,
        total: grandTotal,
        items: [...keranjang],
        namaToko,
        kontakToko: kontak,
        inputEkstra,
        layout,
        model,
        warnaIndex: document.getElementById('warnaNota').value,
        tunai,
        judulInvoice,
        logoBase64,
        sigBase64,
        stampBase64
    };

    riwayatTransaksi.push(dataBaru);
    localStorage.setItem('pos_history', JSON.stringify(riwayatTransaksi));
    tampilkanRiwayat();

    return renderHtmlTemplate(dataBaru);
}

function renderHtmlTemplate(trx) {
    const warnaBrand = dataWarna[trx.warnaIndex || 0].warna;
    const wmLogo = trx.logoBase64 ? `url(${trx.logoBase64})` : 'none';
    const tagLogo = trx.logoBase64 ? `<img src="${trx.logoBase64}" class="print-logo">` : '';
    
    // Render Tanda Tangan & Stempel Digital
    const tagSig = trx.sigBase64 ? `<img src="${trx.sigBase64}" style="max-height: 55px; display: block; margin: 0 auto;">` : '<br><br><br>';
    const tagStamp = trx.stampBase64 ? `<img src="${trx.stampBase64}" style="max-height: 65px; opacity: 0.85; position: absolute; left: -15px; top: -10px; z-index: 5; pointer-events: none;">` : '';

    let barisItem = '';
    trx.items.forEach((item, i) => { 
        if (trx.layout === 'lay-sj') {
            barisItem += `<tr><td style="text-align:center;">${i+1}</td><td>${item.nama}</td><td style="text-align:center; font-weight:bold;">${item.qty}</td><td></td></tr>`; 
        } else {
            barisItem += `<tr><td style="text-align:center;">${i+1}</td><td>${item.nama}</td><td style="text-align:center;">${item.qty}</td><td style="text-align:right;">${formatRp(item.harga)}</td><td style="text-align:right;">${formatRp(item.subtotal)}</td></tr>`; 
        }
    });

    const headerTokoHtml = (trx.namaToko || trx.kontakToko) ? `
        <div class="col-brand">
            ${tagLogo}
            <div class="brand-info">
                <h2>${trx.namaToko || ""}</h2>
                <p>${trx.kontakToko || ""}</p>
            </div>
        </div>` : `<div class="col-brand">${tagLogo}</div>`;

    return `
    <div class="${trx.layout} ${trx.model}" style="--brand: ${warnaBrand}; --wm: ${wmLogo};">
        <div class="bg-watermark"></div>
        <div class="doc-header">
            ${headerTokoHtml}
            <div class="col-meta">
                ${trx.judulInvoice ? `<h1>${trx.judulInvoice}</h1>` : ''}
                <p>Ref: ${trx.noNota}</p>
                <p>Date: ${trx.tanggal}</p>
                <div class="client-box">Client / Ref: ${trx.inputEkstra}</div>
            </div>
        </div>
        <div class="doc-body">
            <table class="item-table">
                <thead>
                    <tr>
                        <th width="5%" style="text-align:center;">No</th>
                        <th width="45%" style="text-align:left;">Deskripsi Layanan / Produk</th>
                        <th width="10%" style="text-align:center;">Qty</th>
                        ${trx.layout === 'lay-sj' ? '<th width="40%" style="text-align:center;">Keterangan Validasi</th>' : '<th width="20%" style="text-align:right;">Harga Satuan</th><th width="20%" style="text-align:right;">Jumlah</th>'}
                    </tr>
                </thead>
                <tbody>${barisItem}</tbody>
            </table>
        </div>
        ${trx.layout !== 'lay-sj' ? `
        <div class="doc-footer">
            <div class="total-box">
                <h2>TOTAL: Rp ${formatRp(trx.total)}</h2>
                ${trx.layout === 'lay-thermal' ? `<p>Tunai: Rp ${formatRp(trx.tunai || trx.total)} <br> Kembali: Rp ${formatRp((trx.tunai || trx.total) - trx.total)}</p>` : ''}
            </div>
        </div>` : ''}
        <div class="doc-sign">
            ${trx.layout === 'lay-thermal' ? '<div class="thermal-sign">Valid sebagai bukti transaksi</div>' : `
            <div>${trx.layout === 'lay-sj' ? 'Disetujui Oleh' : 'Pihak Klien'}<br><br><br><br>( ......................... )</div>
            ${trx.layout === 'lay-sj' ? '<div>Verifikasi Ekspedisi<br><br><br><br>( ......................... )</div>' : ''}
            <div>
                Manajemen Keuangan
                <div style="position: relative; display: inline-block; margin-top: 2px; min-width: 100px;">
                    ${tagStamp}
                    ${tagSig}
                </div>
                <b>${trx.namaToko || ""}</b>
            </div>`}
        </div>
    </div>`;
}

function prosesNotaBaru() {
    const noNota = "INV-" + Math.floor(Math.random() * 1000000);
    const tipeTanggal = document.querySelector('input[name="tipeTanggal"]:checked').value;
    let tanggal = '';
    if (tipeTanggal === 'manual') {
        const valManual = document.getElementById('manualTanggal').value;
        if (valManual) {
            const parts = valManual.split('-');
            tanggal = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            tanggal = new Date().toLocaleDateString('id-ID');
        }
    } else {
        tanggal = new Date().toLocaleDateString('id-ID');
    }
    return { noNota, tanggal };
}

function cetakMatrix() {
    if (keranjang.length === 0) return alert("Dokumen tidak dapat dicetak: Daftar item masih kosong.");
    let trxMeta = prosesNotaBaru();
    document.getElementById('printArea').innerHTML = buatHtmlDokumen(trxMeta.noNota, trxMeta.tanggal);
    window.print();
}

function unduhPDF() {
    if (keranjang.length === 0) return alert("Dokumen tidak dapat diunduh: Daftar item masih kosong.");
    let trxMeta = prosesNotaBaru();
    const element = document.getElementById('printArea');
    element.innerHTML = buatHtmlDokumen(trxMeta.noNota, trxMeta.tanggal);
    
    const opt = {
        margin:       10,
        filename:     `${trxMeta.noNota}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
}

function cetakUlang(index) {
    let trx = riwayatTransaksi[index];
    document.getElementById('printArea').innerHTML = renderHtmlTemplate(trx);
    window.print();
}

function unduhPDFUlang(index) {
    let trx = riwayatTransaksi[index];
    const element = document.getElementById('printArea');
    element.innerHTML = renderHtmlTemplate(trx);
    
    const opt = {
        margin:       10,
        filename:     `${trx.noNota}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
}