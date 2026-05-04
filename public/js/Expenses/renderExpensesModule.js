window.renderExpensesModule = async function (tableWrap) {

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }

    function fmtAmt(val) {
        return 'Rs. ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    // =====================
    // MAIN LAYOUT
    // =====================
    tableWrap.innerHTML = `
        <div class="expenses-wrap">
            <div class="exp-tabs">
                <button class="exp-tab active" data-tab="add">Add Expense</button>
                <button class="exp-tab" data-tab="history">Expense History</button>
            </div>
            <div id="expTabContent"></div>
        </div>
    `;

    const tabContent = document.getElementById('expTabContent');

    tableWrap.querySelectorAll('.exp-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            tableWrap.querySelectorAll('.exp-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'add') renderAddTab();
            else renderHistoryTab();
        });
    });

    await renderAddTab();

    // =====================
    // ADD EXPENSE TAB
    // =====================
    async function renderAddTab() {
        tabContent.innerHTML = `<div class="loading-overlay">Loading...</div>`;

        const [resBranches, resCategories, resModes, resCars] = await Promise.all([
            window.api('/api/branches'),
            window.api('/api/expenses/categories'),
            window.api('/api/expenses/payment-modes'),
            window.api('/api/cars')
        ]);

        const branches   = resBranches?.success   ? resBranches.branches     : [];
        const categories = resCategories?.success  ? resCategories.categories  : [];
        const modes      = resModes?.success        ? resModes.modes            : [];
        const cars       = resCars?.success         ? resCars.cars              : [];

        tabContent.innerHTML = `
            <div class="exp-card">
                <div class="exp-card-header">
                    <div class="exp-card-icon">&#x1F4B0;</div>
                    <div>
                        <p class="exp-card-title">New Expense Entry</p>
                        <p class="exp-card-subtitle">Fill in the details below and submit</p>
                    </div>
                </div>

                <div class="exp-form-grid">

                    <div class="exp-field">
                        <label>Branch *</label>
                        <select id="expBranch">
                            <option value="">Select branch...</option>
                            ${branches.map(b => `<option value="${b.branch_name}">${b.branch_name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="exp-field">
                        <label>Debitor (Name) *</label>
                        <input type="text" id="expDebitor" placeholder="Who is paying this expense..." />
                    </div>

                    <div class="exp-field">
                        <label>Expense Category *</label>
                        <div class="exp-inline">
                            <select id="expCategory">
                                <option value="">Select category...</option>
                                ${categories.map(c => `<option value="${c.id}" data-car="${c.is_car_related}">${c.name}</option>`).join('')}
                            </select>
                            <button class="btn-exp-create" id="btnNewCategory">+ New</button>
                        </div>
                    </div>

                    <div class="exp-field" id="expCarField" style="display:none;">
                        <label>Car *</label>
                        <select id="expCar">
                            <option value="">Select car...</option>
                            ${cars.map(c => `<option value="${c.id}">${c.car_name}${c.branch ? ' (' + c.branch + ')' : ''}</option>`).join('')}
                        </select>
                    </div>

                    <div class="exp-field">
                        <label>Amount (Rs.) *</label>
                        <input type="number" id="expAmount" placeholder="0.00" min="0" step="0.01" />
                    </div>

                    <div class="exp-field">
                        <label>Payment Mode *</label>
                        <div class="exp-inline">
                            <select id="expPayMode">
                                <option value="">Select mode...</option>
                                ${modes.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                            </select>
                            <button class="btn-exp-create" id="btnNewMode">+ New</button>
                        </div>
                    </div>

                    <div class="exp-field">
                        <label>Expense Date *</label>
                        <input type="date" id="expDate" value="${new Date().toISOString().split('T')[0]}" />
                    </div>

                    <div class="exp-field exp-field-full">
                        <label>Note</label>
                        <textarea id="expNote" placeholder="Any additional notes..." rows="3"></textarea>
                    </div>

                </div>

                <div class="exp-form-footer">
                    <button id="btnSubmitExpense" class="btn-exp-submit">Submit Expense</button>
                    <div id="expFormMsg" class="exp-form-msg"></div>
                </div>
            </div>
        `;

        // Show/hide car field based on category
        document.getElementById('expCategory').addEventListener('change', function () {
            const opt = this.options[this.selectedIndex];
            const isCarRelated = opt?.dataset.car === '1';
            document.getElementById('expCarField').style.display = isCarRelated ? '' : 'none';
            if (!isCarRelated) document.getElementById('expCar').value = '';
        });

        // New Category
        document.getElementById('btnNewCategory').addEventListener('click', async () => {
            const name = prompt('New category name:');
            if (!name?.trim()) return;
            const carRelated = confirm('Is this category car-related? (OK = Yes, Cancel = No)');
            const res = await window.api('/api/expenses/categories', {
                method: 'POST',
                body: JSON.stringify({ name: name.trim(), is_car_related: carRelated ? 1 : 0 })
            });
            if (!res.success) return alert(res.error || 'Failed to create category');
            await renderAddTab();
        });

        // New Payment Mode
        document.getElementById('btnNewMode').addEventListener('click', async () => {
            const name = prompt('New payment mode name:');
            if (!name?.trim()) return;
            const res = await window.api('/api/expenses/payment-modes', {
                method: 'POST',
                body: JSON.stringify({ name: name.trim() })
            });
            if (!res.success) return alert(res.error || 'Failed to create mode');
            await renderAddTab();
        });

        // Submit
        document.getElementById('btnSubmitExpense').addEventListener('click', async () => {
            const branch          = document.getElementById('expBranch').value;
            const debitor         = document.getElementById('expDebitor').value.trim();
            const category_id     = document.getElementById('expCategory').value;
            const car_id          = document.getElementById('expCar').value || null;
            const amount          = document.getElementById('expAmount').value;
            const payment_mode_id = document.getElementById('expPayMode').value;
            const expense_date    = document.getElementById('expDate').value;
            const note            = document.getElementById('expNote').value.trim();
            const msg             = document.getElementById('expFormMsg');

            msg.className = 'exp-form-msg';
            msg.textContent = '';

            if (!branch)                         return showErr(msg, 'Please select a branch.');
            if (!debitor)                         return showErr(msg, 'Please enter debitor name.');
            if (!category_id)                     return showErr(msg, 'Please select a category.');
            if (!amount || Number(amount) <= 0)   return showErr(msg, 'Please enter a valid amount.');
            if (!payment_mode_id)                 return showErr(msg, 'Please select a payment mode.');
            if (!expense_date)                    return showErr(msg, 'Please select a date.');

            const catOpt = document.getElementById('expCategory').options[document.getElementById('expCategory').selectedIndex];
            if (catOpt?.dataset.car === '1' && !car_id) return showErr(msg, 'Please select a car for this category.');

            const btn = document.getElementById('btnSubmitExpense');
            btn.disabled = true;
            btn.textContent = 'Submitting...';

            const res = await window.api('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({ branch, debitor, category_id, car_id, amount, payment_mode_id, note, expense_date })
            });

            btn.disabled = false;
            btn.textContent = 'Submit Expense';

            if (!res.success) return showErr(msg, res.error || 'Failed to submit');

            msg.className = 'exp-form-msg success';
            msg.innerHTML = `Expense saved! Slip No: <strong>#${res.slip_no}</strong>`;

            // Reset
            ['expBranch','expDebitor','expCategory','expCar','expAmount','expPayMode','expNote'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('expCarField').style.display = 'none';
            document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
        });
    }

    function showErr(el, msg) {
        el.className = 'exp-form-msg error';
        el.textContent = msg;
    }

    // =====================
    // HISTORY TAB
    // =====================
    async function renderHistoryTab() {
        tabContent.innerHTML = `<div class="loading-overlay">Loading...</div>`;

        const [resExpenses, resCategories, resBranches] = await Promise.all([
            window.api('/api/expenses'),
            window.api('/api/expenses/categories'),
            window.api('/api/branches')
        ]);

        const expenses   = resExpenses?.success   ? resExpenses.expenses      : [];
        const categories = resCategories?.success  ? resCategories.categories  : [];
        const branches   = resBranches?.success    ? resBranches.branches      : [];

        const totalAmt   = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        tabContent.innerHTML = `
            <div class="exp-history-wrap">

                <!-- Summary strip -->
                <div class="exp-summary-strip">
                    <div class="exp-summary-card">
                        <div class="label">Total Entries</div>
                        <div class="value blue">${expenses.length}</div>
                    </div>
                    <div class="exp-summary-card">
                        <div class="label">Total Amount</div>
                        <div class="value green">${fmtAmt(totalAmt)}</div>
                    </div>
                </div>

                        <!-- Table Section -->
                <div class="exp-table-section">
                    <div class="exp-table-header">
                        <h4>Expense Records</h4>
                        <div class="exp-table-filters">
                            <select id="filterBranchTable">
                                <option value="">All Branches</option>
                                ${branches.map(b => `<option value="${b.branch_name}">${b.branch_name}</option>`).join('')}
                            </select>
                            <select id="filterCategoryTable">
                                <option value="">All Categories</option>
                                ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                            </select>
                            <input type="month" id="filterMonth" title="Filter by month" />
                        </div>
                    </div>
                    <div id="expTableWrap"></div>
                </div>

            </div>
        `;

        function applyFilters() {
            const branch   = document.getElementById('filterBranchTable').value;
            const category = document.getElementById('filterCategoryTable').value;
            const month    = document.getElementById('filterMonth').value;
            let filtered = expenses;
            if (branch)   filtered = filtered.filter(e => e.branch === branch);
            if (category) filtered = filtered.filter(e => e.category === category);
            if (month)    filtered = filtered.filter(e => e.expense_date?.startsWith(month));
            renderTable(filtered);
        }

        document.getElementById('filterBranchTable').addEventListener('change', applyFilters);
        document.getElementById('filterCategoryTable').addEventListener('change', applyFilters);
        document.getElementById('filterMonth').addEventListener('change', applyFilters);

        renderTable(expenses);

        document.getElementById('expTableWrap').addEventListener('click', async e => {
            if (!e.target.classList.contains('btn-exp-delete')) return;
            const id = e.target.dataset.id;
            const pwd = prompt('Enter admin password to delete:');
            if (!pwd) return;
            if (pwd !== '1234') return alert('Incorrect password!');
            const res = await window.api(`/api/expenses/${id}`, { method: 'DELETE' });
            if (!res.success) return alert(res.error || 'Delete failed');
            await renderHistoryTab();
        });
    }

    function renderTable(data) {
        const wrap = document.getElementById('expTableWrap');
        if (!data.length) {
            wrap.innerHTML = `<div class="exp-empty">No expenses found.</div>`;
            return;
        }

        const total = data.reduce((s, e) => s + Number(e.amount || 0), 0);

        wrap.innerHTML = `
            <div style="overflow-x:auto;">
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Slip</th>
                        <th>Date</th>
                        <th>Branch</th>
                        <th>Debitor</th>
                        <th>Category</th>
                        <th>Car</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Note</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(e => `
                        <tr>
                            <td><span class="exp-slip-badge">#${e.id}</span></td>
                            <td>${formatDate(e.expense_date)}</td>
                            <td>${e.branch || '-'}</td>
                            <td>${e.debitor || '-'}</td>
                            <td>${e.category || '-'}</td>
                            <td>${e.car_name || '-'}</td>
                            <td class="exp-amount-cell">${fmtAmt(e.amount)}</td>
                            <td>${e.payment_mode || '-'}</td>
                            <td style="max-width:150px;white-space:pre-wrap;color:#6B7280;">${e.note || '-'}</td>
                            <td><button class="btn-exp-delete" data-id="${e.id}">Delete</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
            <div class="exp-table-footer">
                Total: <strong style="margin-left:6px;">${fmtAmt(total)}</strong>
            </div>
        `;
    }

};
