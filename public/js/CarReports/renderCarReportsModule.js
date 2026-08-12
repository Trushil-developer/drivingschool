window.renderCarReportsModule = async function (tableWrap) {

    function fmtDate(str) {
        if (!str) return '—';
        const d = new Date(str + 'T00:00:00');
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric'
        }).format(d);
    }

    function todayISO() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    // ── 1. Load cars, branches for filter dropdowns ──────────────────────────
    const [resCars, resBranches] = await Promise.all([
        window.api('/api/cars'),
        window.api('/api/branches'),
    ]);

    const cars     = resCars?.success     ? resCars.cars         : [];
    const branches = resBranches?.success ? resBranches.branches : [];

    // ── 2. Main layout ──────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="tl-wrap" style="padding: 0;">
            <div class="tl-header">
                <p class="tl-subtitle">Daily sessions and odometer readings per car</p>
            </div>

            <div class="tl-filters">
                <div class="tl-filter-group">
                    <label>From</label>
                    <input type="date" id="crDateFrom">
                </div>
                <div class="tl-filter-group">
                    <label>To</label>
                    <input type="date" id="crDateTo">
                </div>
                <div class="tl-filter-group">
                    <label>Car</label>
                    <select id="crCar">
                        <option value="">All Cars</option>
                        ${cars.map(c => `<option value="${c.car_name}">${c.car_name}</option>`).join('')}
                    </select>
                </div>
                <div class="tl-filter-group">
                    <label>Branch</label>
                    <select id="crBranch">
                        <option value="">All Branches</option>
                        ${branches.map(b => `<option value="${b.branch_name}">${b.branch_name}</option>`).join('')}
                    </select>
                </div>
                <button class="tl-apply-btn" id="crApply">Apply</button>
                <button class="tl-clear-btn" id="crClear">Clear</button>
            </div>

            <div id="crSummary" class="tl-summary"></div>
            <div id="crContent"></div>
        </div>
    `;

    // Default: today only
    const today = todayISO();
    document.getElementById('crDateFrom').value = today;
    document.getElementById('crDateTo').value   = today;

    async function load() {
        const content = document.getElementById('crContent');
        const summary = document.getElementById('crSummary');
        content.innerHTML = '<div class="loading-overlay">Loading...</div>';
        summary.innerHTML = '';

        const params = new URLSearchParams();
        const from   = document.getElementById('crDateFrom').value;
        const to     = document.getElementById('crDateTo').value;
        const car    = document.getElementById('crCar').value;
        const branch = document.getElementById('crBranch').value;
        if (from)   params.set('date_from', from);
        if (to)     params.set('date_to', to);
        if (car)    params.set('car_name', car);
        if (branch) params.set('branch', branch);

        const res = await window.api(`/api/admin/car-reports?${params}`);
        const reports = res?.success ? res.reports : [];

        // ── Summary cards ─────────────────────────────────────────────────
        const totalSessions = reports.reduce((s, r) => s + r.sessions, 0);
        const totalDistance = reports.reduce((s, r) => s + (r.distance || 0), 0);
        const uniqueCars = new Set(reports.map(r => r.car_name)).size;
        const uniqueDays = new Set(reports.map(r => r.date)).size;

        summary.innerHTML = `
            <div class="tl-stat-cards">
                <div class="tl-stat">
                    <span class="tl-stat-val">${reports.length}</span>
                    <span class="tl-stat-label">Car-Days</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${uniqueCars}</span>
                    <span class="tl-stat-label">Cars</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${totalSessions}</span>
                    <span class="tl-stat-label">Total Sessions</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${totalDistance.toLocaleString('en-IN')} km</span>
                    <span class="tl-stat-label">Total Distance (approx.)</span>
                </div>
                <div class="tl-stat">
                    <span class="tl-stat-val">${uniqueDays}</span>
                    <span class="tl-stat-label">Days Covered</span>
                </div>
            </div>
        `;

        // ── Table ─────────────────────────────────────────────────────────
        if (reports.length === 0) {
            content.innerHTML = '<div class="tl-empty">No car sessions found for the selected filters.</div>';
            return;
        }

        content.innerHTML = `
            <p class="tl-subtitle" style="margin: 0 0 10px;">
                "End Meter" is the highest odometer reading seen that day, and "Distance" is only
                shown on days with 2+ sessions — a single session has no later reading to compare against.
            </p>
            <div class="tl-table-wrap">
                <table class="tl-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Car</th>
                            <th>Branch</th>
                            <th>Sessions</th>
                            <th>Start Meter</th>
                            <th>End Meter</th>
                            <th>Distance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.map((r, i) => `
                            <tr>
                                <td class="tl-num">${i + 1}</td>
                                <td class="tl-time">${fmtDate(r.date)}</td>
                                <td class="tl-car">${r.car_name || '—'}</td>
                                <td class="tl-branch">${r.branch || '—'}</td>
                                <td>${r.sessions}</td>
                                <td class="tl-odometer">${r.start_odometer ?? '—'}</td>
                                <td class="tl-odometer">${r.end_odometer ?? '—'}</td>
                                <td>${r.distance !== null ? `${r.distance.toLocaleString('en-IN')} km` : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    document.getElementById('crApply').addEventListener('click', load);
    document.getElementById('crClear').addEventListener('click', () => {
        document.getElementById('crDateFrom').value = today;
        document.getElementById('crDateTo').value   = today;
        document.getElementById('crCar').value      = '';
        document.getElementById('crBranch').value   = '';
        load();
    });

    await load();
};
