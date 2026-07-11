window.renderComplaintsModule = async function (tableWrap) {
    function fmtDT(str) {
        if (!str) return '—';
        const d = new Date(str);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        }).format(d);
    }

    const STATUS_COLOR = {
        'Open':      '#C47F00',
        'In Review': '#185FA5',
        'Resolved':  '#0F6E56',
        'Closed':    '#9BA3B2',
    };

    const STATUSES   = ['Open', 'In Review', 'Resolved', 'Closed'];
    const CATEGORIES = ['Instructor', 'Schedule', 'Payment', 'Car', 'App', 'Other'];

    tableWrap.innerHTML = `
        <div class="cp-wrap">
            <div class="cp-header">
                <h2 class="cp-title">Student Complaints</h2>
                <p class="cp-subtitle">Complaints submitted via the mobile app</p>
            </div>

            <div class="cp-filters">
                <div class="cp-filter-group">
                    <label>Status</label>
                    <select id="cpStatus">
                        <option value="">All Statuses</option>
                        ${STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="cp-filter-group">
                    <label>Category</label>
                    <select id="cpCategory">
                        <option value="">All Categories</option>
                        ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button class="cp-apply-btn" id="cpApply">Apply</button>
                <button class="cp-clear-btn" id="cpClear">Clear</button>
            </div>

            <div id="cpSummary" class="cp-summary"></div>
            <div id="cpContent"></div>
        </div>

        <!-- Update modal -->
        <div id="cpModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:16px;padding:28px;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
                <h3 style="margin:0 0 4px;font-size:17px;color:#1a1a2e;">Update Complaint</h3>
                <p id="cpModalSubject" style="font-size:13px;color:#5a6478;margin:0 0 20px;"></p>
                <label style="font-size:12px;font-weight:600;color:#5a6478;display:block;margin-bottom:6px;">Status</label>
                <select id="cpModalStatus" style="width:100%;padding:10px 12px;border:1px solid #e0e0e0;border-radius:10px;font-size:14px;margin-bottom:16px;">
                    ${STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <label style="font-size:12px;font-weight:600;color:#5a6478;display:block;margin-bottom:6px;">Admin Note (optional)</label>
                <textarea id="cpModalNote" rows="4" placeholder="Write a response to the student..." style="width:100%;padding:10px 12px;border:1px solid #e0e0e0;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box;margin-bottom:20px;"></textarea>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="cpModalCancel" style="padding:10px 20px;border:1px solid #e0e0e0;border-radius:10px;background:#fff;cursor:pointer;font-size:14px;">Cancel</button>
                    <button id="cpModalSave" style="padding:10px 20px;border:none;border-radius:10px;background:#0F6E56;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Save</button>
                </div>
            </div>
        </div>
    `;

    let currentId = null;

    const modal = document.getElementById('cpModal');
    document.getElementById('cpModalCancel').addEventListener('click', () => {
        modal.style.display = 'none';
        currentId = null;
    });

    document.getElementById('cpModalSave').addEventListener('click', async () => {
        if (!currentId) return;
        const status    = document.getElementById('cpModalStatus').value;
        const adminNote = document.getElementById('cpModalNote').value.trim();
        const btn = document.getElementById('cpModalSave');
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            const res = await window.api(`/api/admin/complaints/${currentId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status, admin_note: adminNote || null }),
            });
            if (res?.success) {
                modal.style.display = 'none';
                currentId = null;
                await load();
            } else {
                alert('Failed to update: ' + (res?.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    });

    async function load() {
        const content = document.getElementById('cpContent');
        const summary = document.getElementById('cpSummary');
        content.innerHTML = '<div class="loading-overlay">Loading...</div>';
        summary.innerHTML = '';

        const params = new URLSearchParams();
        const status   = document.getElementById('cpStatus').value;
        const category = document.getElementById('cpCategory').value;
        if (status)   params.set('status', status);
        if (category) params.set('category', category);

        const res = await window.api(`/api/admin/complaints?${params}`);
        const complaints = res?.success ? res.complaints : [];

        // Summary cards
        const open     = complaints.filter(c => c.status === 'Open').length;
        const inReview = complaints.filter(c => c.status === 'In Review').length;
        const resolved = complaints.filter(c => c.status === 'Resolved').length;

        summary.innerHTML = `
            <div class="cp-stat-cards">
                <div class="cp-stat"><span class="cp-stat-val">${complaints.length}</span><span class="cp-stat-label">Total</span></div>
                <div class="cp-stat cp-stat--open"><span class="cp-stat-val">${open}</span><span class="cp-stat-label">Open</span></div>
                <div class="cp-stat cp-stat--review"><span class="cp-stat-val">${inReview}</span><span class="cp-stat-label">In Review</span></div>
                <div class="cp-stat cp-stat--resolved"><span class="cp-stat-val">${resolved}</span><span class="cp-stat-label">Resolved</span></div>
            </div>
        `;

        if (complaints.length === 0) {
            content.innerHTML = '<div class="cp-empty">No complaints found.</div>';
            return;
        }

        content.innerHTML = `
            <div class="cp-table-wrap">
                <table class="cp-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student</th>
                            <th>Category</th>
                            <th>Subject</th>
                            <th>Message</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${complaints.map((c, i) => `
                            <tr>
                                <td class="cp-num">${i + 1}</td>
                                <td class="cp-student">
                                    <div class="cp-student-name">${c.student_name || '—'}</div>
                                    <div class="cp-student-email">${c.student_email}</div>
                                </td>
                                <td><span class="cp-cat-badge">${c.category}</span></td>
                                <td class="cp-subject">${escHtml(c.subject)}</td>
                                <td class="cp-msg">
                                    <div class="cp-msg-text">${escHtml(c.message)}</div>
                                    ${c.admin_note ? `<div class="cp-admin-note"><strong>Response:</strong> ${escHtml(c.admin_note)}</div>` : ''}
                                </td>
                                <td class="cp-date">${fmtDT(c.created_at)}</td>
                                <td>
                                    <span class="cp-status-badge" style="background:${STATUS_COLOR[c.status]}22;color:${STATUS_COLOR[c.status]};">
                                        ${c.status}
                                    </span>
                                </td>
                                <td>
                                    <button class="cp-update-btn" data-id="${c.id}" data-status="${c.status}" data-note="${escAttr(c.admin_note || '')}">
                                        Update
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        content.querySelectorAll('.cp-update-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = complaints.find(c => c.id === Number(btn.dataset.id));
                if (!row) return;
                currentId = row.id;
                document.getElementById('cpModalSubject').textContent = row.subject;
                document.getElementById('cpModalStatus').value = row.status;
                document.getElementById('cpModalNote').value   = row.admin_note || '';
                modal.style.display = 'flex';
            });
        });
    }

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
        return String(str ?? '').replace(/"/g, '&quot;');
    }

    document.getElementById('cpApply').addEventListener('click', load);
    document.getElementById('cpClear').addEventListener('click', () => {
        document.getElementById('cpStatus').value   = '';
        document.getElementById('cpCategory').value = '';
        load();
    });

    await load();
};
