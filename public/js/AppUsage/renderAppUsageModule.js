window.renderAppUsageModule = async function (tableWrap) {

    function fmtDT(str) {
        if (!str) return '—';
        const d = new Date(str);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        }).format(d);
    }

    tableWrap.innerHTML = `
        <div class="tl-wrap">
            <div class="tl-header">
                <h2 class="tl-title">App Usage</h2>
                <p class="tl-subtitle">How many active students are actually opening the Book My Drive app, and how recently</p>
            </div>
            <div id="auSummary" class="tl-summary"></div>
            <div id="auContent"></div>
        </div>
    `;

    const summary = document.getElementById('auSummary');
    const content = document.getElementById('auContent');
    content.innerHTML = '<div class="loading-overlay">Loading...</div>';

    const res = await window.api('/api/admin/app-usage');
    if (!res?.success) {
        content.innerHTML = '<div class="tl-empty">Could not load app usage data.</div>';
        return;
    }

    const { summary: s, students } = res;
    const adoptionPct = s.eligibleActiveStudents > 0
        ? Math.round((s.everOpenedApp / s.eligibleActiveStudents) * 100)
        : 0;

    summary.innerHTML = `
        <div class="tl-stat-cards">
            <div class="tl-stat tl-stat--active">
                <span class="tl-stat-val">${s.activeToday}</span>
                <span class="tl-stat-label">Opened App Today</span>
            </div>
            <div class="tl-stat">
                <span class="tl-stat-val">${s.activeLast7Days}</span>
                <span class="tl-stat-label">Opened App in Last 7 Days</span>
            </div>
            <div class="tl-stat">
                <span class="tl-stat-val">${s.activeLast30Days}</span>
                <span class="tl-stat-label">Opened App in Last 30 Days</span>
            </div>
            <div class="tl-stat">
                <span class="tl-stat-val">${s.everOpenedApp}</span>
                <span class="tl-stat-label">Have Ever Opened the App</span>
            </div>
            <div class="tl-stat">
                <span class="tl-stat-val">${adoptionPct}%</span>
                <span class="tl-stat-label">of Active Students (${s.eligibleActiveStudents})</span>
            </div>
        </div>
        <p style="font-size:0.8rem;color:#6b7280;margin:-4px 0 16px;">
            Based on actual app opens (not just the one-time login) — installs alone still aren't tracked here
            (check Google Play Console / App Store Connect for install counts).
        </p>
    `;

    if (!students.length) {
        content.innerHTML = '<div class="tl-empty">No app activity recorded yet.</div>';
        return;
    }

    content.innerHTML = `
        <div class="tl-table-wrap">
            <table class="tl-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>Booking ID</th>
                        <th>Email</th>
                        <th>First Opened</th>
                        <th>Last Active</th>
                        <th>Days Active</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map((st, i) => `
                        <tr>
                            <td class="tl-num">${i + 1}</td>
                            <td class="tl-name">${st.customer_name || '—'}</td>
                            <td>${st.booking_id}</td>
                            <td>${st.email || '—'}</td>
                            <td class="tl-time">${fmtDT(st.first_seen_at)}</td>
                            <td class="tl-time">${fmtDT(st.last_seen_at)}</td>
                            <td>${st.days_active}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};
