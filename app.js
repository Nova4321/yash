/* ============================================
   RUPEE TRACKER — Application Logic
   ============================================ */

(function () {
    'use strict';

    const STORAGE_KEY_SALES = 'rupeeTracker_entries';
    const STORAGE_KEY_EXPENSES = 'rupeeTracker_expenses';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        headerDate:         $('#header-date'),
        // Sales form
        form:               $('#entry-form'),
        itemName:           $('#item-name'),
        itemQty:            $('#item-qty'),
        itemAmount:         $('#item-amount'),
        toggleOnline:       $('#toggle-online'),
        toggleOffline:      $('#toggle-offline'),
        // Expense form
        expenseForm:        $('#expense-form'),
        expName:            $('#exp-name'),
        expQty:             $('#exp-qty'),
        expAmount:          $('#exp-amount'),
        expToggleOnline:    $('#exp-toggle-online'),
        expToggleOffline:   $('#exp-toggle-offline'),
        // Sales summary
        totalAmount:        $('#total-amount'),
        onlineAmount:       $('#online-amount'),
        offlineAmount:      $('#offline-amount'),
        // Expense summary
        expenseTotalAmount:   $('#expense-total-amount'),
        expenseOnlineAmount:  $('#expense-online-amount'),
        expenseOfflineAmount: $('#expense-offline-amount'),
        // Profit
        profitBanner:       $('#profit-banner'),
        profitAmount:       $('#profit-amount'),
        // Filters
        filterDate:         $('#filter-date'),
        filterAll:          $('#filter-all'),
        filterSales:        $('#filter-sales'),
        filterExpenses:     $('#filter-expenses'),
        filterOnline:       $('#filter-online'),
        filterOffline:      $('#filter-offline'),
        // List
        transactionsList:   $('#transactions-list'),
        emptyState:         $('#empty-state'),
        toast:              $('#toast'),
        // Modal
        btnClearAll:        $('#btn-clear-all'),
        modalOverlay:       $('#modal-overlay'),
        modalCancel:        $('#modal-cancel'),
        modalConfirm:       $('#modal-confirm'),
    };

    // ─── State ───────────────────────────────
    let sales = [];
    let expenses = [];
    let salePaymentMode = 'online';
    let expPaymentMode = 'online';
    let activeFilter = 'all';

    // ─── Helpers ─────────────────────────────
    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }
    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    function formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Storage ─────────────────────────────
    function loadData() {
        try { sales = JSON.parse(localStorage.getItem(STORAGE_KEY_SALES) || '[]'); } catch { sales = []; }
        try { expenses = JSON.parse(localStorage.getItem(STORAGE_KEY_EXPENSES) || '[]'); } catch { expenses = []; }
    }
    function saveData() {
        localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
        localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    }

    // ─── Toast ───────────────────────────────
    let toastTimer = null;
    function showToast(msg, type = 'success') {
        clearTimeout(toastTimer);
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show ' + type;
        toastTimer = setTimeout(() => { dom.toast.className = 'toast'; }, 2600);
    }

    // ─── Modal ───────────────────────────────
    function openModal() { dom.modalOverlay.classList.add('show'); }
    function closeModal() { dom.modalOverlay.classList.remove('show'); }

    // ─── Animate value change ─────────────────
    function animateValue(el, newVal) {
        if (el.textContent !== newVal) {
            el.style.transition = 'none';
            el.style.transform = 'scale(0.8)';
            el.style.opacity = '0.5';
            el.textContent = newVal;
            requestAnimationFrame(() => {
                el.style.transition = 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
                el.style.transform = 'scale(1)';
                el.style.opacity = '1';
            });
        }
    }

    // ─── Update Summaries ────────────────────
    function updateSummary() {
        const selectedDate = dom.filterDate.value || todayStr();
        const daySales = sales.filter(e => e.date === selectedDate);
        const dayExpenses = expenses.filter(e => e.date === selectedDate);

        let saleOnline = 0, saleOffline = 0;
        daySales.forEach(e => { if (e.mode === 'online') saleOnline += e.amount; else saleOffline += e.amount; });

        let expOnline = 0, expOffline = 0;
        dayExpenses.forEach(e => { if (e.mode === 'online') expOnline += e.amount; else expOffline += e.amount; });

        const totalSales = saleOnline + saleOffline;
        const totalExp = expOnline + expOffline;
        const profit = totalSales - totalExp;

        // Sales cards
        animateValue(dom.totalAmount, formatCurrency(totalSales));
        animateValue(dom.onlineAmount, formatCurrency(saleOnline));
        animateValue(dom.offlineAmount, formatCurrency(saleOffline));

        // Expense cards
        animateValue(dom.expenseTotalAmount, formatCurrency(totalExp));
        animateValue(dom.expenseOnlineAmount, formatCurrency(expOnline));
        animateValue(dom.expenseOfflineAmount, formatCurrency(expOffline));

        // Profit banner
        const profitStr = (profit >= 0 ? '' : '−') + formatCurrency(Math.abs(profit));
        animateValue(dom.profitAmount, profitStr);
        dom.profitBanner.className = 'profit-banner ' + (profit >= 0 ? 'positive' : 'negative');
    }

    // ─── Render Transactions ─────────────────
    function renderTransactions() {
        const selectedDate = dom.filterDate.value || todayStr();

        // Merge all with a type tag
        let all = [
            ...sales.filter(e => e.date === selectedDate).map(e => ({ ...e, type: 'sale' })),
            ...expenses.filter(e => e.date === selectedDate).map(e => ({ ...e, type: 'expense' })),
        ];

        // Filter
        if (activeFilter === 'sales')    all = all.filter(e => e.type === 'sale');
        if (activeFilter === 'expenses') all = all.filter(e => e.type === 'expense');
        if (activeFilter === 'online')   all = all.filter(e => e.mode === 'online');
        if (activeFilter === 'offline')  all = all.filter(e => e.mode === 'offline');

        // Sort newest first
        all.sort((a, b) => b.timestamp - a.timestamp);

        if (all.length === 0) {
            dom.transactionsList.innerHTML = '';
            dom.emptyState.classList.remove('hidden');
            return;
        }
        dom.emptyState.classList.add('hidden');

        dom.transactionsList.innerHTML = all.map((e, i) => {
            const modeLabel = e.mode === 'online' ? 'Online' : 'Cash';
            const typeLabel = e.type === 'sale' ? 'Sale' : 'Expense';
            const typeBadgeClass = e.type === 'sale' ? 'tx-type-sale' : 'tx-type-expense';
            return `
            <div class="tx-item ${e.type} ${e.mode}" data-id="${e.id}" data-type="${e.type}" style="animation-delay:${i*0.04}s">
                <div class="tx-mode-indicator"></div>
                <div class="tx-details">
                    <div class="tx-name">${escapeHtml(e.name)}${e.qty > 1 ? ' ×' + e.qty : ''}</div>
                    <div class="tx-meta">
                        <span class="tx-type-badge ${typeBadgeClass}">${typeLabel}</span>
                        <span class="tx-badge">${modeLabel}</span>
                        <span>${formatTime(e.timestamp)}</span>
                    </div>
                </div>
                <span class="tx-amount">${formatCurrency(e.amount)}</span>
                <button class="tx-delete" title="Delete" data-id="${e.id}" data-type="${e.type}">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>`;
        }).join('');
    }

    // ─── Add Sale ────────────────────────────
    function addSale(e) {
        e.preventDefault();
        const name = dom.itemName.value.trim();
        const qty = parseInt(dom.itemQty.value) || 1;
        const amount = parseFloat(dom.itemAmount.value);
        if (!name) { showToast('Please enter an item name', 'error'); dom.itemName.focus(); return; }
        if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); dom.itemAmount.focus(); return; }

        sales.push({ id: generateId(), name, qty, amount, mode: salePaymentMode, date: todayStr(), timestamp: Date.now() });
        saveData();
        dom.itemName.value = ''; dom.itemQty.value = '1'; dom.itemAmount.value = '';
        dom.filterDate.value = todayStr();
        dom.itemName.focus();
        updateSummary(); renderTransactions();
        showToast(`${name} — ${formatCurrency(amount)} added ✓`, 'success');
    }

    // ─── Add Expense ─────────────────────────
    function addExpense(e) {
        e.preventDefault();
        const name = dom.expName.value.trim();
        const qty = parseInt(dom.expQty.value) || 1;
        const amount = parseFloat(dom.expAmount.value);
        if (!name) { showToast('Please enter an expense name', 'error'); dom.expName.focus(); return; }
        if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); dom.expAmount.focus(); return; }

        expenses.push({ id: generateId(), name, qty, amount, mode: expPaymentMode, date: todayStr(), timestamp: Date.now() });
        saveData();
        dom.expName.value = ''; dom.expQty.value = '1'; dom.expAmount.value = '';
        dom.filterDate.value = todayStr();
        dom.expName.focus();
        updateSummary(); renderTransactions();
        showToast(`Expense "${name}" — ${formatCurrency(amount)} added`, 'error');
    }

    // ─── Delete Entry ────────────────────────
    function deleteEntry(id, type) {
        if (type === 'sale')    sales    = sales.filter(e => e.id !== id);
        if (type === 'expense') expenses = expenses.filter(e => e.id !== id);
        saveData(); updateSummary(); renderTransactions();
        showToast('Entry deleted', 'error');
    }

    // ─── Clear All ───────────────────────────
    function clearAll() {
        sales = []; expenses = []; saveData(); closeModal();
        updateSummary(); renderTransactions();
        showToast('All data cleared', 'error');
    }

    // ─── Events ──────────────────────────────
    function setupEvents() {
        // Sales form
        dom.form.addEventListener('submit', addSale);
        dom.toggleOnline.addEventListener('click', () => {
            salePaymentMode = 'online';
            dom.toggleOnline.classList.add('active'); dom.toggleOffline.classList.remove('active');
        });
        dom.toggleOffline.addEventListener('click', () => {
            salePaymentMode = 'offline';
            dom.toggleOffline.classList.add('active'); dom.toggleOnline.classList.remove('active');
        });

        // Expense form
        dom.expenseForm.addEventListener('submit', addExpense);
        dom.expToggleOnline.addEventListener('click', () => {
            expPaymentMode = 'online';
            dom.expToggleOnline.classList.add('active'); dom.expToggleOffline.classList.remove('active');
        });
        dom.expToggleOffline.addEventListener('click', () => {
            expPaymentMode = 'offline';
            dom.expToggleOffline.classList.add('active'); dom.expToggleOnline.classList.remove('active');
        });

        // Filter pills
        [dom.filterAll, dom.filterSales, dom.filterExpenses, dom.filterOnline, dom.filterOffline].forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                renderTransactions();
            });
        });

        // Date filter
        dom.filterDate.addEventListener('change', () => { updateSummary(); renderTransactions(); });

        // Delete (event delegation)
        dom.transactionsList.addEventListener('click', e => {
            const btn = e.target.closest('.tx-delete');
            if (btn) deleteEntry(btn.dataset.id, btn.dataset.type);
        });

        // Clear all modal
        dom.btnClearAll.addEventListener('click', openModal);
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalConfirm.addEventListener('click', clearAll);
        dom.modalOverlay.addEventListener('click', e => { if (e.target === dom.modalOverlay) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    }

    // ─── Init ────────────────────────────────
    function init() {
        dom.headerDate.textContent = formatDate(todayStr());
        dom.filterDate.value = todayStr();
        loadData();
        setupEvents();
        updateSummary();
        renderTransactions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
