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
        if (trip.status === 'missing' || trip.status === 'absent') return '—';
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

    function todayISO() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    // ── 1. Load instructors, cars, branches for filter dropdowns ────────────
    const [resInst, resCars, resBranches] = await Promise.all([
        window.api('/api/instructors'),
        window.api('/api/cars'),
        window.api('/api/branches'),
    ]);

    const instructors = (resInst?.success ? resInst.instructors : [])
        .filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');
    const cars     = resCars?.success     ? resCars.cars         : [];
    const branches = resBranches?.success ? resBranches.branches : [];

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
                    <label>Car</label>
                    <select id="tlCar">
                        <option value="">All Cars</option>
                        ${cars.map(c => `<option value="${c.car_name}">${c.car_name}</option>`).join('')}
                    </select>
                </div>
                <div class="tl-filter-group">
                    <label>Branch</label>
                    <select id="tlBranch">
                        <option value="">All Branches</option>
                        ${branches.map(b => `<option value="${b.branch_name}">${b.branch_name}</option>`).join('')}
                    </select>
                </div>
                <div class="tl-filter-group">
                    <label>Status</label>
                    <select id="tlStatus">
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="missing">Missing</option>
                        <option value="absent">Absent</option>
                    </select>
                </div>
                <button class="tl-apply-btn" id="tlApply">Apply</button>
                <button class="tl-clear-btn" id="tlClear">Clear</button>
            </div>

            <div id="tlSummary" class="tl-summary"></div>
            <div id="tlContent"></div>
        </div>
    `;

    // Default: today only
    const today = todayISO();
    document.getElementById('tlDateFrom').value = today;
    document.getElementById('tlDateTo').value   = today;

    async function load() {
        const content = document.getElementById('tlContent');
        const summary = document.getElementById('tlSummary');
        content.innerHTML = '<div class="loading-overlay">Loading...</div>';
        summary.innerHTML = '';

        const params = new URLSearchParams();
        const from   = document.getElementById('tlDateFrom').value;
        const to     = document.getElementById('tlDateTo').value;
        const inst   = document.getElementById('tlInstructor').value;
        const car    = document.getElementById('tlCar').value;
        const branch = document.getElementById('tlBranch').value;
        const stat   = document.getElementById('tlStatus').value;
        if (from)   params.set('date_from', from);
        if (to)     params.set('date_to', to);
        if (inst)   params.set('instructor_id', inst);
        if (car)    params.set('car_name', car);
        if (branch) params.set('branch', branch);
        if (stat)   params.set('status', stat);

        const res = await window.api(`/api/admin/trip-logs?${params}`);
        const trips = res?.success ? res.trips : [];

        // ── Summary cards ─────────────────────────────────────────────────
        const completed = trips.filter(t => t.status === 'completed');
        const active    = trips.filter(t => t.status === 'active');
        const missing   = trips.filter(t => t.status === 'missing');
        const absent    = trips.filter(t => t.status === 'absent');
        const pendingAbsent = absent.filter(t => t.approval_status !== 'approved');
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
                    <span class="tl-stat-val">${trips.length - missing.length - absent.length}</span>
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
                <div class="tl-stat tl-stat--missing">
                    <span class="tl-stat-val">${pendingAbsent.length}</span>
                    <span class="tl-stat-label">Pending Absences</span>
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
                            <th>Car</th>
                            <th>Student</th>
                            <th>Start Meter</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trips.map((t, i) => `
                            <tr>
                                <td class="tl-num">${i + 1}</td>
                                <td class="tl-name">${t.instructor_name || '—'}</td>
                                <td class="tl-branch">${t.branch || '—'}</td>
                                <td class="tl-car">${t.car_name || '—'}</td>
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
                                            : t.status === 'absent'
                                                ? '<span class="tl-badge tl-badge--missing">Absent</span>'
                                                : '<span class="tl-badge tl-badge--done">Completed</span>'
                                    }
                                </td>
                                <td>
                                    ${t.status === 'active'
                                        ? '<span class="tl-approve-na">—</span>'
                                        : t.status === 'missing'
                                            ? `<button class="tl-approve-btn tl-action-present" data-id="${t.id}" data-status="missing" data-value="1">Present</button>
                                               <button class="tl-approve-btn tl-action-absent" data-id="${t.id}" data-status="missing" data-value="0">Absent</button>`
                                            : t.approval_status === 'approved'
                                                ? '<span class="tl-badge tl-badge--approved">✓ Approved</span>'
                                                : t.approval_status === 'rejected'
                                                    ? '<span class="tl-badge tl-badge--rejected">✕ Rejected</span>'
                                                    : t.status === 'completed'
                                                        ? `<button class="tl-approve-btn" data-id="${t.id}" data-status="${t.status}">Approve</button>
                                                           <button class="tl-reject-btn" data-id="${t.id}">Reject</button>`
                                                        : `<button class="tl-approve-btn" data-id="${t.id}" data-status="${t.status}">Approve</button>`
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
                const isMissing = btn.dataset.status === 'missing';
                const label = btn.textContent;
                const confirmMsg = isMissing
                    ? `Mark this student ${btn.dataset.value === '1' ? 'present' : 'absent'} for this lesson?`
                    : btn.dataset.status === 'absent'
                        ? 'Confirm this absence for the student?'
                        : 'Approve this trip and mark the student present for this lesson?';
                if (!confirm(confirmMsg)) return;

                const rowBtns = content.querySelectorAll(
                    `.tl-approve-btn[data-id="${btn.dataset.id}"], .tl-reject-btn[data-id="${btn.dataset.id}"]`
                );
                rowBtns.forEach(b => { b.disabled = true; });
                btn.textContent = isMissing ? 'Saving...' : 'Approving...';
                try {
                    const r = await window.api(`/api/admin/trip-logs/${btn.dataset.id}/approve`, {
                        method: 'PATCH',
                        ...(isMissing ? {
                            body: JSON.stringify({ value: Number(btn.dataset.value) }),
                            headers: { 'Content-Type': 'application/json' },
                        } : {}),
                    });
                    if (!r.success) {
                        alert('Error: ' + (r.error || 'Failed to save'));
                        rowBtns.forEach(b => { b.disabled = false; });
                        btn.textContent = label;
                        return;
                    }
                    load();
                } catch (e) {
                    alert('Error: ' + e.message);
                    rowBtns.forEach(b => { b.disabled = false; });
                    btn.textContent = label;
                }
            });
        });

        content.querySelectorAll('.tl-reject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Reject this trip and mark the student absent for this lesson?')) return;
                const rowBtns = content.querySelectorAll(
                    `.tl-approve-btn[data-id="${btn.dataset.id}"], .tl-reject-btn[data-id="${btn.dataset.id}"]`
                );
                rowBtns.forEach(b => { b.disabled = true; });
                btn.textContent = 'Rejecting...';
                try {
                    const r = await window.api(`/api/admin/trip-logs/${btn.dataset.id}/reject`, { method: 'PATCH' });
                    if (!r.success) {
                        alert('Error: ' + (r.error || 'Failed to reject trip'));
                        rowBtns.forEach(b => { b.disabled = false; });
                        btn.textContent = 'Reject';
                        return;
                    }
                    load();
                } catch (e) {
                    alert('Error: ' + e.message);
                    rowBtns.forEach(b => { b.disabled = false; });
                    btn.textContent = 'Reject';
                }
            });
        });
    }

    document.getElementById('tlApply').addEventListener('click', load);
    document.getElementById('tlClear').addEventListener('click', () => {
        document.getElementById('tlDateFrom').value    = today;
        document.getElementById('tlDateTo').value      = today;
        document.getElementById('tlInstructor').value  = '';
        document.getElementById('tlCar').value         = '';
        document.getElementById('tlBranch').value      = '';
        document.getElementById('tlStatus').value      = '';
        load();
    });

    await load();
};
