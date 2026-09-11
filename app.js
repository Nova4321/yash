/* ============================================
   RUPEE TRACKER — Application Logic
   ============================================ */

(function () {
    'use strict';

    // ─── Constants ───────────────────────────
    const STORAGE_KEY = 'rupeeTracker_entries';

    // ─── DOM References ──────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        headerDate: $('#header-date'),
        form: $('#entry-form'),
        itemName: $('#item-name'),
        itemQty: $('#item-qty'),
        itemAmount: $('#item-amount'),
        toggleOnline: $('#toggle-online'),
        toggleOffline: $('#toggle-offline'),
        btnAddEntry: $('#btn-add-entry'),
        totalAmount: $('#total-amount'),
        onlineAmount: $('#online-amount'),
        offlineAmount: $('#offline-amount'),
        filterDate: $('#filter-date'),
        filterAll: $('#filter-all'),
        filterOnline: $('#filter-online'),
        filterOffline: $('#filter-offline'),
        transactionsList: $('#transactions-list'),
        emptyState: $('#empty-state'),
        toast: $('#toast'),
        btnClearAll: $('#btn-clear-all'),
        modalOverlay: $('#modal-overlay'),
        modalCancel: $('#modal-cancel'),
        modalConfirm: $('#modal-confirm'),
    };

    // ─── State ───────────────────────────────
    let entries = [];
    let paymentMode = 'online';
    let activeFilter = 'all';

    // ─── Helpers ─────────────────────────────
    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    function formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ─── Storage ─────────────────────────────
    function loadEntries() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            entries = raw ? JSON.parse(raw) : [];
        } catch {
            entries = [];
        }
    }

    function saveEntries() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    // ─── Toast ───────────────────────────────
    let toastTimer = null;
    function showToast(msg, type = 'success') {
        clearTimeout(toastTimer);
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show ' + type;
        toastTimer = setTimeout(() => {
            dom.toast.className = 'toast';
        }, 2500);
    }

    // ─── Modal ───────────────────────────────
    function openModal() {
        dom.modalOverlay.classList.add('show');
    }
    function closeModal() {
        dom.modalOverlay.classList.remove('show');
    }

    // ─── Summary Update ──────────────────────
    function updateSummary() {
        const selectedDate = dom.filterDate.value || todayStr();
        const dayEntries = entries.filter((e) => e.date === selectedDate);

        let onlineTotal = 0;
        let offlineTotal = 0;

        dayEntries.forEach((e) => {
            if (e.mode === 'online') onlineTotal += e.amount;
            else offlineTotal += e.amount;
        });

        animateValue(dom.totalAmount, formatCurrency(onlineTotal + offlineTotal));
        animateValue(dom.onlineAmount, formatCurrency(onlineTotal));
        animateValue(dom.offlineAmount, formatCurrency(offlineTotal));
    }

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

    // ─── Render Transactions ─────────────────
    function renderTransactions() {
        const selectedDate = dom.filterDate.value || todayStr();
        let filtered = entries.filter((e) => e.date === selectedDate);

        if (activeFilter !== 'all') {
            filtered = filtered.filter((e) => e.mode === activeFilter);
        }

        // Sort newest first
        filtered.sort((a, b) => b.timestamp - a.timestamp);

        if (filtered.length === 0) {
            dom.transactionsList.innerHTML = '';
            dom.emptyState.classList.remove('hidden');
            return;
        }

        dom.emptyState.classList.add('hidden');

        dom.transactionsList.innerHTML = filtered
            .map(
                (e, i) => `
            <div class="tx-item ${e.mode}" data-id="${e.id}" style="animation-delay: ${i * 0.04}s">
                <div class="tx-mode-indicator"></div>
                <div class="tx-details">
                    <div class="tx-name">${escapeHtml(e.name)}${e.qty > 1 ? ' ×' + e.qty : ''}</div>
                    <div class="tx-meta">
                        <span class="tx-badge">${e.mode === 'online' ? 'Online' : 'Cash'}</span>
                        <span>${formatTime(e.timestamp)}</span>
                    </div>
                </div>
                <span class="tx-amount">${formatCurrency(e.amount)}</span>
                <button class="tx-delete" title="Delete entry" data-id="${e.id}">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `
            )
            .join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

    // ─── Add Entry ───────────────────────────
    function addEntry(e) {
        e.preventDefault();

        const name = dom.itemName.value.trim();
        const qty = parseInt(dom.itemQty.value) || 1;
        const amount = parseFloat(dom.itemAmount.value);

        if (!name) {
            showToast('Please enter an item name', 'error');
            dom.itemName.focus();
            return;
        }
        if (!amount || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            dom.itemAmount.focus();
            return;
        }

        const entry = {
            id: generateId(),
            name,
            qty,
            amount,
            mode: paymentMode,
            date: todayStr(),
            timestamp: Date.now(),
        };

        entries.push(entry);
        saveEntries();

        // Reset form
        dom.itemName.value = '';
        dom.itemQty.value = '1';
        dom.itemAmount.value = '';
        dom.itemName.focus();

        // Ensure we're viewing today
        dom.filterDate.value = todayStr();

        updateSummary();
        renderTransactions();
        showToast(`${name} — ${formatCurrency(amount)} added ✓`, 'success');
    }

    // ─── Delete Entry ────────────────────────
    function deleteEntry(id) {
        entries = entries.filter((e) => e.id !== id);
        saveEntries();
        updateSummary();
        renderTransactions();
        showToast('Entry deleted', 'error');
    }

    // ─── Clear All ───────────────────────────
    function clearAll() {
        entries = [];
        saveEntries();
        closeModal();
        updateSummary();
        renderTransactions();
        showToast('All data cleared', 'error');
    }

    // ─── Event Listeners ─────────────────────
    function setupEvents() {
        // Form submit
        dom.form.addEventListener('submit', addEntry);

        // Payment toggle
        dom.toggleOnline.addEventListener('click', () => {
            paymentMode = 'online';
            dom.toggleOnline.classList.add('active');
            dom.toggleOffline.classList.remove('active');
        });
        dom.toggleOffline.addEventListener('click', () => {
            paymentMode = 'offline';
            dom.toggleOffline.classList.add('active');
            dom.toggleOnline.classList.remove('active');
        });

        // Filter pills
        [dom.filterAll, dom.filterOnline, dom.filterOffline].forEach((btn) => {
            btn.addEventListener('click', () => {
                $$('.pill').forEach((p) => p.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                renderTransactions();
            });
        });

        // Date filter
        dom.filterDate.addEventListener('change', () => {
            updateSummary();
            renderTransactions();
        });

        // Transaction delete (event delegation)
        dom.transactionsList.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.tx-delete');
            if (delBtn) {
                deleteEntry(delBtn.dataset.id);
            }
        });

        // Clear all
        dom.btnClearAll.addEventListener('click', openModal);
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalConfirm.addEventListener('click', clearAll);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ─── Initialize ──────────────────────────
    function init() {
        // Set header date
        dom.headerDate.textContent = formatDate(todayStr());

        // Set date filter to today
        dom.filterDate.value = todayStr();

        // Load data
        loadEntries();

        // Setup events
        setupEvents();

        // Initial render
        updateSummary();
        renderTransactions();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
