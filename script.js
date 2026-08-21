const GOOGLE_SCRIPT_URL = 'https://script.google.com/u/0/home/projects/1zO1xbpjzR3xnh6M-KuYptyVo1RCE8d3HsECnyClxZ8lA9Z_Po5L5_tkN/edit';

let cashOuts = [],attendances = [], products = [], cart = [], customers = [], transactions = [], usersData = [], currentUser = null, activeCategory = 'Kiloan', saldoAwal = 0;

const productGrid = document.getElementById('productGrid'), cartItemsContainer = document.getElementById('cartItems'), checkoutBtn = document.getElementById('checkoutBtn'), loginScreen = document.getElementById('loginScreen'), mainApp = document.getElementById('mainApp'), activeUserLabel = document.getElementById('activeUserLabel');

// --- SISTEM LOGIN & OTORISASI ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        if (document.getElementById('welcomeGreeting')) document.getElementById('welcomeGreeting').innerText = `Halo, ${currentUser.username} 👋`;

        const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
        const isOwner = currentUser.role.toLowerCase() === 'owner';
        const hasAccess = (feature) => isOwner || perms.includes(feature);

        if (document.getElementById('financeCard')) document.getElementById('financeCard').style.display = hasAccess('finance') ? 'block' : 'none';

        const toggleCard = (id, key) => { const el = document.getElementById(id); if (el) el.style.display = hasAccess(key) ? 'flex' : 'none'; };
        toggleCard('cardPos', 'pos');
        toggleCard('cardCashOut', 'cash_out');
        toggleCard('cardHistory', 'history');
        toggleCard('cardFinance', 'finance');
        toggleCard('cardAddService', 'catalog');
        toggleCard('cardSettings', 'settings');

        window.switchView('dashboardView');
        loadCatalogFromCloud();
    } else {
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

function hasCatalogAccess() {
    if (!currentUser) return false;
    if (currentUser.role.toLowerCase() === 'owner') return true;
    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    return perms.includes('catalog');
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPin').value.trim();
    if (!u || !p) { document.getElementById('loginMessage').innerText = "Isi Username dan PIN!"; return; }
    document.getElementById('loginBtn').innerText = "Memeriksa...";
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: u, pin: p }) })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role, permissions: data.permissions || "" }));
            checkSession();
        } else document.getElementById('loginMessage').innerText = "Username/PIN salah!";
    }).catch(() => { document.getElementById('loginMessage').innerText = "Gagal terhubung ke server. Cek koneksi internet."; })
    .finally(() => document.getElementById('loginBtn').innerText = "Masuk Aplikasi");
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); location.reload(); }
});

// --- MANAJEMEN USER & PERMISSIONS ---
function renderUsers() {
    const list = document.getElementById('userList');
    if (!list) return;
    list.innerHTML = '';
    usersData.forEach(user => {
        const card = document.createElement('div');
        card.classList.add('history-card');
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
            <div><span style="font-weight:700;">👤 ${user.username}</span><br><small>Role: ${user.role} | Izin: ${user.permissions || 'Tidak ada'}</small></div>
            <div style="display:flex; gap:5px;">
                <button onclick="openEditUser('${user.username}', '${user.pin}', '${user.role}', '${user.permissions}')" style="background:#e0f2f1; color:#007770; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">Edit</button>
                ${user.username !== currentUser.username ? `<button onclick="deleteUser('${user.username}')" style="background:#fee2e2; color:#991b1b; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">Hapus</button>` : ''}
            </div>
        </div>`;
        list.appendChild(card);
    });
}

window.openEditUser = function(u, p, r, perms) {
    document.getElementById('editUserLabel').innerText = u;
    document.getElementById('editUsername').value = u;
    document.getElementById('editUserPin').value = p;
    document.getElementById('editUserRole').value = r;
    const permsArr = perms ? perms.split(',') : [];
    const container = document.getElementById('editPermissionsContainer');
    container.innerHTML = ['pos', 'cash_out', 'history', 'finance', 'catalog', 'settings'].map(f => `
        <label><input type="checkbox" class="edit-perm" value="${f}" ${permsArr.includes(f) ? 'checked' : ''}> ${f.toUpperCase()}</label>
    `).join('');
    document.getElementById('editUserModal').style.display = 'flex';
};

document.getElementById('updateUserBtn').addEventListener('click', () => {
    const u = document.getElementById('editUsername').value, perms = Array.from(document.querySelectorAll('.edit-perm:checked')).map(cb => cb.value).join(',');
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "update_user", username: u, pin: document.getElementById('editUserPin').value, role: document.getElementById('editUserRole').value, permissions: perms }) })
    .then(() => { alert("Update berhasil!"); document.getElementById('editUserModal').style.display = 'none'; loadCatalogFromCloud(); });
});

document.getElementById('saveUserBtn').addEventListener('click', () => {
    const uName = document.getElementById('newUsername').value, perms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value).join(',');
    if (!uName || !document.getElementById('newUserPin').value) { alert('Username dan PIN wajib diisi!'); return; }
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "add_user", username: uName, pin: document.getElementById('newUserPin').value, role: document.getElementById('newUserRole').value, permissions: perms }) })
    .then(() => { alert("User ditambahkan!"); document.getElementById('addUserModal').style.display = 'none'; loadCatalogFromCloud(); });
});

window.deleteUser = function(username) {
    if (!confirm(`Hapus pengguna "${username}"?`)) return;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "delete_user", username }) })
    .then(res => res.json()).then(result => {
        if (result.status === 'success') loadCatalogFromCloud();
        else alert('Gagal menghapus pengguna.');
    }).catch(() => alert('Gagal terhubung ke server.'));
};

// --- NAVIGASI VIEW ---
window.switchView = function(viewId) {
    ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView', 'financeView', 'attendanceView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart();
    if (viewId === 'cashOutView') renderCashOutList();
    if (viewId === 'settingsView') renderUsers();
    if (viewId === 'financeView') renderFinanceDetail();
    if (viewId === 'attendanceView') initAttendancePage();
};

// --- MUAT DATA DARI CLOUD ---
function loadCatalogFromCloud() {
    fetch(GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime())
    .then(res => res.json()).then(data => {
        products = data.catalog || []; 
        customers = data.customers || []; 
        transactions = data.transactions || []; 
        cashOuts = data.cashOuts || []; 
        usersData = data.users || [];
        attendances = data.attendances || []; // <--- Tambahkan baris ini
        saldoAwal = Number(data.saldoAwal) || 0;
        
        renderProducts();
        renderFinance();
        renderCustomerDatalist();
        if (document.getElementById('historyView').style.display === 'block') renderHistory();
        if (document.getElementById('cashOutView').style.display === 'block') renderCashOutList();
        if (document.getElementById('settingsView').style.display === 'block') renderUsers();
        if (document.getElementById('financeView').style.display === 'block') renderFinanceDetail();
        if (document.getElementById('attendanceView').style.display === 'block') renderAttendanceList();
    }).catch(() => console.error('Gagal memuat data dari server.'));
}

// --- UTILITAS ---
function formatRupiah(num) {
    num = Number(num) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDateShort(d) {
    const date = new Date(d);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatWhatsApp(number) {
    let n = String(number || '').replace(/\D/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    else if (!n.startsWith('62')) n = '62' + n;
    return n;
}

// --- MODUL KASIR (POS): PRODUK & KERANJANG ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.category;
        renderProducts();
    });
});

function renderProducts() {
    if (!productGrid) return;
    const filtered = products.filter(p => (p.category || 'Kiloan') === activeCategory);
    if (filtered.length === 0) {
        productGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;padding:20px 0;">Belum ada layanan di kategori ini.</p>';
        return;
    }
    productGrid.innerHTML = filtered.map(p => `
        <div class="product-card" data-productid="${p.id}">
            <h4>${p.name}</h4>
            <p>${formatRupiah(p.price)}${p.category === 'Kiloan' ? '/kg' : ''}</p>
            ${hasCatalogAccess() ? `<button class="delete-product-btn" title="Hapus" onclick="event.stopPropagation(); deleteProduct('${p.id}')">×</button>` : ''}
        </div>
    `).join('');
}

productGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card || e.target.classList.contains('delete-product-btn')) return;
    const product = products.find(p => String(p.id) === card.dataset.productid);
    if (product) addToCart(product);
});

function addToCart(product) {
    const existing = cart.find(it => it.id === product.id);
    if (existing) {
        if (existing.category === 'Kiloan') existing.weight = Number(existing.weight) + 1;
        else existing.qty += 1;
    } else {
        cart.push({
            cartId: 'c' + Date.now() + Math.random().toString(16).slice(2),
            id: product.id,
            name: product.name,
            price: Number(product.price),
            category: product.category,
            qty: 1,
            weight: product.category === 'Kiloan' ? 1 : null
        });
    }
    renderCart();
    window.switchView('posView');
}

function renderCart() {
    if (!cartItemsContainer) return;
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:15px 0;">Belum ada item dipilih.</p>';
    } else {
        cartItemsContainer.innerHTML = cart.map(it => {
            const subtotal = it.category === 'Kiloan' ? it.price * it.weight : it.price * it.qty;
            const controlHtml = it.category === 'Kiloan'
                ? `<input type="number" min="0.1" step="0.1" class="qty-input cart-qty-input" data-cartid="${it.cartId}" data-field="weight" value="${it.weight}"> kg`
                : `<input type="number" min="1" step="1" class="qty-input cart-qty-input" data-cartid="${it.cartId}" data-field="qty" value="${it.qty}"> pcs`;
            return `
            <div class="cart-item-row" data-cartid="${it.cartId}">
                <div class="cart-item-info">
                    <span>${it.name}</span>
                    <div class="cart-item-qty">
                        ${controlHtml}
                        <span style="font-size:12px;color:var(--text-muted);">@ ${formatRupiah(it.price)}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="cart-subtotal" style="font-weight:700;font-size:13px;">${formatRupiah(subtotal)}</span>
                    <button class="btn-remove" data-cartid="${it.cartId}">✕</button>
                </div>
            </div>`;
        }).join('');
    }
    calculateTotal();
}

cartItemsContainer.addEventListener('input', (e) => {
    if (!e.target.classList.contains('cart-qty-input')) return;
    const id = e.target.dataset.cartid, field = e.target.dataset.field;
    const item = cart.find(c => c.cartId === id);
    if (!item) return;
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) val = field === 'weight' ? 0.1 : 1;
    item[field] = val;
    const row = e.target.closest('.cart-item-row');
    const subtotal = item.category === 'Kiloan' ? item.price * item.weight : item.price * item.qty;
    row.querySelector('.cart-subtotal').innerText = formatRupiah(subtotal);
    calculateTotal();
});

cartItemsContainer.addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-remove')) return;
    const id = e.target.dataset.cartid;
    cart = cart.filter(c => c.cartId !== id);
    renderCart();
});

function calculateTotal() {
    const total = cart.reduce((s, it) => s + (it.category === 'Kiloan' ? it.price * it.weight : it.price * it.qty), 0);
    const totalEl = document.getElementById('totalPrice');
    if (totalEl) totalEl.innerText = formatRupiah(total);
    updateChange();
    return total;
}

function updateChange() {
    const statusEl = document.getElementById('paymentStatus');
    const cashInput = document.getElementById('cashGiven');
    const changeEl = document.getElementById('changeAmount');
    if (!statusEl || !cashInput || !changeEl) return;
    const totalText = document.getElementById('totalPrice').innerText.replace(/[^0-9]/g, '');
    const total = Number(totalText) || 0;
    if (statusEl.value === 'Belum Lunas') {
        cashInput.value = '';
        cashInput.disabled = true;
        changeEl.innerText = formatRupiah(0);
        changeEl.style.color = '';
        return;
    }
    cashInput.disabled = false;
    const cash = Number(cashInput.value) || 0;
    const change = cash - total;
    changeEl.innerText = formatRupiah(change);
    changeEl.style.color = change < 0 ? 'var(--danger)' : '';
}

document.getElementById('paymentStatus').addEventListener('change', updateChange);
document.getElementById('cashGiven').addEventListener('input', updateChange);

function renderCustomerDatalist() {
    const list = document.getElementById('customerList');
    if (!list) return;
    list.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
}

document.getElementById('customerName').addEventListener('input', (e) => {
    const match = customers.find(c => c.name === e.target.value);
    if (match) document.getElementById('customerWA').value = String(match.wa || '').replace(/^'/, '');
});

// --- MODUL KASIR: CHECKOUT / TRANSAKSI ---
function buildItemsSummary(cartArr) {
    return cartArr.map(it => it.category === 'Kiloan' ? `${it.name} ${it.weight}kg` : `${it.name} x${it.qty}`).join(', ');
}

function generateInvoiceNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayCount = transactions.filter(t => {
        const td = new Date(t.date);
        return !isNaN(td) && td.getFullYear() === now.getFullYear() && td.getMonth() === now.getMonth() && td.getDate() === now.getDate();
    }).length + 1;
    return `INV${y}${m}${d}${String(todayCount).padStart(3, '0')}`;
}

checkoutBtn.addEventListener('click', async () => {
    if (cart.length === 0) { alert('Keranjang masih kosong!'); return; }
    const customerName = document.getElementById('customerName').value.trim();
    const customerWA = document.getElementById('customerWA').value.trim();
    if (!customerName) { alert('Nama pelanggan wajib diisi!'); return; }
    const status = document.getElementById('paymentStatus').value;
    const total = calculateTotal();
    const cash = status === 'Lunas' ? (Number(document.getElementById('cashGiven').value) || 0) : 0;
    if (status === 'Lunas' && cash < total) { alert('Uang tunai kurang dari total tagihan!'); return; }
    const change = status === 'Lunas' ? cash - total : 0;
    const invoice = generateInvoiceNumber();
    const itemsSummary = buildItemsSummary(cart);

    checkoutBtn.disabled = true;
    checkoutBtn.innerText = 'Memproses...';
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'transaction', invoice, items: itemsSummary, total, cash, change, customerName, customerWA, paymentStatus: status })
        });
        const result = await res.json();
        if (result.status === 'success') {
            const trx = { invoice, items: itemsSummary, total, name: customerName, wa: customerWA, status };
            alert(`Transaksi ${invoice} berhasil disimpan!`);
            if (customerWA && confirm('Kirim struk ke WhatsApp pelanggan sekarang?')) sendReceiptWA(trx);
            cart = [];
            document.getElementById('customerName').value = '';
            document.getElementById('customerWA').value = '';
            document.getElementById('cashGiven').value = '';
            document.getElementById('paymentStatus').value = 'Lunas';
            renderCart();
            loadCatalogFromCloud();
            window.switchView('dashboardView');
        } else {
            alert('Gagal menyimpan transaksi: ' + (result.message || 'Terjadi kesalahan'));
        }
    } catch (err) {
        alert('Gagal terhubung ke server. Cek koneksi internet Anda.');
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.innerText = 'Selesaikan Transaksi';
    }
});

// --- MODUL PRINTER THERMAL BLUETOOTH ---
window.printThermalReceipt = async function(invoice, name, itemsStr, total, cash, change, status) {
    try {
        const device = await navigator.bluetooth.requestDevice({ 
            acceptAllDevices: true, 
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb'] 
        });
        if (!device) return; 
        const server = await device.gatt.connect(); 
        const services = await server.getPrimaryServices();
        let tChar = null;
        for (const s of services) { 
            for (const c of await s.getCharacteristics()) { 
                if (c.properties.write || c.properties.writeWithoutResponse) { 
                    tChar = c; break; 
                } 
            } 
            if (tChar) break; 
        }
        if (!tChar) { alert("Gagal menemukan jalur printer."); return; }

        let enc = new TextEncoder(); 
        let cmds = [];
        cmds.push(
            new Uint8Array([0x1B, 0x40]), 
            enc.encode("\x1b\x61\x01"), 
            enc.encode("PURIFY LAUNDRY\n--------------------------------\n"), 
            enc.encode("\x1b\x61\x00"), 
            enc.encode(`No Nota  : ${invoice}\nTanggal  : ${new Date().toLocaleString('id-ID')}\nPelanggan: ${name || 'Umum'}\nStatus   : ${status}\n--------------------------------\n`), 
            enc.encode("RINCIAN PESANAN:\n")
        );
        
        itemsStr.split(', ').forEach(i => cmds.push(enc.encode(`- ${i}\n`)));
        
        cmds.push(
            enc.encode("--------------------------------\n"), 
            enc.encode(`TOTAL    : Rp ${Number(total).toLocaleString('id-ID')}\n`)
        );
        
        if (status === 'Lunas') {
            cmds.push(
                enc.encode(`Bayar    : Rp ${Number(cash).toLocaleString('id-ID')}\n`), 
                enc.encode(`Kembali  : Rp ${Number(change).toLocaleString('id-ID')}\n`)
            );
        }
        
        cmds.push(
            enc.encode("--------------------------------\n"), 
            enc.encode("\x1b\x61\x01"), 
            enc.encode("Terima Kasih Atas\nKepercayaan Anda!\n\n\n"), 
            new Uint8Array([0x1D, 0x56, 0x42, 0x00])
        ); 
        
        for (let cmd of cmds) await tChar.writeValue(cmd);
        alert("Nota berhasil dicetak!"); 
        server.disconnect();
    } catch (e) { 
        alert("Pencetakan dibatalkan atau gagal terhubung ke printer."); 
        console.error(e);
    }
};

// --- MODUL RIWAYAT TRANSAKSI & KIRIM WA ---
function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    if (transactions.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Belum ada transaksi.</p>';
        return;
    }
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map(t => `
        <div class="history-card">
            <div class="hc-top">
                <span class="hc-inv">${t.invoice}</span>
                <span class="badge ${t.status === 'Lunas' ? 'lunas' : 'belum'}">${t.status}</span>
            </div>
            <div class="hc-date">${formatDateShort(t.date)}</div>
            <div class="hc-middle">${t.items}</div>
            <div class="hc-bottom">
                <span class="hc-cust">${t.name || '-'}</span>
                <span class="hc-total">${formatRupiah(t.total)}</span>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                <button class="btn-print" data-invoice="${t.invoice}" style="background:#0f766e; color:white; border:none; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; box-shadow: 0 4px 10px rgba(15, 118, 110, 0.3);">🖨️ Cetak Struk</button>
                ${t.wa ? `<button class="btn-wa" data-invoice="${t.invoice}">📲 Kirim Struk WA</button>` : ''}
            </div>
        </div>
    `).join('');
}

document.getElementById('historyList').addEventListener('click', (e) => {
    const inv = e.target.dataset.invoice;
    if (!inv) return;
    const trx = transactions.find(t => t.invoice === inv);
    if (!trx) return;

    if (e.target.classList.contains('btn-wa')) {
        sendReceiptWA(trx);
    } else if (e.target.classList.contains('btn-print')) {
        window.printThermalReceipt(trx.invoice, trx.name, trx.items, trx.total, trx.cash || 0, trx.change || 0, trx.status);
    }
});

document.getElementById('refreshHistoryBtn').addEventListener('click', () => loadCatalogFromCloud());

function sendReceiptWA(trx) {
    if (!trx.wa) { alert('Nomor WhatsApp pelanggan tidak tersedia.'); return; }
    const wa = formatWhatsApp(trx.wa);
    const pesan = `Halo ${trx.name || ''}, terima kasih sudah menggunakan Purify Laundry & Dry Cleaning!\n\n` +
        `No. Invoice: ${trx.invoice}\n` +
        `Rincian: ${trx.items}\n` +
        `Total: ${formatRupiah(trx.total)}\n` +
        `Status: ${trx.status}\n\n` +
        `Terima kasih! 🙏`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`, '_blank');
}

// --- MODUL KAS KELUAR ---
function renderCashOutList() {
    const container = document.getElementById('cashOutList');
    if (!container) return;
    if (cashOuts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Belum ada pengeluaran.</p>';
        return;
    }
    const sorted = [...cashOuts].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map(c => `
        <div class="history-card">
            <div class="hc-top"><span class="hc-inv">${c.description}</span><span class="hc-date">${formatDateShort(c.date)}</span></div>
            <div class="hc-bottom"><span class="hc-cust">${c.user || ''}</span><span class="hc-total" style="color:var(--danger)">- ${formatRupiah(c.amount)}</span></div>
        </div>
    `).join('');
}

document.getElementById('openCashOutModal').addEventListener('click', () => {
    document.getElementById('coDescription').value = '';
    document.getElementById('coAmount').value = '';
    document.getElementById('cashOutModal').style.display = 'flex';
});

document.getElementById('cancelCoBtn').addEventListener('click', () => {
    document.getElementById('cashOutModal').style.display = 'none';
});

document.getElementById('saveCoBtn').addEventListener('click', async () => {
    const desc = document.getElementById('coDescription').value.trim();
    const amount = Number(document.getElementById('coAmount').value);
    if (!desc || !amount || amount <= 0) { alert('Lengkapi keterangan & jumlah dengan benar!'); return; }
    const btn = document.getElementById('saveCoBtn');
    btn.disabled = true; btn.innerText = 'Menyimpan...';
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cash_out', date: new Date().toISOString(), description: desc, amount, user: currentUser.username }) });
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('cashOutModal').style.display = 'none';
            loadCatalogFromCloud();
        } else alert('Gagal menyimpan pengeluaran.');
    } catch (e) {
        alert('Gagal terhubung ke server.');
    } finally {
        btn.disabled = false; btn.innerText = 'Simpan';
    }
});

// --- MODUL TAMBAH/HAPUS LAYANAN ---
window.openAddProductModal = function() {
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    document.getElementById('newProductCategory').value = 'Kiloan';
    document.getElementById('addProductModal').style.display = 'flex';
};

document.getElementById('cancelAddBtn').addEventListener('click', () => {
    document.getElementById('addProductModal').style.display = 'none';
});

document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const name = document.getElementById('newProductName').value.trim();
    const price = Number(document.getElementById('newProductPrice').value);
    const category = document.getElementById('newProductCategory').value;
    if (!name || !price || price <= 0) { alert('Lengkapi nama & harga dengan benar!'); return; }
    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true; btn.innerText = 'Menyimpan...';
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'add_product', product: { id: 'P' + Date.now(), name, price, category } }) });
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('addProductModal').style.display = 'none';
            loadCatalogFromCloud();
        } else alert('Gagal menyimpan layanan.');
    } catch (e) {
        alert('Gagal terhubung ke server.');
    } finally {
        btn.disabled = false; btn.innerText = 'Simpan';
    }
});

window.deleteProduct = function(productId) {
    if (!confirm('Hapus layanan ini?')) return;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_product', productId }) })
    .then(res => res.json()).then(result => {
        if (result.status === 'success') loadCatalogFromCloud();
        else alert('Gagal menghapus layanan.');
    }).catch(() => alert('Gagal terhubung ke server.'));
};

// --- MODUL KEUANGAN (SALDO & LAPORAN DETAIL) ---
function renderFinance() {
    const totalLunas = transactions.filter(t => t.status === 'Lunas').reduce((s, t) => s + Number(t.total || 0), 0);
    const totalPiutang = transactions.filter(t => t.status !== 'Lunas').reduce((s, t) => s + Number(t.total || 0), 0);
    const totalKasKeluar = cashOuts.reduce((s, c) => s + Number(c.amount || 0), 0);
    const saldoAktual = saldoAwal + totalLunas - totalKasKeluar;
    const saldoProyeksi = saldoAktual + totalPiutang;
    
    // Update Dashboard Card
    const elAktual = document.getElementById('saldoAktualTxt');
    const elProyeksi = document.getElementById('saldoProyeksiTxt');
    if (elAktual) elAktual.innerText = formatRupiah(saldoAktual);
    if (elProyeksi) elProyeksi.innerText = formatRupiah(saldoProyeksi);
}

window.setSaldoAwal = function() {
    const input = prompt('Masukkan saldo awal kas (Rp):', saldoAwal || 0);
    if (input === null) return;
    const amount = Number(String(input).replace(/[^0-9-]/g, ''));
    if (isNaN(amount)) { alert('Input tidak valid.'); return; }
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'set_saldo_awal', amount }) })
    .then(res => res.json()).then(result => {
        if (result.status === 'success') { saldoAwal = amount; renderFinance(); alert('Saldo awal diperbarui.'); }
        else alert('Gagal menyimpan saldo awal.');
    }).catch(() => alert('Gagal terhubung ke server.'));
};

// Fitur Baru: Render Laporan Detail Keuangan
function renderFinanceDetail() {
    const totalLunas = transactions.filter(t => t.status === 'Lunas').reduce((s, t) => s + Number(t.total || 0), 0);
    const totalPiutang = transactions.filter(t => t.status !== 'Lunas').reduce((s, t) => s + Number(t.total || 0), 0);
    const totalKasKeluar = cashOuts.reduce((s, c) => s + Number(c.amount || 0), 0);
    const saldoAktual = saldoAwal + totalLunas - totalKasKeluar;
    const saldoProyeksi = saldoAktual + totalPiutang;

    // Update Ringkasan Angka
    document.getElementById('detailSaldoAwal').innerText = formatRupiah(saldoAwal);
    document.getElementById('detailPemasukan').innerText = '+ ' + formatRupiah(totalLunas);
    document.getElementById('detailPengeluaran').innerText = '- ' + formatRupiah(totalKasKeluar);
    document.getElementById('detailSaldoAktual').innerText = formatRupiah(saldoAktual);
    document.getElementById('detailPiutang').innerText = formatRupiah(totalPiutang);
    document.getElementById('detailSaldoProyeksi').innerText = formatRupiah(saldoProyeksi);

    // Proses Arus Kas (Uang Masuk & Keluar)
    let cashFlow = [];
    
    // Uang Masuk dari Transaksi Lunas
    transactions.filter(t => t.status === 'Lunas').forEach(t => {
        cashFlow.push({
            date: t.date,
            desc: `Pembayaran ${t.invoice} - ${t.name || 'Umum'}`,
            type: 'in',
            amount: t.total
        });
    });
    
    // Uang Keluar
    cashOuts.forEach(c => {
        cashFlow.push({
            date: c.date,
            desc: `Kas Keluar: ${c.description}`,
            type: 'out',
            amount: c.amount
        });
    });

    // Urutkan berdasarkan waktu paling baru
    cashFlow.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Render ke List
    const container = document.getElementById('cashFlowList');
    if (cashFlow.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px; padding:15px;">Belum ada arus kas uang masuk/keluar.</p>';
    } else {
        container.innerHTML = cashFlow.map(f => `
            <div style="background: white; padding: 12px 15px; border-radius: 12px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${f.desc}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${formatDateShort(f.date)}</span>
                </div>
                <span style="font-size: 14px; font-weight: 700; color: ${f.type === 'in' ? 'var(--primary)' : 'var(--danger)'};">
                    ${f.type === 'in' ? '+' : '-'} ${formatRupiah(f.amount)}
                </span>
            </div>
        `).join('');
    }
}

// --- FITUR LIHAT PASSWORD (MATA) ---
const togglePasswordBtn = document.getElementById('togglePassword');
const pinInput = document.getElementById('loginPin');

if (togglePasswordBtn && pinInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = pinInput.getAttribute('type') === 'password';
        pinInput.setAttribute('type', isPassword ? 'text' : 'password');
        togglePasswordBtn.innerText = isPassword ? '🙈' : '👁️';
    });
}
// --- MODUL PRESENSI KARYAWAN ---
function initAttendancePage() {
    if (currentUser) {
        document.getElementById('attendanceUserGreeting').innerText = `Halo, ${currentUser.username} 👋`;
    }
    renderAttendanceList();
}

// Jam Berjalan Real-time
setInterval(() => {
    const clockEl = document.getElementById('liveClock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    }
}, 1000);

document.getElementById('clockInBtn').addEventListener('click', () => submitAttendance('Masuk'));
document.getElementById('clockOutBtn').addEventListener('click', () => submitAttendance('Pulang'));

async function submitAttendance(type) {
    if (!currentUser) return;
    if (!confirm(`Catat presensi "${type}" sekarang?`)) return;

    const btnIn = document.getElementById('clockInBtn');
    const btnOut = document.getElementById('clockOutBtn');
    if(btnIn) btnIn.disabled = true;
    if(btnOut) btnOut.disabled = true;

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'attendance',
                username: currentUser.username,
                role: currentUser.role,
                type: type
            })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert(`Berhasil mencatat presensi: ${type}`);
            loadCatalogFromCloud();
        } else {
            alert('Gagal mencatat presensi.');
        }
    } catch (e) {
        alert('Gagal terhubung ke server.');
    } finally {
        if(btnIn) btnIn.disabled = false;
        if(btnOut) btnOut.disabled = false;
    }
}

// Fungsi pembantu untuk membersihkan format tanggal/waktu yang berantakan dari spreadsheet
function cleanDateTime(val, isTime = false) {
    if (!val) return '-';
    let str = String(val);
    
    // Jika mengandung format ISO atau 1899 dari spreadsheet
    if (str.includes('T') || str.includes('1899')) {
        let d = new Date(str);
        if (!isNaN(d)) {
            if (isTime) {
                return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            } else {
                return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        }
    }
    return str;
}

function renderAttendanceList() {
    const container = document.getElementById('attendanceList');
    if (!container) return;
    if (!attendances || attendances.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:15px;">Belum ada riwayat presensi.</p>';
        return;
    }
    const sorted = [...attendances].reverse(); // Menampilkan yang terbaru di atas
    container.innerHTML = sorted.map(a => `
        <div class="history-card" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-weight:700; font-size:13px;">👤 ${a.username} (${a.role || 'Staff'})</span><br>
                <span style="font-size:11px; color:var(--text-muted);">📅 ${cleanDateTime(a.tanggal, false)} | ⏰ ${cleanDateTime(a.waktu, true)}</span>
            </div>
            <span class="badge ${a.type === 'Masuk' ? 'lunas' : 'belum'}" style="padding: 4px 10px; font-size: 11px;">
                ${a.type}
            </span>
        </div>
    `).join('');
}
// --- INISIALISASI ---
checkSession();