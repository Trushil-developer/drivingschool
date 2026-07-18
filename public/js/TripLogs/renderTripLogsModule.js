window.renderTripLogsModule = async function (tableWrap) {

    function fmtDT(str) {
        if (!str) return '—';
        const d = new Date(str);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        }).format(d);
    }

    function fmtDur(mins) {
        if (!mins && mins !== 0) return '—';
        const m = Number(mins);
        if (m < 60) return `${m} min`;
        return `${Math.floor(m / 60)}h ${m % 60}m`;
    }

    function actualDur(trip) {
        if (trip.status === 'missing') return '—';
        const MAX_MINS = 120;
        const start = trip.started_at ? new Date(trip.started_at) : null;
        if (!start) return '—';
        const end  = trip.ended_at ? new Date(trip.ended_at) : new Date();
        const mins = Math.min(MAX_MINS, Math.floor((end - start) / 60000));
        if (trip.status === 'active') {
            if (mins < 60) return `${mins} min <span class="tl-live">(live)</span>`;
            return `${Math.floor(mins / 60)}h ${mins % 60}m <span class="tl-live">(live)</span>`;
        }
        if (mins < 60) return `${mins} min`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }

    // ── 1. Load instructors for filter dropdown ─────────────────────────────
    const resInst = await window.api('/api/instructors');
    const instructors = (resInst?.success ? resInst.instructors : [])
        .filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');

    // ── 2. Main layout ──────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="tl-wrap">
            <div class="tl-header">
                <h2 class="tl-title">Trips</h2>
                <p class="tl-subtitle">History of all instructor driving sessions</p>
            </div>

            <div class="tl-filters">
                <div class="tl-filter-group">
                    <label>From</label>
                    <input type="date" id="tlDateFrom">
                </div>
                <div class="tl-filter-group">
                    <label>To</label>
                    <input type="date" id="tlDateTo">
                </div>
                <div class="tl-filter-group">
                    <label>Instructor</label>
                    <select id="tlInstructor">
                        <option value="">All Instructors</option>
                        ${instructors.map(i => `<option value="${i.id}">${i.instructor_name}</option>`).join('')}
                    </select>
                </div>
                <div class="tl-filter-group">
                    <label>Status</label>
                    <select id="tlStatus">
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="missing">Missing</option>
                    </select>
                </div>
                <button class="tl-apply-btn" id="tlApply">Apply</button>
                <button class="tl-clear-btn" id="tlClear">Clear</button>
            </div>

            <div id="tlSummary" class="tl-summary"></div>
            <div id="tlContent"></div>
        </div>
    `;

    // Default date range: last 30 days
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    document.getElementById('tlDateFrom').value = monthAgo.toISOString().split('T')[0];
    document.getElementById('tlDateTo').value   = today.toISOString().split('T')[0];

    async function load() {
        const content = document.getElementById('tlContent');
        const summary = document.getElementById('tlSummary');
        content.innerHTML = '<div class="loading-overlay">Loading...</div>';
        summary.innerHTML = '';

        const params = new URLSearchParams();
        const from = document.getElementById('tlDateFrom').value;
        const to   = document.getElementById('tlDateTo').value;
        const inst = document.getElementById('tlInstructor').value;
        const stat = document.getElementById('tlStatus').value;
        if (from) params.set('date_from', from);
        if (to)   params.set('date_to', to);
        if (inst) params.set('instructor_id', inst);
        if (stat) params.set('status', stat);

        const res = await window.api(`/api/admin/trip-logs?${params}`);
        const trips = res?.success ? res.trips : [];

        // ── Summary cards ─────────────────────────────────────────────────
        const completed = trips.filter(t => t.status === 'completed');
        const active    = trips.filter(t => t.status === 'active');
        const missing   = trips.filter(t => t.status === 'missing');
        const totalMins = completed.reduce((s, t) => {
            const start = t.started_at ? new Date(t.started_at) : null;
            const end   = t.ended_at   ? new Date(t.ended_at)   : null;
            if (!start || !end) return s;
            return s + Math.floor((end - start) / 60000);
        }, 0);
        const uniqueInst = new Set(trips.map(t => t.instructor_id)).size;

        summary.innerHTML = `
            <div class="tl-stat-cards">
                <div class="tl-stat">
                    <span class="tl-stat-val">${trips.length - missing.length}</span>
                    <span class="tl-stat-label">Total Trips</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${completed.length}</span>
                    <span class="tl-stat-label">Completed</span>
                </div>
                <div class="tl-stat tl-stat--active">
                    <span class="tl-stat-val">${active.length}</span>
                    <span class="tl-stat-label">Active Now</span>
                </div>
                <div class="tl-stat tl-stat--missing">
                    <span class="tl-stat-val">${missing.length}</span>
                    <span class="tl-stat-label">Missing</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${fmtDur(totalMins)}</span>
                    <span class="tl-stat-label">Total Duration</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${uniqueInst}</span>
                    <span class="tl-stat-label">Instructors</span>
                </div>
            </div>
        `;

        // ── Table ─────────────────────────────────────────────────────────
        if (trips.length === 0) {
            content.innerHTML = '<div class="tl-empty">No trip logs found for the selected filters.</div>';
            return;
        }

        content.innerHTML = `
            <div class="tl-table-wrap">
                <table class="tl-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Instructor</th>
                            <th>Branch</th>
                            <th>Student</th>
                            <th>Start Meter</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Approve</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trips.map((t, i) => `
                            <tr>
                                <td class="tl-num">${i + 1}</td>
                                <td class="tl-name">${t.instructor_name || '—'}</td>
                                <td class="tl-branch">${t.branch || '—'}</td>
                                <td class="tl-student">${t.student_name || '—'}</td>
                                <td class="tl-odometer">${(t.start_odometer ?? '—')}</td>
                                <td class="tl-time">${fmtDT(t.started_at)}</td>
                                <td class="tl-time">${t.ended_at ? fmtDT(t.ended_at) : '—'}</td>
                                <td class="tl-dur">${actualDur(t)}</td>
                                <td>
                                    ${t.status === 'active'
                                        ? '<span class="tl-badge tl-badge--active"><span class="tl-pulse"></span>Active</span>'
                                        : t.status === 'missing'
                                            ? '<span class="tl-badge tl-badge--missing">Missing</span>'
                                            : '<span class="tl-badge tl-badge--done">Completed</span>'
                                    }
                                </td>
                                <td>
                                    ${t.status !== 'completed'
                                        ? '<span class="tl-approve-na">—</span>'
                                        : t.approval_status === 'approved'
                                            ? '<span class="tl-badge tl-badge--approved">✓ Approved</span>'
                                            : `<button class="tl-approve-btn" data-id="${t.id}">Approve</button>`
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        content.querySelectorAll('.tl-approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Approve this trip and mark the student present for this lesson?')) return;
                btn.disabled = true;
                btn.textContent = 'Approving...';
                try {
                    const r = await window.api(`/api/admin/trip-logs/${btn.dataset.id}/approve`, { method: 'PATCH' });
                    if (!r.success) {
                        alert('Error: ' + (r.error || 'Failed to approve trip'));
                        btn.disabled = false;
                        btn.textContent = 'Approve';
                        return;
                    }
                    load();
                } catch (e) {
                    alert('Error: ' + e.message);
                    btn.disabled = false;
                    btn.textContent = 'Approve';
                }
            });
        });
    }

    document.getElementById('tlApply').addEventListener('click', load);
    document.getElementById('tlClear').addEventListener('click', () => {
        document.getElementById('tlDateFrom').value = monthAgo.toISOString().split('T')[0];
        document.getElementById('tlDateTo').value   = today.toISOString().split('T')[0];
        document.getElementById('tlInstructor').value = '';
        document.getElementById('tlStatus').value = '';
        load();
    });

    await load();
};
