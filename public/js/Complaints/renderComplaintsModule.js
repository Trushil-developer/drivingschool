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

    function initials(name) {
        return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const STATUS_META = {
        'Open':      { color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
        'In Review': { color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
        'Resolved':  { color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
        'Closed':    { color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
    };

    const CAT_META = {
        'Instructor': { icon: '👨‍🏫', color: '#7c3aed', bg: '#ede9fe' },
        'Schedule':   { icon: '📅', color: '#0369a1', bg: '#e0f2fe' },
        'Payment':    { icon: '💰', color: '#b45309', bg: '#fef3c7' },
        'Car':        { icon: '🚗', color: '#1d4ed8', bg: '#dbeafe' },
        'App':        { icon: '📱', color: '#0f766e', bg: '#ccfbf1' },
        'Other':      { icon: '📌', color: '#4b5563', bg: '#f3f4f6' },
    };

    const STATUSES   = ['Open', 'In Review', 'Resolved', 'Closed'];
    const CATEGORIES = ['Instructor', 'Schedule', 'Payment', 'Car', 'App', 'Other'];

    // ── Shell ──────────────────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="cp-page">
            <div class="cp-page-header">
                <div>
                    <h2 class="cp-page-title">Student Complaints</h2>
                    <p class="cp-page-sub">Review and respond to complaints submitted via the mobile app</p>
                </div>
                <button class="cp-refresh-btn" id="cpRefresh" title="Refresh">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Refresh
                </button>
            </div>

            <div id="cpStats" class="cp-stats"></div>

            <div class="cp-toolbar">
                <div class="cp-filters">
                    <div class="cp-filter-pill">
                        <label>Status</label>
                        <select id="cpStatus">
                            <option value="">All Statuses</option>
                            ${STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cp-filter-pill">
                        <label>Category</label>
                        <select id="cpCategory">
                            <option value="">All Categories</option>
                            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <button class="cp-btn-apply" id="cpApply">Apply</button>
                    <button class="cp-btn-clear" id="cpClear">Clear</button>
                </div>
            </div>

            <div id="cpList"></div>
        </div>
    `;

    // ── Modal — appended to body so it sits above overflow-hidden ancestors ────
    let existingModal = document.getElementById('cpModal');
    if (existingModal) existingModal.remove();

    const modalEl = document.createElement('div');
    modalEl.id = 'cpModal';
    modalEl.className = 'cp-modal-overlay';
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
        <div class="cp-modal">
            <div class="cp-modal-header">
                <div>
                    <p class="cp-modal-eyebrow">COMPLAINT #<span id="cpModalId"></span></p>
                    <h3 class="cp-modal-title" id="cpModalSubject"></h3>
                </div>
                <button class="cp-modal-close" id="cpModalClose">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <div class="cp-modal-body">
                <div class="cp-modal-complaint-box" id="cpModalMsg"></div>

                <div class="cp-modal-field">
                    <label class="cp-modal-label">Update Status</label>
                    <div class="cp-status-pills" id="cpStatusPills">
                        ${STATUSES.map(s => {
                            const m = STATUS_META[s];
                            return `<button class="cp-status-pill" data-status="${s}" style="--dot:${m.dot};--bg:${m.bg};--col:${m.color}">${s}</button>`;
                        }).join('')}
                    </div>
                </div>

                <div class="cp-modal-field">
                    <label class="cp-modal-label">Response to Student <span class="cp-label-opt">(optional)</span></label>
                    <textarea id="cpModalNote" class="cp-modal-textarea" rows="4" placeholder="Write a response that the student will see in the app…"></textarea>
                </div>
            </div>

            <div class="cp-modal-footer">
                <button class="cp-btn-cancel" id="cpModalCancel">Cancel</button>
                <button class="cp-btn-save" id="cpModalSave">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    const modal = modalEl;

    // ── Modal logic ────────────────────────────────────────────────────────────
    let currentId    = null;
    let currentStatus = null;

    function closeModal() { modal.style.display = 'none'; currentId = null; }
    document.getElementById('cpModalClose').addEventListener('click', closeModal);
    document.getElementById('cpModalCancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Status pill selection (modal is in body, so listen on modal)
    modal.addEventListener('click', e => {
        const pill = e.target.closest('.cp-status-pill');
        if (!pill) return;
        modal.querySelectorAll('.cp-status-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentStatus = pill.dataset.status;
    });

    document.getElementById('cpModalSave').addEventListener('click', async () => {
        if (!currentId || !currentStatus) return;
        const note = document.getElementById('cpModalNote').value.trim();
        const btn  = document.getElementById('cpModalSave');
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            const res = await window.api(`/api/admin/complaints/${currentId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: currentStatus, admin_note: note || null }),
            });
            if (res?.success) { closeModal(); await load(); }
            else alert('Failed to update: ' + (res?.error || 'Unknown error'));
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    });

    // ── Load & render ──────────────────────────────────────────────────────────
    async function load() {
        const list  = document.getElementById('cpList');
        const stats = document.getElementById('cpStats');
        list.innerHTML  = '<div class="cp-loading"><div class="cp-spinner"></div><span>Loading complaints…</span></div>';
        stats.innerHTML = '';

        const params = new URLSearchParams();
        const status   = document.getElementById('cpStatus').value;
        const category = document.getElementById('cpCategory').value;
        if (status)   params.set('status', status);
        if (category) params.set('category', category);

        const res = await window.api(`/api/admin/complaints?${params}`);
        const complaints = res?.success ? res.complaints : [];

        // Stat cards
        const total    = complaints.length;
        const open     = complaints.filter(c => c.status === 'Open').length;
        const inReview = complaints.filter(c => c.status === 'In Review').length;
        const resolved = complaints.filter(c => c.status === 'Resolved').length;
        const closed   = complaints.filter(c => c.status === 'Closed').length;

        stats.innerHTML = `
            <div class="cp-stat-row">
                <div class="cp-stat-card cp-stat--total">
                    <span class="cp-stat-num">${total}</span>
                    <span class="cp-stat-lbl">Total</span>
                </div>
                <div class="cp-stat-card cp-stat--open">
                    <span class="cp-stat-num">${open}</span>
                    <span class="cp-stat-lbl">Open</span>
                </div>
                <div class="cp-stat-card cp-stat--review">
                    <span class="cp-stat-num">${inReview}</span>
                    <span class="cp-stat-lbl">In Review</span>
                </div>
                <div class="cp-stat-card cp-stat--resolved">
                    <span class="cp-stat-num">${resolved}</span>
                    <span class="cp-stat-lbl">Resolved</span>
                </div>
                <div class="cp-stat-card cp-stat--closed">
                    <span class="cp-stat-num">${closed}</span>
                    <span class="cp-stat-lbl">Closed</span>
                </div>
            </div>
        `;

        if (complaints.length === 0) {
            list.innerHTML = `
                <div class="cp-empty">
                    <div class="cp-empty-icon">📭</div>
                    <div class="cp-empty-title">No complaints found</div>
                    <div class="cp-empty-sub">Try adjusting your filters or check back later.</div>
                </div>`;
            return;
        }

        list.innerHTML = complaints.map(c => {
            const sm = STATUS_META[c.status] || STATUS_META['Open'];
            const cm = CAT_META[c.category] || CAT_META['Other'];
            const avBg = stringToColor(c.student_email);
            return `
                <div class="cp-card" data-id="${c.id}">
                    <div class="cp-card-accent" style="background:${cm.color}"></div>
                    <div class="cp-card-body">
                        <div class="cp-card-top">
                            <div class="cp-card-student">
                                <div class="cp-avatar" style="background:${avBg}">${escHtml(initials(c.student_name))}</div>
                                <div>
                                    <div class="cp-student-name">${escHtml(c.student_name || 'Unknown')}</div>
                                    <div class="cp-student-email">${escHtml(c.student_email)}</div>
                                </div>
                            </div>
                            <div class="cp-card-meta">
                                <span class="cp-cat-chip" style="background:${cm.bg};color:${cm.color}">${cm.icon} ${c.category}</span>
                                <span class="cp-status-chip" style="background:${sm.bg};color:${sm.color}">
                                    <span class="cp-status-dot" style="background:${sm.dot}"></span>
                                    ${c.status}
                                </span>
                            </div>
                        </div>

                        <div class="cp-card-subject">${escHtml(c.subject)}</div>
                        <div class="cp-card-message">${escHtml(c.message)}</div>

                        ${c.admin_note ? `
                        <div class="cp-response-box">
                            <div class="cp-response-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                                Admin Response
                            </div>
                            <div class="cp-response-text">${escHtml(c.admin_note)}</div>
                        </div>` : ''}

                        <div class="cp-card-footer">
                            <span class="cp-card-date">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ${fmtDT(c.created_at)}
                            </span>
                            <button class="cp-respond-btn" data-id="${c.id}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Respond
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Wire respond buttons
        list.querySelectorAll('.cp-respond-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const c = complaints.find(x => x.id === Number(btn.dataset.id));
                if (!c) return;
                currentId     = c.id;
                currentStatus = c.status;

                document.getElementById('cpModalId').textContent      = c.id;
                document.getElementById('cpModalSubject').textContent  = c.subject;
                document.getElementById('cpModalNote').value           = c.admin_note || '';
                document.getElementById('cpModalMsg').textContent      = c.message;

                // Set active pill
                modal.querySelectorAll('.cp-status-pill').forEach(p => {
                    p.classList.toggle('active', p.dataset.status === c.status);
                });

                modal.style.display = 'flex';
            });
        });
    }

    // Deterministic avatar colour from email string
    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const pallete = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#0ea5e9','#84cc16'];
        return pallete[Math.abs(hash) % pallete.length];
    }

    document.getElementById('cpApply').addEventListener('click', load);
    document.getElementById('cpRefresh').addEventListener('click', load);
    document.getElementById('cpClear').addEventListener('click', () => {
        document.getElementById('cpStatus').value   = '';
        document.getElementById('cpCategory').value = '';
        load();
    });

    await load();
};
