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
                <button class="exp-tab" data-tab="categories">Expense Categories</button>
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
            else if (btn.dataset.tab === 'history') renderHistoryTab();
            else renderCategoryTab();
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
                        <label>Paid By (Name) *</label>
                        <input type="text" id="expDebitor" placeholder="Enter name of person paying this expense..." />
                    </div>

                    <div class="exp-field">
                        <label>Expense Category *</label>
                        <div class="exp-inline">
                            <select id="expCategory">
                                <option value="">Select category...</option>
                                ${categories.map(c => `<option value="${c.id}" data-extra="${c.extra_field || ''}">${c.name}</option>`).join('')}
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

                    <div class="exp-field" id="expEmployeeField" style="display:none;">
                        <label>Employee *</label>
                        <select id="expEmployee">
                            <option value="">Select employee...</option>
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

        // Show/hide car/employee fields based on category's extra_field setting
        document.getElementById('expCategory').addEventListener('change', async function () {
            const opt = this.options[this.selectedIndex];
            const extraField = opt?.dataset.extra || '';

            const carField = document.getElementById('expCarField');
            const empField = document.getElementById('expEmployeeField');
            const empSelect = document.getElementById('expEmployee');

            carField.style.display = extraField === 'car' ? '' : 'none';
            if (extraField !== 'car') document.getElementById('expCar').value = '';

            if (extraField === 'employee') {
                empField.style.display = '';
                empSelect.innerHTML = '<option value="">Loading...</option>';
                empSelect.disabled = true;
                try {
                    const res = await window.api('/api/instructors');
                    const employees = res?.success ? res.instructors.filter(i => i.is_active) : [];
                    empSelect.innerHTML = '<option value="">Select employee...</option>' +
                        employees.map(e => `<option value="${e.instructor_name}">${e.instructor_name}${e.role && e.role !== 'Instructor' ? ' (' + e.role + ')' : ''}</option>`).join('');
                    empSelect.disabled = false;
                } catch {
                    empSelect.innerHTML = '<option value="">Failed to load</option>';
                }
            } else {
                empField.style.display = 'none';
                empSelect.value = '';
            }
        });

        // No auto-fill — Debitor and Employee are independent fields

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
            const employee_name   = document.getElementById('expEmployee').value || null;
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
            if (!debitor)                         return showErr(msg, 'Please enter the name of person paying this expense.');
            if (!category_id)                     return showErr(msg, 'Please select a category.');
            if (!amount || Number(amount) <= 0)   return showErr(msg, 'Please enter a valid amount.');
            if (!payment_mode_id)                 return showErr(msg, 'Please select a payment mode.');
            if (!expense_date)                    return showErr(msg, 'Please select a date.');

            const catOpt = document.getElementById('expCategory').options[document.getElementById('expCategory').selectedIndex];
            const extraField = catOpt?.dataset.extra || '';
            if (extraField === 'car' && !car_id) return showErr(msg, 'Please select a car for this category.');
            if (extraField === 'employee' && !document.getElementById('expEmployee').value)
                return showErr(msg, 'Please select an employee for this category.');

            const btn = document.getElementById('btnSubmitExpense');
            btn.disabled = true;
            btn.textContent = 'Submitting...';

            const res = await window.api('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({ branch, debitor, employee_name, category_id, car_id, amount, payment_mode_id, note, expense_date })
            });

            btn.disabled = false;
            btn.textContent = 'Submit Expense';

            if (!res.success) return showErr(msg, res.error || 'Failed to submit');

            msg.className = 'exp-form-msg success';
            msg.innerHTML = `Expense saved! Slip No: <strong>#${res.slip_no}</strong>`;

            // Reset
            ['expBranch','expDebitor','expCategory','expCar','expAmount','expPayMode','expNote','expEmployee'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('expCarField').style.display = 'none';
            document.getElementById('expEmployeeField').style.display = 'none';
            document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
        });
    }

    function showErr(el, msg) {
        el.className = 'exp-form-msg error';
        el.textContent = msg;
    }

    // =====================
    // EXPENSE CATEGORIES TAB
    // =====================
    async function renderCategoryTab() {
        tabContent.innerHTML = `<div class="loading-overlay">Loading...</div>`;

        const res = await window.api('/api/expenses/categories');
        const categories = res?.success ? res.categories : [];

        tabContent.innerHTML = `
            <div class="exp-cat-wrap">
                <div class="exp-cat-header">
                    <h4>Expense Categories</h4>
                    <button class="btn-exp-submit" id="btnAddCatRow" style="padding:8px 16px;font-size:13px;">+ Add Category</button>
                </div>
                <div id="expCatMsg" class="exp-form-msg" style="margin-bottom:12px;"></div>
                <table class="expenses-table exp-cat-table">
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th>Category Name</th>
                            <th style="width:140px;">Extra Field</th>
                            <th style="width:120px;"></th>
                        </tr>
                    </thead>
                    <tbody id="expCatBody">
                        ${categories.map((c, i) => {
                            const ef = c.extra_field || '';
                            const efLabel = ef === 'car' ? '<span class="exp-badge-yes">Car</span>'
                                          : ef === 'employee' ? '<span class="exp-badge-emp">Employee</span>'
                                          : '<span class="exp-badge-no">None</span>';
                            return `
                            <tr data-id="${c.id}" data-custom="${c.is_custom}">
                                <td>${i + 1}</td>
                                <td class="cat-name-cell">${c.name}</td>
                                <td class="cat-ef-cell">${efLabel}</td>
                                <td class="cat-actions">
                                    ${c.is_custom
                                        ? `<button class="btn-cat-edit" data-id="${c.id}" data-name="${c.name}" data-extra="${ef}">Edit</button>
                                           <button class="btn-exp-delete btn-cat-delete" data-id="${c.id}">Delete</button>`
                                        : '<span style="color:#9CA3AF;font-size:12px;">—</span>'
                                    }
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const msg = document.getElementById('expCatMsg');

        // Add new category row
        document.getElementById('btnAddCatRow').addEventListener('click', () => {
            const tbody = document.getElementById('expCatBody');
            // Avoid adding duplicate add row
            if (tbody.querySelector('.cat-new-row')) return;
            const tr = document.createElement('tr');
            tr.className = 'cat-new-row';
            tr.innerHTML = `
                <td>—</td>
                <td><input type="text" class="cat-input" id="newCatName" placeholder="Category name..." /></td>
                <td>
                    <select class="cat-input" id="newCatExtraField">
                        <option value="">None</option>
                        <option value="car">Car</option>
                        <option value="employee">Employee</option>
                    </select>
                </td>
                <td>
                    <button class="btn-exp-submit btn-cat-save" id="btnSaveNewCat" style="padding:5px 12px;font-size:12px;">Save</button>
                    <button class="btn-cat-cancel" id="btnCancelNewCat">Cancel</button>
                </td>
            `;
            tbody.insertBefore(tr, tbody.firstChild);

            document.getElementById('btnCancelNewCat').addEventListener('click', () => tr.remove());
            document.getElementById('btnSaveNewCat').addEventListener('click', async () => {
                const name = document.getElementById('newCatName').value.trim();
                const extra_field = document.getElementById('newCatExtraField').value;
                if (!name) { msg.className = 'exp-form-msg error'; msg.textContent = 'Category name is required.'; return; }
                const r = await window.api('/api/expenses/categories', {
                    method: 'POST',
                    body: JSON.stringify({ name, extra_field: extra_field || null })
                });
                if (!r.success) { msg.className = 'exp-form-msg error'; msg.textContent = r.error || 'Failed to add.'; return; }
                expCategoriesCache = null;
                await renderCategoryTab();
            });
        });

        // Edit / Delete
        document.getElementById('expCatBody').addEventListener('click', e => {
            const row = e.target.closest('tr');
            if (!row) return;
            const id = row.dataset.id;

            if (e.target.classList.contains('btn-cat-edit')) {
                const pwd = prompt('Enter admin password to edit:');
                if (!pwd) return;
                if (pwd !== '1234') return alert('Incorrect password!');

                const nameCell = row.querySelector('.cat-name-cell');
                const efCell = row.querySelector('.cat-ef-cell');
                const currentName = e.target.dataset.name;
                const currentExtra = e.target.dataset.extra || '';

                nameCell.innerHTML = `<input type="text" class="cat-input" id="editCatName_${id}" value="${currentName.replace(/"/g, '&quot;')}" style="width:100%;" />`;
                efCell.innerHTML = `
                    <select class="cat-input" id="editCatExtra_${id}">
                        <option value="" ${currentExtra === '' ? 'selected' : ''}>None</option>
                        <option value="car" ${currentExtra === 'car' ? 'selected' : ''}>Car</option>
                        <option value="employee" ${currentExtra === 'employee' ? 'selected' : ''}>Employee</option>
                    </select>`;
                const actionsCell = row.querySelector('.cat-actions');
                actionsCell.innerHTML = `
                    <button class="btn-exp-submit btn-cat-save-edit" style="padding:5px 12px;font-size:12px;">Save</button>
                    <button class="btn-cat-cancel">Cancel</button>
                `;

                actionsCell.querySelector('.btn-cat-save-edit').addEventListener('click', async () => {
                    const name = document.getElementById(`editCatName_${id}`).value.trim();
                    const extra_field = document.getElementById(`editCatExtra_${id}`).value;
                    if (!name) { msg.className = 'exp-form-msg error'; msg.textContent = 'Category name is required.'; return; }
                    const r = await window.api(`/api/expenses/categories/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ name, extra_field: extra_field || null })
                    });
                    if (!r.success) { msg.className = 'exp-form-msg error'; msg.textContent = r.error || 'Failed to update.'; return; }
                    expCategoriesCache = null;
                    await renderCategoryTab();
                });

                actionsCell.querySelector('.btn-cat-cancel').addEventListener('click', async () => {
                    expCategoriesCache = null;
                    await renderCategoryTab();
                });
            }

            if (e.target.classList.contains('btn-cat-delete')) {
                const pwd = prompt('Enter admin password to delete:');
                if (!pwd) return;
                if (pwd !== '1234') return alert('Incorrect password!');
                if (!confirm('Delete this category? This cannot be undone.')) return;
                window.api(`/api/expenses/categories/${id}`, { method: 'DELETE' }).then(async r => {
                    if (!r.success) { msg.className = 'exp-form-msg error'; msg.textContent = r.error || 'Failed to delete.'; return; }
                    expCategoriesCache = null;
                    await renderCategoryTab();
                });
            }
        });
    }

    // =====================
    // HISTORY TAB
    // =====================
    let expFilterBranch = '';
    let expFilterCategory = '';
    const _now = new Date();
    let expFilterMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    let expCategoriesCache = null;
    let expBranchesCache = null;
    let expModesCache = null;
    let expCarsCache = null;

    async function renderHistoryTab(page = 1) {
        tabContent.innerHTML = `<div class="loading-overlay">Loading...</div>`;

        // Load filter options once
        if (!expCategoriesCache || !expBranchesCache || !expModesCache || !expCarsCache) {
            const [resCategories, resBranches, resModes, resCars] = await Promise.all([
                window.api('/api/expenses/categories'),
                window.api('/api/branches'),
                window.api('/api/expenses/payment-modes'),
                window.api('/api/cars')
            ]);
            expCategoriesCache = resCategories?.success ? resCategories.categories : [];
            expBranchesCache = resBranches?.success ? resBranches.branches : [];
            expModesCache = resModes?.success ? resModes.modes : [];
            expCarsCache = resCars?.success ? resCars.cars : [];
        }

        const params = new URLSearchParams({ page, limit: 50 });
        if (expFilterBranch) params.set('branch', expFilterBranch);
        if (expFilterCategory) params.set('category', expFilterCategory);
        if (expFilterMonth) params.set('month', expFilterMonth);

        const resExpenses = await window.api(`/api/expenses?${params}`);
        const expenses = resExpenses?.success ? resExpenses.expenses : [];
        const total = resExpenses?.total || 0;
        const limit = resExpenses?.limit || 50;
        const totalPages = Math.ceil(total / limit);
        const pageAmt = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        const paginationHTML = totalPages > 1
            ? `<div class="pagination-bar">
                <button class="pg-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="pg-info">Page ${page} of ${totalPages} (${total} total)</span>
                <button class="pg-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
               </div>`
            : `<div class="pg-info-only">Showing ${expenses.length} of ${total} record${total !== 1 ? 's' : ''}</div>`;

        tabContent.innerHTML = `
            <div class="exp-history-wrap">
                <div class="exp-summary-strip">
                    <div class="exp-summary-card">
                        <div class="label">Total Entries</div>
                        <div class="value blue">${total}</div>
                    </div>
                    <div class="exp-summary-card">
                        <div class="label">Page Amount</div>
                        <div class="value green">${fmtAmt(pageAmt)}</div>
                    </div>
                </div>
                <div class="exp-table-section">
                    <div class="exp-table-header">
                        <h4>Expense Records</h4>
                        <div class="exp-table-filters">
                            <select id="filterBranchTable">
                                <option value="">All Branches</option>
                                ${expBranchesCache.map(b => `<option value="${b.branch_name}" ${expFilterBranch === b.branch_name ? 'selected' : ''}>${b.branch_name}</option>`).join('')}
                            </select>
                            <select id="filterCategoryTable">
                                <option value="">All Categories</option>
                                ${expCategoriesCache.map(c => `<option value="${c.name}" ${expFilterCategory === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                            </select>
                            <input type="month" id="filterMonth" title="Filter by month" value="${expFilterMonth}" />
                        </div>
                    </div>
                    <div id="expTableWrap"></div>
                    ${paginationHTML}
                </div>
            </div>
        `;

        renderTable(expenses);

        document.getElementById('filterBranchTable').addEventListener('change', e => {
            expFilterBranch = e.target.value;
            renderHistoryTab(1);
        });
        document.getElementById('filterCategoryTable').addEventListener('change', e => {
            expFilterCategory = e.target.value;
            renderHistoryTab(1);
        });
        document.getElementById('filterMonth').addEventListener('change', e => {
            expFilterMonth = e.target.value;
            renderHistoryTab(1);
        });

        tabContent.querySelectorAll('.pg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page);
                if (p >= 1 && p <= totalPages) renderHistoryTab(p);
            });
        });

        document.getElementById('expTableWrap').addEventListener('click', async e => {
            const id = e.target.dataset.id;
            if (!id) return;

            if (e.target.classList.contains('btn-exp-delete')) {
                const pwd = prompt('Enter admin password to delete:');
                if (!pwd) return;
                if (pwd !== '1234') return alert('Incorrect password!');
                const res = await window.api(`/api/expenses/${id}`, { method: 'DELETE' });
                if (!res.success) return alert(res.error || 'Delete failed');
                await renderHistoryTab(page);
            }

            if (e.target.classList.contains('btn-exp-edit')) {
                const pwd = prompt('Enter admin password to edit:');
                if (!pwd) return;
                if (pwd !== '1234') return alert('Incorrect password!');
                const expense = expenses.find(ex => String(ex.id) === String(id));
                if (!expense) return;
                showExpenseEditModal(expense, async () => renderHistoryTab(page));
            }
        });
    }

    async function showExpenseEditModal(expense, onSaved) {
        let modal = document.getElementById('expEditModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'expEditModal';
            document.body.appendChild(modal);
        }

        const branches   = expBranchesCache || [];
        const categories = expCategoriesCache || [];
        const modes      = expModesCache || [];
        const cars       = expCarsCache || [];

        const dateVal = expense.expense_date ? expense.expense_date.split('T')[0] : '';

        modal.innerHTML = `
            <div class="exp-modal-overlay">
                <div class="exp-modal-box">
                    <div class="exp-modal-header">
                        <h3>Edit Expense <span class="exp-slip-badge">#${expense.id}</span></h3>
                        <button class="exp-modal-close" id="btnExpEditClose">&times;</button>
                    </div>
                    <div class="exp-form-grid">
                        <div class="exp-field">
                            <label>Branch *</label>
                            <select id="editExpBranch">
                                <option value="">Select branch...</option>
                                ${branches.map(b => `<option value="${b.branch_name}" ${expense.branch === b.branch_name ? 'selected' : ''}>${b.branch_name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="exp-field">
                            <label>Paid By (Name) *</label>
                            <input type="text" id="editExpDebitor" value="${expense.debitor || ''}" />
                        </div>
                        <div class="exp-field">
                            <label>Expense Category *</label>
                            <select id="editExpCategory">
                                <option value="">Select category...</option>
                                ${categories.map(c => `<option value="${c.id}" data-extra="${c.extra_field || ''}" ${String(c.id) === String(expense.category_id) ? 'selected' : ''}>${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="exp-field" id="editExpCarField" style="display:none;">
                            <label>Car *</label>
                            <select id="editExpCar">
                                <option value="">Select car...</option>
                                ${cars.map(c => `<option value="${c.id}" ${String(c.id) === String(expense.car_id) ? 'selected' : ''}>${c.car_name}${c.branch ? ' (' + c.branch + ')' : ''}</option>`).join('')}
                            </select>
                        </div>
                        <div class="exp-field" id="editExpEmployeeField" style="display:none;">
                            <label>Employee *</label>
                            <select id="editExpEmployee">
                                <option value="">Loading...</option>
                            </select>
                        </div>
                        <div class="exp-field">
                            <label>Amount (Rs.) *</label>
                            <input type="number" id="editExpAmount" value="${expense.amount || ''}" min="0" step="0.01" />
                        </div>
                        <div class="exp-field">
                            <label>Payment Mode *</label>
                            <select id="editExpPayMode">
                                <option value="">Select mode...</option>
                                ${modes.map(m => `<option value="${m.id}" ${String(m.id) === String(expense.payment_mode_id) ? 'selected' : ''}>${m.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="exp-field">
                            <label>Expense Date *</label>
                            <input type="date" id="editExpDate" value="${dateVal}" />
                        </div>
                        <div class="exp-field exp-field-full">
                            <label>Note</label>
                            <textarea id="editExpNote" rows="3">${expense.note || ''}</textarea>
                        </div>
                    </div>
                    <div class="exp-form-footer">
                        <button id="btnExpEditSave" class="btn-exp-submit">Save Changes</button>
                        <button id="btnExpEditCancel" class="btn-exp-cancel">Cancel</button>
                        <div id="expEditMsg" class="exp-form-msg"></div>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';

        async function applyExtraField(extraField, empName) {
            const carField  = document.getElementById('editExpCarField');
            const empField  = document.getElementById('editExpEmployeeField');
            const empSelect = document.getElementById('editExpEmployee');
            const carSel    = document.getElementById('editExpCar');

            carField.style.display = extraField === 'car' ? '' : 'none';
            if (extraField !== 'car' && carSel) carSel.value = '';

            if (extraField === 'employee') {
                empField.style.display = '';
                empSelect.innerHTML = '<option value="">Loading...</option>';
                empSelect.disabled = true;
                try {
                    const res = await window.api('/api/instructors');
                    const employees = res?.success ? res.instructors.filter(i => i.is_active) : [];
                    empSelect.innerHTML = '<option value="">Select employee...</option>' +
                        employees.map(e => `<option value="${e.instructor_name}" ${e.instructor_name === empName ? 'selected' : ''}>${e.instructor_name}</option>`).join('');
                } catch {
                    empSelect.innerHTML = '<option value="">Failed to load</option>';
                }
                empSelect.disabled = false;
            } else {
                empField.style.display = 'none';
                if (empSelect) empSelect.value = '';
            }
        }

        const catSel = document.getElementById('editExpCategory');
        await applyExtraField(expense.extra_field || '', expense.employee_name);

        catSel.addEventListener('change', async function () {
            const opt = this.options[this.selectedIndex];
            await applyExtraField(opt?.dataset.extra || '', '');
        });

        const closeModal = () => { modal.style.display = 'none'; };
        document.getElementById('btnExpEditClose').addEventListener('click', closeModal);
        document.getElementById('btnExpEditCancel').addEventListener('click', closeModal);
        modal.querySelector('.exp-modal-overlay').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeModal();
        });

        document.getElementById('btnExpEditSave').addEventListener('click', async () => {
            const msg = document.getElementById('expEditMsg');
            msg.className = 'exp-form-msg';
            msg.textContent = '';

            const branch          = document.getElementById('editExpBranch').value;
            const debitor         = document.getElementById('editExpDebitor').value.trim();
            const category_id     = document.getElementById('editExpCategory').value;
            const car_id          = document.getElementById('editExpCar')?.value || null;
            const employee_name   = document.getElementById('editExpEmployee')?.value || null;
            const amount          = document.getElementById('editExpAmount').value;
            const payment_mode_id = document.getElementById('editExpPayMode').value;
            const expense_date    = document.getElementById('editExpDate').value;
            const note            = document.getElementById('editExpNote').value.trim();

            const catOpt = document.getElementById('editExpCategory').options[document.getElementById('editExpCategory').selectedIndex];
            const extraField = catOpt?.dataset.extra || '';

            if (!branch)                       { msg.className = 'exp-form-msg error'; msg.textContent = 'Select a branch.'; return; }
            if (!debitor)                      { msg.className = 'exp-form-msg error'; msg.textContent = 'Enter paid by name.'; return; }
            if (!category_id)                  { msg.className = 'exp-form-msg error'; msg.textContent = 'Select a category.'; return; }
            if (!amount || Number(amount) <= 0){ msg.className = 'exp-form-msg error'; msg.textContent = 'Enter a valid amount.'; return; }
            if (!payment_mode_id)              { msg.className = 'exp-form-msg error'; msg.textContent = 'Select a payment mode.'; return; }
            if (!expense_date)                 { msg.className = 'exp-form-msg error'; msg.textContent = 'Select a date.'; return; }
            if (extraField === 'car' && !car_id) { msg.className = 'exp-form-msg error'; msg.textContent = 'Select a car.'; return; }
            if (extraField === 'employee' && !employee_name) { msg.className = 'exp-form-msg error'; msg.textContent = 'Select an employee.'; return; }

            const btn = document.getElementById('btnExpEditSave');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            const res = await window.api(`/api/expenses/${expense.id}`, {
                method: 'PUT',
                body: JSON.stringify({ branch, debitor, employee_name: extraField === 'employee' ? employee_name : null, category_id, car_id: extraField === 'car' ? car_id : null, amount, payment_mode_id, note, expense_date })
            });

            btn.disabled = false;
            btn.textContent = 'Save Changes';

            if (!res?.success) {
                msg.className = 'exp-form-msg error';
                msg.textContent = res?.error || 'Failed to save.';
                return;
            }

            closeModal();
            await onSaved();
        });
    }

    function renderTable(data) {
        const wrap = document.getElementById('expTableWrap');
        if (!data.length) {
            wrap.innerHTML = `<div class="exp-empty">No expenses found.</div>`;
            return;
        }

        const pageTotal = data.reduce((s, e) => s + Number(e.amount || 0), 0);

        wrap.innerHTML = `
            <div style="overflow-x:auto;">
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Slip</th>
                        <th>Date</th>
                        <th>Branch</th>
                        <th>Paid By</th>
                        <th>Employee</th>
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
                            <td>${e.employee_name || '-'}</td>
                            <td>${e.category || '-'}</td>
                            <td>${e.car_name || '-'}</td>
                            <td class="exp-amount-cell">${fmtAmt(e.amount)}</td>
                            <td>${e.payment_mode || '-'}</td>
                            <td style="max-width:150px;white-space:pre-wrap;color:#6B7280;">${e.note || '-'}</td>
                            <td class="exp-row-actions">
                                <button class="btn-exp-edit" data-id="${e.id}">Edit</button>
                                <button class="btn-exp-delete" data-id="${e.id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
            <div class="exp-table-footer">
                Page Total: <strong style="margin-left:6px;">${fmtAmt(pageTotal)}</strong>
            </div>
        `;
    }

};
