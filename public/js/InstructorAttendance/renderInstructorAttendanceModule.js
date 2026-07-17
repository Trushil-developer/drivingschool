window.renderInstructorAttendanceModule = async function (tableWrap) {

    function fmtDT(str) {
        if (!str) return '—';
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        }).format(new Date(str));
    }

    function fmtDate(str) {
        if (!str) return '—';
        const [y, m, d] = str.split('-');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
    }

    function fmtDur(mins) {
        if (mins == null) return '—';
        const m = Math.round(Number(mins));
        if (m < 60) return `${m} min`;
        return `${Math.floor(m / 60)}h ${m % 60}m`;
    }

    function statusBadge(record) {
        if (!record.clock_out) {
            return `<span class="ia-badge ia-badge--active">Clocked In</span>`;
        }
        return `<span class="ia-badge ia-badge--done">Completed</span>`;
    }

    // ── 1. Load instructors for filter dropdown ────────────────────────────
    const resInst = await window.api('/api/instructors');
    const instructors = (resInst?.success ? resInst.instructors : [])
        .filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');

    // ── 2. Default date range: last 30 days ───────────────────────────────
    const toDate   = new Date();
    const fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 29);
    const pad = n => String(n).padStart(2, '0');
    const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // ── 3. Main layout ─────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="tl-wrap">
            <div class="tl-header">
                <h2 class="tl-title">Instructor Attendance</h2>
                <p class="tl-subtitle">Clock in / clock out records for all instructors</p>
            </div>

            <div class="tl-filters">
                <div class="tl-filter-group">
                    <label>From</label>
                    <input type="date" id="iaDateFrom" value="${isoDate(fromDate)}">
                </div>
                <div class="tl-filter-group">
                    <label>To</label>
                    <input type="date" id="iaDateTo" value="${isoDate(toDate)}">
                </div>
                <div class="tl-filter-group">
                    <label>Instructor</label>
                    <select id="iaInstructor">
                        <option value="">All Instructors</option>
                        ${instructors.map(i => `<option value="${i.id}">${i.instructor_name}</option>`).join('')}
                    </select>
                </div>
                <button class="tl-apply-btn" id="iaApply">Apply</button>
                <button class="tl-clear-btn" id="iaClear">Clear</button>
            </div>

            <div id="iaSummary" class="tl-summary"></div>
            <div id="iaContent"></div>
        </div>
    `;

    // ── 4. Fetch + render ──────────────────────────────────────────────────
    async function loadData() {
        const from       = document.getElementById('iaDateFrom')?.value || isoDate(fromDate);
        const to         = document.getElementById('iaDateTo')?.value   || isoDate(toDate);
        const instId     = document.getElementById('iaInstructor')?.value || '';
        const content    = document.getElementById('iaContent');
        const summaryEl  = document.getElementById('iaSummary');
        if (!content) return;

        content.innerHTML = `<div class="tl-loading"><span class="tl-spinner"></span> Loading…</div>`;

        const params = new URLSearchParams({ date_from: from, date_to: to });
        if (instId) params.set('instructor_id', instId);

        const res = await window.api(`/api/admin/instructor-attendance?${params}`);
        const records = res?.success ? (res.records || []) : [];

        // Summary strip
        const total     = records.length;
        const active    = records.filter(r => !r.clock_out).length;
        const completed = total - active;
        const totalMins = records
            .filter(r => r.clock_out)
            .reduce((s, r) => s + Number(r.duration_mins || 0), 0);
        const avgMins = completed > 0 ? Math.round(totalMins / completed) : 0;

        summaryEl.innerHTML = `
            <div class="tl-summary-card"><span class="tl-summary-num">${total}</span><span class="tl-summary-lbl">Total Records</span></div>
            <div class="tl-summary-card"><span class="tl-summary-num" style="color:#16a34a">${active}</span><span class="tl-summary-lbl">Currently In</span></div>
            <div class="tl-summary-card"><span class="tl-summary-num">${completed}</span><span class="tl-summary-lbl">Completed</span></div>
            <div class="tl-summary-card"><span class="tl-summary-num">${fmtDur(avgMins)}</span><span class="tl-summary-lbl">Avg Duration</span></div>
        `;

        if (records.length === 0) {
            content.innerHTML = `<div class="tl-empty"><p>No attendance records found for the selected range.</p></div>`;
            return;
        }

        content.innerHTML = `
            <div class="tl-table-wrap">
                <table class="tl-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Instructor</th>
                            <th>Clock In</th>
                            <th>Clock Out</th>
                            <th>Duration</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${fmtDate(r.date)}</td>
                                <td><strong>${r.instructor_name || '—'}</strong></td>
                                <td>${fmtDT(r.clock_in)}</td>
                                <td>${r.clock_out ? fmtDT(r.clock_out) : '<span style="color:#92400e;font-weight:600">Still in</span>'}</td>
                                <td>${fmtDur(r.duration_mins)}</td>
                                <td>${statusBadge(r)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // ── 5. Event listeners ─────────────────────────────────────────────────
    document.getElementById('iaApply')?.addEventListener('click', loadData);
    document.getElementById('iaClear')?.addEventListener('click', () => {
        document.getElementById('iaDateFrom').value = isoDate(fromDate);
        document.getElementById('iaDateTo').value   = isoDate(toDate);
        document.getElementById('iaInstructor').value = '';
        loadData();
    });

    await loadData();
};
