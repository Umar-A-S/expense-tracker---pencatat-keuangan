const $ = id => document.getElementById(id);
let db;
let currentAmount = "0";
let calcStr = ""; // Untuk fitur kalkulator
let txType = 'expense';
let activeCategory = null;

// Warna Palette untuk Pie Chart Top Kategori
const pieColors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];

// 1. Inisialisasi DB
const initDB = () => {
    const request = indexedDB.open('ExpenseTrackerPWA', 1);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('transactions')) {
            db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        renderCategories();
        loadHistory();
        updateInsights();
    };
};
initDB();

// 2. Tab Navigasi
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (!navBtn) return;

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-page').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });

        navBtn.classList.add('active');
        const targetId = navBtn.getAttribute('data-target');
        const targetTab = $(targetId);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            targetTab.classList.add('active');
        }

        if(targetId === 'tab-history') loadHistory();
        if(targetId === 'tab-insights') updateInsights();
    });
});

$('type-toggle').addEventListener('change', (e) => {
    txType = e.target.checked ? 'income' : 'expense';
    $('label-expense').classList.toggle('active-red', !e.target.checked);
    $('label-income').classList.toggle('active-green', e.target.checked);
});

// 3. Logic Numpad + Kalkulator
const updateDisplay = () => {
    try {
        let displayVal = currentAmount;
        if (currentAmount.includes('+')) {
            const parts = currentAmount.split('+');
            const total = parts.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            displayVal = total.toString();
            $('calc-preview').innerText = currentAmount.replace(/\+/g, ' + ');
        } else {
            $('calc-preview').innerText = "";
        }
        $('display-amount').innerText = parseInt(displayVal || "0").toLocaleString('id-ID');
    } catch(e) { console.error(e); }
};

document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = e.target.getAttribute('data-val');
        if (!val) return;
        
        if (val === 'C') { currentAmount = "0"; activeCategory = null; $('auto-suggest-chips').classList.add('hidden'); }
        else if (val === '+') {
            if(!currentAmount.endsWith('+')) currentAmount += '+';
        }
        else if (val.includes('+') && val.includes('k')) {
            let add = parseInt(val.replace('+','').replace('k','')) * 1000;
            if(currentAmount === "0") currentAmount = add.toString();
            else currentAmount += '+' + add;
        } else {
            if (currentAmount === "0") {
                if (val !== '00' && val !== '000') {
                    currentAmount = val;
                }
            } else {
                currentAmount += val;
            }
        }
        updateDisplay();
    });
});

// 4. Kategori Dinamis & Smart Sorting
const getDefaultCats = () => ['Makan', 'Bensin', 'Rokok', 'Parkir', 'Minuman'];
const getSavedCats = () => JSON.parse(localStorage.getItem('customCats')) || getDefaultCats();

const renderCategories = () => {
    const cats = getSavedCats();
    const container = $('category-container');
    container.innerHTML = '';
    
    // Smart Sorting: Sort by Hour of Day priority (Simulasi Rule Based)
    const hour = new Date().getHours();
    let sortedCats = [...cats];
    if (hour >= 6 && hour <= 10) {
        // Pagi: Minuman & Bensin prioritas
        sortedCats = sortedCats.sort((a,b) => (b==='Minuman'||b==='Bensin') ? 1 : -1);
    } else if (hour >= 18) {
        // Malam: Makan & Rokok prioritas
        sortedCats = sortedCats.sort((a,b) => (b==='Makan'||b==='Rokok') ? 1 : -1);
    }

    sortedCats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.innerText = cat;
        
        let pressTimer;
        const startPress = () => { pressTimer = setTimeout(() => handleLongPress(cat), 800); };
        const cancelPress = () => { clearTimeout(pressTimer); };
        
        btn.addEventListener('touchstart', startPress, {passive: true});
        btn.addEventListener('touchend', cancelPress);
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', cancelPress);
        btn.addEventListener('mouseleave', cancelPress);
        btn.addEventListener('click', () => { clearTimeout(pressTimer); handleCatClick(cat); });
        
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'cat-btn cat-add';
    addBtn.innerText = '+ Kategori';
    addBtn.onclick = () => $('modal-add-cat').classList.remove('hidden');
    container.appendChild(addBtn);
};

// Handle Custom Category
$('btn-cancel-cat').onclick = () => { $('modal-add-cat').classList.add('hidden'); $('new-cat-name').value = ''; };
$('btn-save-cat').onclick = () => {
    const newName = $('new-cat-name').value.trim();
    if(newName) {
        const cats = getSavedCats();
        if(!cats.includes(newName)) {
            cats.push(newName);
            localStorage.setItem('customCats', JSON.stringify(cats));
            renderCategories();
        }
    }
    $('modal-add-cat').classList.add('hidden');
    $('new-cat-name').value = '';
};

// 5. Logic Click, Long Press & Inline Detail Panel
const handleLongPress = (cat) => {
    saveTx(cat, cat);
};

const handleCatClick = (cat) => {
    activeCategory = cat;
    $('inline-cat-title').innerText = `Kategori: ${cat}`;
    const fieldsContainer = $('inline-fields-container');
    fieldsContainer.innerHTML = '';

    if (cat === 'Rokok') {
        fieldsContainer.innerHTML = `
            <div style="margin-bottom:10px;">
                <label style="font-size:0.8rem; color:#aaa; display:block; margin-bottom:3px;">Merek Rokok:</label>
                <input type="text" id="input-rokok-merek" placeholder="Contoh: Marlboro, Djarum..." class="glass-input" autocomplete="off" style="padding:10px; font-size:0.9rem;">
            </div>
            <div>
                <label style="font-size:0.8rem; color:#aaa; display:block; margin-bottom:3px;">Varian:</label>
                <input type="text" id="input-rokok-varian" placeholder="Contoh: Filter, Super, Kretek..." class="glass-input" autocomplete="off" style="padding:10px; font-size:0.9rem;">
            </div>
        `;
    } else if (cat === 'Minuman') {
        fieldsContainer.innerHTML = `
            <div>
                <label style="font-size:0.8rem; color:#aaa; display:block; margin-bottom:3px;">Jenis / Nama Minuman:</label>
                <input type="text" id="input-minuman-nama" placeholder="Contoh: Es Teh Manis, Kopi Susu..." class="glass-input" autocomplete="off" style="padding:10px; font-size:0.9rem;">
            </div>
        `;
    } else {
        fieldsContainer.innerHTML = `
            <div>
                <label style="font-size:0.8rem; color:#aaa; display:block; margin-bottom:3px;">Nama Barang:</label>
                <input type="text" id="input-custom-item" placeholder="Ketik nama barang..." class="glass-input" autocomplete="off" style="padding:10px; font-size:0.9rem;">
            </div>
        `;
    }

    const store = db.transaction('transactions').objectStore('transactions');
    store.getAll().onsuccess = (e) => {
        const data = e.target.result.reverse();
        const recentItems = [];
        for(let d of data) {
            if(d.category === cat && d.itemName && !recentItems.includes(d.itemName)) {
                recentItems.push(d.itemName);
                if(recentItems.length >= 5) break;
            }
        }

        const chipsList = $('inline-chips-list');
        chipsList.innerHTML = '';
        if(recentItems.length > 0) {
            $('inline-suggest-box').style.display = 'block';
            recentItems.forEach(item => {
                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.style.fontSize = '0.75rem';
                chip.style.padding = '4px 10px';
                chip.innerText = item;
                chip.addEventListener('click', () => {
                    if (cat === 'Rokok') {
                        const parts = item.split(' - ');
                        if($('input-rokok-merek')) $('input-rokok-merek').value = parts[0] || '';
                        if($('input-rokok-varian')) $('input-rokok-varian').value = parts[1] || '';
                    } else if (cat === 'Minuman') {
                        if($('input-minuman-nama')) $('input-minuman-nama').value = item;
                    } else {
                        if($('input-custom-item')) $('input-custom-item').value = item;
                    }
                });
                chipsList.appendChild(chip);
            });
        } else {
            $('inline-suggest-box').style.display = 'none';
        }

        $('category-detail-panel').classList.remove('hidden');
    };
};

$('btn-close-detail').onclick = () => {
    $('category-detail-panel').classList.add('hidden');
};

$('btn-inline-save').onclick = () => {
    let itemName = '';
    if (activeCategory === 'Rokok') {
        const merek = $('input-rokok-merek') ? $('input-rokok-merek').value.trim() : '';
        const varian = $('input-rokok-varian') ? $('input-rokok-varian').value.trim() : '';
        if (!merek) return alert('Masukkan merek rokok!');
        itemName = varian ? `${merek} - ${varian}` : merek;
    } else if (activeCategory === 'Minuman') {
        itemName = $('input-minuman-nama') ? $('input-minuman-nama').value.trim() : '';
        if (!itemName) return alert('Masukkan nama minuman!');
    } else {
        itemName = $('input-custom-item') ? $('input-custom-item').value.trim() : '';
        if (!itemName) itemName = activeCategory;
    }

    saveTx(activeCategory, itemName);
    $('category-detail-panel').classList.add('hidden');
};

// 6. Simpan Transaksi
const getFinalAmount = () => {
    try {
        if(currentAmount.includes('+')) {
            return currentAmount.split('+').reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        }
        return parseInt(currentAmount);
    } catch(e) { return 0; }
};

window.saveTx = (category, itemName) => {
    const amount = getFinalAmount();
    if (amount <= 0) return alert('Nominal harus > 0!');

    const tx = {
        amount: amount,
        category: category,
        itemName: itemName,
        type: txType,
        timestamp: new Date().toISOString()
    };

    const transaction = db.transaction(['transactions'], 'readwrite');
    transaction.objectStore('transactions').add(tx);
    transaction.oncomplete = () => {
        currentAmount = "0";
        activeCategory = null;
        updateDisplay();
        $('category-detail-panel').classList.add('hidden');
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
    };
};

// 7. Render History dengan Swipe to Delete
const loadHistory = () => {
    const store = db.transaction('transactions').objectStore('transactions');
    store.getAll().onsuccess = (e) => {
        const data = e.target.result.reverse();
        const grouped = data.reduce((acc, obj) => {
            const dateStr = new Date(obj.timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            if (!acc[dateStr]) acc[dateStr] = { items: [], total: 0 };
            acc[dateStr].items.push(obj);
            if(obj.type === 'expense') acc[dateStr].total -= obj.amount;
            else acc[dateStr].total += obj.amount;
            return acc;
        }, {});

        let html = '';
        for (const [date, group] of Object.entries(grouped)) {
            html += `<div class="history-group">
                <div class="group-header">[${date} | Total: Rp ${group.total.toLocaleString('id-ID')}]</div>`;
            group.items.forEach(item => {
                const color = item.type === 'expense' ? 'var(--red)' : 'var(--green)';
                const time = new Date(item.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
                html += `
                <div class="history-item-wrapper" data-id="${item.id}">
                    <div class="history-delete-bg">Hapus</div>
                    <div class="history-item glass" data-id="${item.id}" onclick="openEditModal(${item.id})" style="cursor:pointer;" title="Tap untuk edit">
                        <span>&#8618; ${item.itemName} <small style="color:#aaa">(${item.category} | ${time})</small></span>
                        <strong style="color:${color}">Rp ${item.amount.toLocaleString('id-ID')}</strong>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
        $('history-list').innerHTML = html;
        initSwipeToDelete();
    };
};

const initSwipeToDelete = () => {
    const items = document.querySelectorAll('.history-item');
    items.forEach(item => {
        let startX = 0, currentX = 0;
        item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive: true});
        item.addEventListener('touchmove', e => {
            currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            if (diff > 20 && diff < 100) {
                item.style.transform = `translateX(-${diff}px)`;
            }
        }, {passive: true});
        item.addEventListener('touchend', e => {
            const diff = startX - currentX;
            if (diff > 60) {
                item.style.transform = `translateX(-100%)`;
                setTimeout(() => { deleteTx(parseInt(item.getAttribute('data-id'))); }, 200);
            } else {
                item.style.transform = `translateX(0)`;
            }
        });
    });
};

const deleteTx = (id) => {
    const tx = db.transaction(['transactions'], 'readwrite');
    tx.objectStore('transactions').delete(id);
    tx.oncomplete = () => { loadHistory(); updateInsights(); };
};

// Edit & Delete Modal Logic
window.openEditModal = (id) => {
    const store = db.transaction('transactions').objectStore('transactions');
    store.get(id).onsuccess = (e) => {
        const tx = e.target.result;
        if (!tx) return;
        $('edit-tx-id').value = tx.id;
        $('edit-tx-amount').value = tx.amount;
        $('edit-tx-category').value = tx.category;
        $('edit-tx-item').value = tx.itemName;
        $('modal-edit-tx').classList.remove('hidden');
    };
};

$('btn-cancel-edit').onclick = () => {
    $('modal-edit-tx').classList.add('hidden');
};

$('btn-delete-tx-modal').onclick = () => {
    const id = parseInt($('edit-tx-id').value);
    if(confirm('Hapus transaksi ini?')) {
        deleteTx(id);
        $('modal-edit-tx').classList.add('hidden');
    }
};

$('btn-save-edit').onclick = () => {
    const id = parseInt($('edit-tx-id').value);
    const amount = parseFloat($('edit-tx-amount').value);
    const category = $('edit-tx-category').value.trim();
    const itemName = $('edit-tx-item').value.trim();

    if (isNaN(amount) || amount <= 0) return alert('Nominal tidak valid!');
    if (!category || !itemName) return alert('Kategori dan nama barang harus diisi!');

    const transaction = db.transaction(['transactions'], 'readwrite');
    const store = transaction.objectStore('transactions');
    store.get(id).onsuccess = (e) => {
        const tx = e.target.result;
        if(tx) {
            tx.amount = amount;
            tx.category = category;
            tx.itemName = itemName;
            store.put(tx);
        }
    };
    transaction.oncomplete = () => {
        $('modal-edit-tx').classList.add('hidden');
        loadHistory();
        updateInsights();
    };
};

// 8. Analitik Mendalam (Insights) - UPDATED 100% MATCH
$('year-filter').addEventListener('change', () => updateInsights());

const updateInsights = () => {
    const store = db.transaction('transactions').objectStore('transactions');
    store.getAll().onsuccess = (e) => {
        const data = e.target.result;
        let totalIncome = 0, totalExpense = 0, todayExpense = 0, rokokTotal = 0;
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const selectedYear = parseInt($('year-filter').value) || currentDate.getFullYear();
        const todayStr = currentDate.toDateString();
        
        const categoryCount = {};
        let highestItem = null;
        let highestAmount = 0;
        
        const monthlyData = new Array(12).fill(0);
        
        const getWeekNumber = (date) => {
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
        };

        const getWeekDateRangeStr = (year, month, weekNum) => {
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const startDay = (weekNum - 1) * 7 + 1;
            const endDay = Math.min(weekNum * 7, lastDayOfMonth);
            
            const startDate = new Date(year, month, startDay);
            const endDate = new Date(year, month, endDay);
            
            const startStr = startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
            const endStr = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            return `${startStr} - ${endStr}`;
        };

        const weeklyData = {};

        data.forEach(tx => {
            const txDate = new Date(tx.timestamp);
            
            if (tx.type === 'income') totalIncome += tx.amount;
            if (tx.type === 'expense') {
                totalExpense += tx.amount;
                
                // Hari ini
                if(txDate.toDateString() === todayStr) todayExpense += tx.amount;
                
                // Rekap Bulanan berdasarkan Tahun yang dipilih
                if(txDate.getFullYear() === selectedYear) {
                    monthlyData[txDate.getMonth()] += tx.amount;
                }
                
                // Data Bulan Ini (Untuk Mingguan, Pie Chart, Saran AI)
                if(txDate.getFullYear() === currentDate.getFullYear() && txDate.getMonth() === currentMonth) {
                    categoryCount[tx.category] = (categoryCount[tx.category] || 0) + tx.amount;
                    if(tx.category === 'Rokok') rokokTotal += tx.amount;
                    
                    if(tx.amount > highestAmount) {
                        highestAmount = tx.amount;
                        highestItem = tx.itemName;
                    }

                    const weekNum = getWeekNumber(txDate);
                    weeklyData[weekNum] = (weeklyData[weekNum] || 0) + tx.amount;
                }
            }
        });

        // Update Hero Card
        const saldo = totalIncome - totalExpense;
        const displaySaldo = Math.max(0, saldo);
        $('insight-saldo').innerText = `Rp ${displaySaldo.toLocaleString('id-ID')}`;
        $('insight-today').innerText = `Rp ${todayExpense.toLocaleString('id-ID')}`;
        $('insight-expense').innerText = `Rp ${monthlyData[currentMonth].toLocaleString('id-ID')}`; 
        
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate();
        const remainingDays = Math.max(1, lastDayOfMonth - currentDate.getDate() + 1);
        const dailyAllowance = Math.round(saldo / remainingDays);

        if (saldo <= 0) {
            $('burn-rate-warning').innerText = `[!] Saldo habis! Mohon hindari pengeluaran non-esensial hingga akhir bulan.`;
        } else if (saldo < 200000) {
            $('burn-rate-warning').innerText = `[!] Saldo menipis. Sisa jatah (${remainingDays} hari tersisa): Rp ${dailyAllowance.toLocaleString('id-ID')} / hari. Tips: Utamakan kebutuhan pokok.`;
        } else {
            $('burn-rate-warning').innerText = `[*] Sisa jatah harian (${remainingDays} hari tersisa): Rp ${dailyAllowance.toLocaleString('id-ID')} / hari. Keuangan stabil.`;
        }

        $('highest-item').innerText = highestItem ? `${highestItem} (Rp ${highestAmount.toLocaleString('id-ID')})` : 'Belum ada data';

        // Render Tabel Mingguan + Tombol Detail
        let weekHtml = '';
        const sortedWeeks = Object.keys(weeklyData).map(Number).sort((a,b) => a - b);
        sortedWeeks.forEach(i => {
            const dateRangeStr = getWeekDateRangeStr(selectedYear, currentMonth, i);
            weekHtml += `
            <div class="table-row" style="align-items:center;">
                <span>Minggu ke-${i} <small style="display:block; color:#aaa; font-size:0.75rem;">(${dateRangeStr})</small></span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <strong style="color:var(--red);">Rp ${weeklyData[i].toLocaleString('id-ID')}</strong>
                    <button class="del-btn" style="background:#333; font-size:12px; padding:4px 8px; border-radius:6px; color:white; border:none; cursor:pointer;" onclick="document.querySelector('[data-target=\\'tab-history\\']').click()">Detail</button>
                </div>
            </div>`;
        });
        $('weekly-table').innerHTML = weekHtml || '<p style="color:#aaa; text-align:center;">Belum ada pengeluaran minggu ini.</p>';

        // Render Tabel Bulanan
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        let monthHtml = '';
        monthlyData.forEach((amt, idx) => {
            if(amt > 0) monthHtml += `<div class="table-row"><span>${monthNames[idx]}</span><strong>Rp ${amt.toLocaleString('id-ID')}</strong></div>`;
        });
        $('monthly-table').innerHTML = monthHtml || '<p style="color:#aaa; text-align:center;">Belum ada data tahun ini.</p>';

        // Render Pie Chart
        const sortedCats = Object.entries(categoryCount).sort((a,b) => b[1] - a[1]).slice(0,6);
        let pieGradient = [];
        let cumPerc = 0;
        const totalCatExpense = sortedCats.reduce((sum, item) => sum + item[1], 0) || 1;
        
        let legendHtml = '';
        sortedCats.forEach((c, i) => {
            const perc = (c[1] / totalCatExpense) * 100;
            const color = pieColors[i % pieColors.length];
            pieGradient.push(`${color} ${cumPerc}% ${cumPerc + perc}%`);
            cumPerc += perc;
            legendHtml += `<li style="color:${color}"><span>${c[0]}<br><small>Rp ${c[1].toLocaleString('id-ID')}</small></span></li>`;
        });
        
        $('pie-chart').style.background = pieGradient.length > 0 ? `conic-gradient(${pieGradient.join(', ')})` : '#333';
        $('top-categories-list').innerHTML = legendHtml;

        // Render Saran AI
        const totalMonthExpense = monthlyData[currentMonth] || 1; 
        if(totalExpense > 0 && (rokokTotal / totalMonthExpense) > 0.3) {
            $('ai-suggestion').innerHTML = "<b>Warning:</b> Porsi rokokmu > 30% dari pengeluaran bulan ini! Coba kurangi.";
            $('ai-suggestion').style.color = "var(--red)";
        } else {
            $('ai-suggestion').innerText = "Arus kas terlihat stabil. Pertahankan!";
            $('ai-suggestion').style.color = "var(--green)";
        }
    };
};

// 9. Service Worker & Backup
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.log('SW Gagal', err));
}

$('btn-export').addEventListener('click', () => {
    const store = db.transaction('transactions').objectStore('transactions');
    store.getAll().onsuccess = (e) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(e.target.result));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "backup-expense.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };
});
