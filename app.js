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
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-page').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        $(targetId).classList.remove('hidden');
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
            if (currentAmount === "0") currentAmount = val;
            else currentAmount += val;
        }
        updateDisplay();
    });
});

// 4. Kategori Dinamis & Smart Sorting
const getDefaultCats = () => ['Makan', 'Bensin', 'Rokok', 'Parkir', 'Kopi'];
const getSavedCats = () => JSON.parse(localStorage.getItem('customCats')) || getDefaultCats();

const renderCategories = () => {
    const cats = getSavedCats();
    const container = $('category-container');
    container.innerHTML = '';
    
    // Smart Sorting: Sort by Hour of Day priority (Simulasi Rule Based)
    const hour = new Date().getHours();
    let sortedCats = [...cats];
    if (hour >= 6 && hour <= 10) {
        // Pagi: Kopi & Bensin prioritas
        sortedCats = sortedCats.sort((a,b) => (b==='Kopi'||b==='Bensin') ? 1 : -1);
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

// 5. Logic Click, Long Press & Chips
const handleLongPress = (cat) => {
    saveTx(cat, cat);
};

const handleCatClick = (cat) => {
    activeCategory = cat;
    const store = db.transaction('transactions').objectStore('transactions');
    store.getAll().onsuccess = (e) => {
        const data = e.target.result.reverse();
        const recentItems = [];
        for(let d of data) {
            if(d.category === cat && d.itemName !== cat && !recentItems.includes(d.itemName)) {
                recentItems.push(d.itemName);
                if(recentItems.length >= 3) break;
            }
        }
        
        $('auto-suggest-chips').classList.remove('hidden');
        const list = $('chips-list');
        list.innerHTML = `<div class="chip" style="background:var(--green)" onclick="saveTx('${cat}', '${cat}')">&check; Simpan sbg ${cat}</div>`;
        recentItems.forEach(item => {
            list.innerHTML += `<div class="chip" onclick="saveTx('${cat}', '${item}')">${item}</div>`;
        });
    };
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
        $('auto-suggest-chips').classList.add('hidden');
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
                    <div class="history-item glass" data-id="${item.id}">
                        <span>&#8618; ${item.itemName} <small style="color:#aaa">(${time})</small></span>
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
        $('insight-saldo').innerText = `Rp ${saldo.toLocaleString('id-ID')}`;
        $('insight-today').innerText = `Rp ${todayExpense.toLocaleString('id-ID')}`;
        $('insight-expense').innerText = `Rp ${monthlyData[currentMonth].toLocaleString('id-ID')}`; 
        
        if(saldo < 150000) $('burn-rate-warning').innerText = `⚠️ Saldo menipis! Sisa jatah: Rp ${(saldo/7).toFixed(0).replace('.',',')} / hari.`;
        else $('burn-rate-warning').innerText = "";

        $('highest-item').innerText = highestItem ? `${highestItem} (Rp ${highestAmount.toLocaleString('id-ID')})` : 'Belum ada data';

        // Render Tabel Mingguan + Tombol Detail
        let weekHtml = '';
        for (let i = 1; i <= 5; i++) {
            if(weeklyData[i]) {
                weekHtml += `
                <div class="table-row" style="align-items:center;">
                    <span>Minggu ke-${i}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <strong>Rp ${weeklyData[i].toLocaleString('id-ID')}</strong>
                        <button class="del-btn" style="background:#333; font-size:12px; padding:4px 8px; border-radius:6px; color:white; border:none; cursor:pointer;" onclick="document.querySelector('[data-target=\'tab-history\']').click()">Detail</button>
                    </div>
                </div>`;
            }
        }
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

// 9. Voice Input
$('btn-mic').addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return alert("Browser tidak mendukung Web Speech API");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.start();
    
    $('btn-mic').innerText = "Mendengarkan...";
    $('btn-mic').style.color = "var(--red)";
    
    recognition.onend = () => {
        $('btn-mic').innerHTML = "&phone; Voice Input";
        $('btn-mic').style.color = "var(--green)";
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        const numMatch = transcript.match(/\d+/g);
        if(numMatch) {
            currentAmount = numMatch.join('');
            updateDisplay();
            // Ekstrak teks non-angka sebagai nama barang
            let itemName = transcript.replace(/[0-9]/g, '').trim();
            if(itemName.length > 2) {
                saveTx('Lainnya', itemName);
                alert(`Tersimpan: ${itemName} - Rp ${currentAmount}`);
            }
        }
    };
});

// 10. Service Worker & Backup
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
