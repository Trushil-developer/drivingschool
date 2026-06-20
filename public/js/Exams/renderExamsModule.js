// Store chart instances for cleanup
let examChartInstances = {};
let allUsers = [];
let allAttempts = [];
let allQuestions = [];
let questionCategories = [];
let allPracticeProgress = [];
let practiceByUser = {}; // keyed by user_id

export function renderExamsModule(container) {
    return async function renderExams() {
        // Destroy existing charts
        Object.values(examChartInstances).forEach(chart => chart?.destroy());
        examChartInstances = {};

        container.innerHTML = `
            <div class="exams-module">
                <div class="exams-tabs">
                    <button class="tab-btn active" data-tab="overview">Overview</button>
                    <button class="tab-btn" data-tab="users">Students</button>
                    <button class="tab-btn" data-tab="attempts">Exam History</button>
                    <button class="tab-btn" data-tab="practiceLogs">Practice Logs</button>
                    <button class="tab-btn" data-tab="questions">Question Bank</button>
                </div>

                <div class="exams-content">
                    <div id="examOverview"      class="tab-content active"></div>
                    <div id="examUsers"         class="tab-content hidden"></div>
                    <div id="examAttempts"      class="tab-content hidden"></div>
                    <div id="examPracticeLogs"  class="tab-content hidden"></div>
                    <div id="examQuestions"     class="tab-content hidden"></div>
                </div>
            </div>
        `;

        const tabBtns = container.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                container.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                const tabId = btn.dataset.tab;
                const panelId = `exam${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`;
                document.getElementById(panelId).classList.remove('hidden');

                if (tabId === 'users')           loadUsers();
                else if (tabId === 'attempts')   loadAttempts();
                else if (tabId === 'practiceLogs') loadPracticeLogs();
                else if (tabId === 'questions')  loadQuestions();
            });
        });

        await loadOverview();
    };
}

// ─────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────
async function loadOverview() {
    const container = document.getElementById('examOverview');
    container.innerHTML = '<div class="loading">Loading…</div>';

    try {
        const [overviewRes, scoreDistRes, usersRes, practiceRes] = await Promise.all([
            window.api('/api/exam/admin/overview'),
            window.api('/api/exam/admin/score-distribution'),
            window.api('/api/exam/admin/users'),
            window.api('/api/exam/admin/practice-progress')
        ]);

        if (!overviewRes.success) throw new Error('Failed to load overview');

        const { stats, practiceStats, recentActivity } = overviewRes;
        const scoreDistribution = scoreDistRes.success ? scoreDistRes.distribution : [];
        const users  = usersRes.success  ? usersRes.users : [];
        const pRaw   = practiceRes.success ? practiceRes.progress : [];

        // Compute funnel
        const totalRegistered = stats.totalUsers;
        const practicedUsers  = new Set(pRaw.map(p => p.user_id)).size;
        const attemptedUsers  = users.filter(u => u.total_attempts > 0).length;
        const passedUsers     = users.filter(u => u.last_result === 'PASS').length;

        // Status breakdown
        const struggling   = users.filter(u => u.total_attempts >= 3 && u.last_result !== 'PASS').length;
        const neverStarted = users.filter(u => u.total_attempts === 0).length;

        // Practice stats
        const ps = practiceStats || {};
        const totalAnswered    = ps.totalAnswers    || 0;
        const totalCorrect     = ps.correctAnswers  || 0;
        const overallAccuracy  = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        const avgPerStudent    = practicedUsers > 0 ? Math.round(totalAnswered / practicedUsers) : 0;

        // Per-category breakdown (aggregated across all users, sorted worst first)
        const catMap = {};
        pRaw.forEach(p => {
            if (!catMap[p.category]) catMap[p.category] = { answered: 0, correct: 0 };
            catMap[p.category].answered += Number(p.answered) || 0;
            catMap[p.category].correct  += Number(p.correct)  || 0;
        });
        const catStats = Object.entries(catMap)
            .map(([cat, d]) => ({
                cat,
                answered: d.answered,
                accuracy: d.answered > 0 ? Math.round((d.correct / d.answered) * 100) : 0
            }))
            .sort((a, b) => a.accuracy - b.accuracy); // worst first

        container.innerHTML = `
            <!-- Funnel -->
            <div class="ov-section-label">Student Journey</div>
            <div class="ov-funnel">
                ${funnelStep('Registered', totalRegistered, '#3b82f6', '👤')}
                <div class="ov-funnel-arrow">→</div>
                ${funnelStep('Practiced', practicedUsers, '#8b5cf6', '📚', totalRegistered)}
                <div class="ov-funnel-arrow">→</div>
                ${funnelStep('Attempted Exam', attemptedUsers, '#f59e0b', '✏️', totalRegistered)}
                <div class="ov-funnel-arrow">→</div>
                ${funnelStep('Passed', passedUsers, '#10b981', '✅', totalRegistered)}
            </div>

            <!-- Practice Progress -->
            <div class="ov-section-label" style="margin-top:24px;">Practice Progress</div>
            <div class="ov-practice-panel">
                <div class="ov-practice-stats">
                    <div class="ov-ps-item">
                        <span class="ov-ps-val">${totalAnswered.toLocaleString()}</span>
                        <span class="ov-ps-label">Questions Answered</span>
                    </div>
                    <div class="ov-ps-item">
                        <span class="ov-ps-val" style="color:${overallAccuracy >= 70 ? '#10b981' : overallAccuracy >= 50 ? '#f59e0b' : '#ef4444'};">${overallAccuracy}%</span>
                        <span class="ov-ps-label">Overall Accuracy</span>
                    </div>
                    <div class="ov-ps-item">
                        <span class="ov-ps-val">${avgPerStudent}</span>
                        <span class="ov-ps-label">Avg per Student</span>
                    </div>
                    <div class="ov-ps-item">
                        <span class="ov-ps-val">${practicedUsers}</span>
                        <span class="ov-ps-label">Students Practiced</span>
                    </div>
                </div>
                ${catStats.length > 0 ? `
                <div class="ov-cat-header">
                    <span>Category</span>
                    <span>Accuracy &amp; Volume</span>
                </div>
                <div class="ov-cat-list">
                    ${catStats.map(c => {
                        const barColor = c.accuracy >= 70 ? '#10b981' : c.accuracy >= 50 ? '#f59e0b' : '#ef4444';
                        const label = c.accuracy < 50 ? ' ⚠ Weak' : '';
                        return `
                        <div class="ov-cat-row">
                            <div class="ov-cat-name">${c.cat}${label ? `<span class="ov-cat-weak">${label}</span>` : ''}</div>
                            <div class="ov-cat-bar-bg">
                                <div class="ov-cat-bar" style="width:${c.accuracy}%; background:${barColor};"></div>
                            </div>
                            <div class="ov-cat-meta">${c.accuracy}% · ${c.answered.toLocaleString()} q</div>
                        </div>`;
                    }).join('')}
                </div>` : '<div class="ov-practice-empty">No practice activity yet</div>'}
            </div>

            <!-- Key stats row -->
            <div class="ov-section-label" style="margin-top:24px;">Exam Performance</div>
            <div class="exam-stats-cards">
                <div class="stat-card">
                    <h4>Pass Rate</h4>
                    <p class="stat-value">${stats.passRate}%</p>
                    <p class="stat-sub">${stats.passed} passed / ${stats.totalAttempts} attempts</p>
                </div>
                <div class="stat-card">
                    <h4>Avg Score</h4>
                    <p class="stat-value">${stats.avgScore}%</p>
                    <p class="stat-sub">across all completed exams</p>
                </div>
                <div class="stat-card danger">
                    <h4>Struggling</h4>
                    <p class="stat-value">${struggling}</p>
                    <p class="stat-sub">3+ attempts, not yet passed</p>
                </div>
                <div class="stat-card">
                    <h4>Never Started</h4>
                    <p class="stat-value">${neverStarted}</p>
                    <p class="stat-sub">registered but 0 attempts</p>
                </div>
            </div>

            <!-- Charts -->
            <div class="exam-charts" style="margin-top:8px;">
                <div class="chart-section">
                    <h3>Pass / Fail</h3>
                    <canvas id="passFailChart"></canvas>
                </div>
                <div class="chart-section">
                    <h3>Score Distribution</h3>
                    <canvas id="scoreDistChart"></canvas>
                </div>
            </div>

            <div class="exam-charts">
                <div class="chart-section chart-section-wide">
                    <h3>Exam Activity – Last 30 Days</h3>
                    <canvas id="activityChart"></canvas>
                </div>
            </div>
        `;

        // Charts
        renderPassFailChart(stats);
        renderScoreDistChart(scoreDistribution);
        renderActivityChart(recentActivity);

    } catch (err) {
        console.error('Exam overview error:', err);
        container.innerHTML = '<div class="error">Failed to load overview</div>';
    }
}

function funnelStep(label, count, color, icon, total = null) {
    const pct = total ? Math.round((count / total) * 100) : 100;
    return `
        <div class="ov-funnel-step">
            <div class="ov-funnel-icon" style="background:${color}20; color:${color};">${icon}</div>
            <div class="ov-funnel-count" style="color:${color};">${count}</div>
            <div class="ov-funnel-label">${label}</div>
            ${total ? `<div class="ov-funnel-pct">${pct}%</div>` : ''}
        </div>
    `;
}

function renderPassFailChart(stats) {
    const ctx = document.getElementById('passFailChart')?.getContext('2d');
    if (!ctx) return;
    examChartInstances.passFail = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: ['Passed', 'Failed'],
            datasets: [{ data: [stats.passed, stats.failed], backgroundColor: ['#10b981','#ef4444'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                datalabels: { color:'#fff', font:{ weight:'bold', size:14 }, formatter: v => v > 0 ? v : '' }
            }
        }
    });
}

function renderScoreDistChart(scoreDistribution) {
    const ctx = document.getElementById('scoreDistChart')?.getContext('2d');
    if (!ctx || !scoreDistribution.length) return;
    examChartInstances.scoreDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: scoreDistribution.map(d => d.score_range),
            datasets: [{
                label: 'Count',
                data: scoreDistribution.map(d => d.count),
                backgroundColor: scoreDistribution.map(d =>
                    ['0-4','5-6','7-8'].includes(d.score_range) ? '#ef4444' : '#10b981'
                ),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend:{ display:false }, datalabels:{ color:'#fff', font:{weight:'bold',size:12}, formatter: v => v>0?v:'' } },
            scales: { y:{ beginAtZero:true, ticks:{ stepSize:1 } } }
        }
    });
}

function renderActivityChart(recentActivity) {
    const ctx = document.getElementById('activityChart')?.getContext('2d');
    if (!ctx || !recentActivity.length) return;
    examChartInstances.activity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recentActivity.map(d => new Date(d.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})),
            datasets: [{
                label: 'Attempts', data: recentActivity.map(d => d.attempts),
                borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.1)', fill:true, tension:0.3
            }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false} },
            scales:{ y:{ beginAtZero:true, ticks:{stepSize:1} } }
        }
    });
}

// ─────────────────────────────────────────────
// STUDENTS TAB
// ─────────────────────────────────────────────
async function loadUsers() {
    const container = document.getElementById('examUsers');
    container.innerHTML = '<div class="loading">Loading…</div>';

    try {
        const [usersRes, practiceRes] = await Promise.all([
            window.api('/api/exam/admin/users'),
            window.api('/api/exam/admin/practice-progress')
        ]);
        if (!usersRes.success) throw new Error('Failed to load users');

        allUsers = usersRes.users;

        // Build practice map keyed by user_id
        practiceByUser = {};
        (practiceRes.progress || []).forEach(p => {
            if (!practiceByUser[p.user_id]) practiceByUser[p.user_id] = { answered: 0, correct: 0 };
            practiceByUser[p.user_id].answered += Number(p.answered) || 0;
            practiceByUser[p.user_id].correct  += Number(p.correct)  || 0;
        });

        if (!allUsers.length) {
            container.innerHTML = '<div class="empty">No exam students yet</div>';
            return;
        }

        renderUsersTable(container, sortUsers(allUsers));

    } catch (err) {
        console.error('Exam users error:', err);
        container.innerHTML = '<div class="error">Failed to load students</div>';
    }
}

// Sort: Struggling → Active → Passed → Not Started
function sortUsers(users) {
    const rank = u => {
        if (u.total_attempts >= 3 && u.last_result !== 'PASS') return 0; // struggling
        if (u.total_attempts > 0  && u.last_result !== 'PASS') return 1; // active/failing
        if (u.last_result === 'PASS') return 2;                           // passed
        return 3;                                                          // not started
    };
    return [...users].sort((a, b) => rank(a) - rank(b));
}

function userStatus(u) {
    if (u.last_result === 'PASS')                               return { label:'Passed',      cls:'us-passed',    sort:2 };
    if (u.total_attempts >= 3 && u.last_result !== 'PASS')     return { label:'Struggling',   cls:'us-struggling',sort:0 };
    if (u.total_attempts > 0)                                   return { label:'Attempting',   cls:'us-active',    sort:1 };
    return                                                             { label:'Not Started',  cls:'us-new',       sort:3 };
}

function renderUsersTable(container, users) {
    // Build summary counts
    const counts = { passed:0, struggling:0, active:0, new:0 };
    users.forEach(u => {
        const s = userStatus(u);
        if (s.cls === 'us-passed')      counts.passed++;
        else if (s.cls === 'us-struggling') counts.struggling++;
        else if (s.cls === 'us-active') counts.active++;
        else counts.new++;
    });

    container.innerHTML = `
        <div class="us-summary-bar">
            <span class="us-pill us-passed">${counts.passed} Passed</span>
            <span class="us-pill us-struggling">${counts.struggling} Struggling</span>
            <span class="us-pill us-active">${counts.active} Attempting</span>
            <span class="us-pill us-new">${counts.new} Not Started</span>
        </div>
        <div class="exam-toolbar">
            <div class="search-box">
                <input type="text" id="userSearch" placeholder="Search by email…" class="search-input">
            </div>
            <div class="filter-box">
                <select id="userStatusFilter" class="filter-select">
                    <option value="">All Students</option>
                    <option value="passed">Passed</option>
                    <option value="struggling">Struggling (3+ fails)</option>
                    <option value="active">Attempting</option>
                    <option value="new">Not Started</option>
                </select>
            </div>
        </div>
        <div class="exam-table-wrap">
            <table class="exam-table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Best Score</th>
                        <th>Practice</th>
                        <th>Last Seen</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
                    ${renderUserRows(users)}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('userSearch')?.addEventListener('input',  filterUsers);
    document.getElementById('userStatusFilter')?.addEventListener('change', filterUsers);
    attachUserActions(container);
}

function renderUserRows(users) {
    return users.map(u => {
        const st  = userStatus(u);
        const prac = practiceByUser[u.id] || { answered:0, correct:0 };
        const accuracy = prac.answered > 0 ? Math.round((prac.correct / prac.answered) * 100) : 0;

        // Score bar width (best_score is already %)
        const scoreW = u.best_score || 0;
        const scoreColor = scoreW >= 80 ? '#10b981' : scoreW >= 60 ? '#f59e0b' : '#ef4444';

        const practiceHtml = prac.answered > 0
            ? `<div class="us-practice-wrap">
                   <div class="us-practice-bar-bg">
                       <div class="us-practice-bar" style="width:${accuracy}%; background:${accuracy>=70?'#10b981':'#f59e0b'};"></div>
                   </div>
                   <span class="us-practice-label">${prac.answered} q · ${accuracy}%</span>
               </div>`
            : `<span style="color:#94a3b8; font-size:12px;">Not started</span>`;

        return `
            <tr data-user-id="${u.id}" data-status="${st.cls}">
                <td class="us-email-cell">
                    <span class="us-email">${u.email}</span>
                    <span class="us-since">since ${formatDate(u.first_verified_at)}</span>
                </td>
                <td><span class="us-badge ${st.cls}">${st.label}</span></td>
                <td>
                    <span class="us-attempts-num">${u.total_attempts}</span>
                    ${u.total_attempts > 0 ? `<div class="us-score-bar-bg"><div class="us-score-bar" style="width:${scoreW}%; background:${scoreColor};"></div></div>
                    <span class="us-score-label">${u.best_score}%</span>` : ''}
                </td>
                <td>${u.best_score > 0 ? `<strong style="color:${scoreColor};">${u.best_score}%</strong>` : '<span style="color:#94a3b8;">—</span>'}</td>
                <td>${practiceHtml}</td>
                <td style="color:#64748b; font-size:12px;">${formatDate(u.last_seen_at)}</td>
                <td class="action-btns">
                    <button class="btn btn-sm view-attempts" data-user-id="${u.id}" data-email="${u.email}">History</button>
                    <button class="btn btn-sm btn-danger delete-user" data-user-id="${u.id}" data-email="${u.email}">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsers() {
    const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('userStatusFilter')?.value || '';

    const statusMap = { passed:'us-passed', struggling:'us-struggling', active:'us-active', new:'us-new' };
    const wantedCls = statusMap[statusFilter] || '';

    const filtered = sortUsers(allUsers).filter(u => {
        const st = userStatus(u);
        const matchSearch = u.email.toLowerCase().includes(search);
        const matchStatus = !wantedCls || st.cls === wantedCls;
        return matchSearch && matchStatus;
    });

    document.getElementById('usersTableBody').innerHTML = renderUserRows(filtered);
    attachUserActions(document.getElementById('examUsers'));
}

function attachUserActions(container) {
    container.querySelectorAll('.view-attempts').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.userId;
            const email  = btn.dataset.email;
            loadAttempts(userId, email);
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="attempts"]').classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('examAttempts').classList.remove('hidden');
        });
    });

    container.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const email  = btn.dataset.email;
            if (!confirm(`Delete ${email} and all their data? This cannot be undone.`)) return;
            try {
                const res = await window.api(`/api/exam/admin/users/${userId}`, { method:'DELETE' });
                if (res.success) { alert('Deleted'); loadUsers(); }
                else alert('Failed to delete');
            } catch (err) { alert('Failed to delete'); }
        });
    });
}

// ─────────────────────────────────────────────
// EXAM HISTORY TAB
// ─────────────────────────────────────────────
async function loadAttempts(userId = null, userEmail = null) {
    const container = document.getElementById('examAttempts');
    container.innerHTML = '<div class="loading">Loading…</div>';

    try {
        const url = userId ? `/api/exam/admin/attempts?user_id=${userId}` : '/api/exam/admin/attempts';
        const res = await window.api(url);
        if (!res.success) throw new Error('Failed to load attempts');

        allAttempts = res.attempts;
        const headerText = userEmail ? `Exam History · ${userEmail}` : 'All Exam Attempts';
        const clearFilter = userId ? `<button class="btn btn-sm clear-filter">Show All</button>` : '';

        if (!res.attempts.length) {
            container.innerHTML = `
                <div class="attempts-header"><h3>${headerText}</h3>${clearFilter}</div>
                <div class="empty">No attempts found</div>`;
            return;
        }

        container.innerHTML = `
            <div class="attempts-header">
                <h3>${headerText}</h3>
                <div class="header-actions">
                    ${clearFilter}
                    <button class="btn btn-sm btn-primary export-csv">Export CSV</button>
                </div>
            </div>
            <div class="exam-toolbar">
                <div class="search-box">
                    <input type="text" id="attemptSearch" placeholder="Search by email…" class="search-input">
                </div>
                <div class="filter-box">
                    <select id="attemptResultFilter" class="filter-select">
                        <option value="">All Results</option>
                        <option value="PASS">Passed</option>
                        <option value="FAIL">Failed</option>
                    </select>
                    <select id="attemptStatusFilter" class="filter-select">
                        <option value="">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="started">In Progress</option>
                    </select>
                </div>
            </div>
            <div class="exam-table-wrap">
                <table class="exam-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student</th>
                            <th>Mode</th>
                            <th>Score</th>
                            <th>Questions</th>
                            <th>Result</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="attemptsTableBody">${renderAttemptRows(allAttempts)}</tbody>
                </table>
            </div>
        `;

        container.querySelector('.clear-filter')?.addEventListener('click', () => loadAttempts());
        container.querySelector('.export-csv')?.addEventListener('click', () => {
            window.location.href = '/api/exam/admin/attempts/export';
        });
        document.getElementById('attemptSearch')?.addEventListener('input', filterAttempts);
        document.getElementById('attemptResultFilter')?.addEventListener('change', filterAttempts);
        document.getElementById('attemptStatusFilter')?.addEventListener('change', filterAttempts);

    } catch (err) {
        container.innerHTML = '<div class="error">Failed to load attempts</div>';
    }
}

function renderAttemptRows(attempts) {
    return attempts.map(a => {
        const scoreW = a.score || 0;
        const scoreColor = scoreW >= 80 ? '#10b981' : scoreW >= 60 ? '#f59e0b' : '#ef4444';
        return `
            <tr>
                <td style="color:#94a3b8;">${a.id}</td>
                <td style="font-size:13px;">${a.email}</td>
                <td><span class="mode-badge mode-${a.mode}">${a.mode || '—'}</span></td>
                <td>
                    ${a.score !== null
                        ? `<strong style="color:${scoreColor};">${a.score}%</strong>`
                        : '<span style="color:#94a3b8;">—</span>'}
                </td>
                <td>${a.correct_answers || 0}/${a.total_questions || '—'}</td>
                <td class="${a.result === 'PASS' ? 'status-pass' : a.result === 'FAIL' ? 'status-fail' : ''}">${a.result || '—'}</td>
                <td style="font-size:12px; color:#64748b;">${formatDateTime(a.started_at)}</td>
                <td class="status-${a.status}">${a.status}</td>
            </tr>
        `;
    }).join('');
}

function filterAttempts() {
    const search       = document.getElementById('attemptSearch')?.value.toLowerCase() || '';
    const resultFilter = document.getElementById('attemptResultFilter')?.value || '';
    const statusFilter = document.getElementById('attemptStatusFilter')?.value || '';

    const filtered = allAttempts.filter(a =>
        a.email.toLowerCase().includes(search) &&
        (!resultFilter || a.result === resultFilter) &&
        (!statusFilter || a.status === statusFilter)
    );
    document.getElementById('attemptsTableBody').innerHTML = renderAttemptRows(filtered);
}

// ─────────────────────────────────────────────
// QUESTION BANK TAB
// ─────────────────────────────────────────────
async function loadQuestions() {
    const container = document.getElementById('examQuestions');
    container.innerHTML = '<div class="loading">Loading…</div>';
    try {
        const res = await window.api('/api/exam/admin/questions?lang=en');
        if (!res.success) throw new Error();
        allQuestions     = res.questions;
        questionCategories = res.categories;
        renderQuestionsView(container);
    } catch (err) {
        container.innerHTML = '<div class="error">Failed to load questions</div>';
    }
}

function renderQuestionsView(container) {
    container.innerHTML = `
        <div class="questions-header">
            <h3>Question Bank (${allQuestions.length} questions)</h3>
            <div class="header-actions">
                <select id="questionLangSelect" class="filter-select">
                    <option value="en">English</option>
                    <option value="gu">Gujarati</option>
                </select>
                <button class="btn btn-sm btn-primary add-question">+ Add Question</button>
            </div>
        </div>
        <div class="exam-toolbar">
            <div class="search-box">
                <input type="text" id="questionSearch" placeholder="Search questions…" class="search-input">
            </div>
            <div class="filter-box">
                <select id="questionCategoryFilter" class="filter-select">
                    <option value="">All Categories</option>
                    ${questionCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="category-stats">
            ${questionCategories.map(cat => {
                const count = allQuestions.filter(q => q.CATEGORY === cat).length;
                return `<span class="category-badge">${cat}: ${count}</span>`;
            }).join('')}
        </div>
        <div class="questions-list" id="questionsList">${renderQuestionCards(allQuestions)}</div>

        <div id="questionModal" class="modal hidden">
            <div class="modal-content question-modal">
                <div class="modal-header">
                    <h3 id="questionModalTitle">Add Question</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="questionForm">
                        <input type="hidden" id="qNumber">
                        <div class="form-group">
                            <label>Category</label>
                            <select id="qCategory" required>
                                ${questionCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
                                <option value="__new__">+ New Category</option>
                            </select>
                            <input type="text" id="qNewCategory" placeholder="New category name" class="hidden">
                        </div>
                        <div class="form-group"><label>Question</label><textarea id="qQuestion" rows="3" required></textarea></div>
                        <div class="form-group"><label>Option 1</label><input type="text" id="qOption1" required></div>
                        <div class="form-group"><label>Option 2</label><input type="text" id="qOption2" required></div>
                        <div class="form-group"><label>Option 3</label><input type="text" id="qOption3" required></div>
                        <div class="form-group">
                            <label>Correct Answer</label>
                            <select id="qAnswer" required>
                                <option value="1">Option 1</option>
                                <option value="2">Option 2</option>
                                <option value="3">Option 3</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Image Filename (optional)</label>
                            <input type="text" id="qImage" placeholder="e.g., q123.jpg">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancel</button>
                    <button class="btn btn-primary save-question">Save Question</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('questionLangSelect')?.addEventListener('change', async e => {
        const lang = e.target.value;
        const res = await window.api(`/api/exam/admin/questions?lang=${lang}`);
        if (res.success) { allQuestions = res.questions; questionCategories = res.categories; renderQuestionsView(container); document.getElementById('questionLangSelect').value = lang; }
    });
    document.getElementById('questionSearch')?.addEventListener('input', filterQuestions);
    document.getElementById('questionCategoryFilter')?.addEventListener('change', filterQuestions);
    container.querySelector('.add-question')?.addEventListener('click', () => openQuestionModal());

    const modal = document.getElementById('questionModal');
    modal?.querySelector('.modal-close')?.addEventListener('click', closeQuestionModal);
    modal?.querySelector('.modal-cancel')?.addEventListener('click', closeQuestionModal);
    modal?.querySelector('.save-question')?.addEventListener('click', saveQuestion);

    document.getElementById('qCategory')?.addEventListener('change', e => {
        const el = document.getElementById('qNewCategory');
        if (e.target.value === '__new__') { el.classList.remove('hidden'); el.required = true; }
        else { el.classList.add('hidden'); el.required = false; }
    });

    attachQuestionActions();
}

function renderQuestionCards(questions) {
    return questions.map(q => `
        <div class="question-card" data-q-number="${q.Q_NUMBER}">
            <div class="question-card-header">
                <span class="q-number">Q${q.Q_NUMBER}</span>
                <span class="q-category">${q.CATEGORY}</span>
            </div>
            <div class="question-card-body">
                <p class="q-text">${q.QUESTION}</p>
                <ul class="q-options">
                    <li class="${q.ANSWER === '1' ? 'correct' : ''}">1. ${q.OPTION1}</li>
                    <li class="${q.ANSWER === '2' ? 'correct' : ''}">2. ${q.OPTION2}</li>
                    <li class="${q.ANSWER === '3' ? 'correct' : ''}">3. ${q.OPTION3}</li>
                </ul>
                ${q.IMAGE ? `<div class="q-image-indicator">Image: ${q.IMAGE}</div>` : ''}
            </div>
            <div class="question-card-actions">
                <button class="btn btn-sm edit-question" data-q-number="${q.Q_NUMBER}">Edit</button>
                <button class="btn btn-sm btn-danger delete-question" data-q-number="${q.Q_NUMBER}">Delete</button>
            </div>
        </div>
    `).join('');
}

function filterQuestions() {
    const search   = document.getElementById('questionSearch')?.value.toLowerCase() || '';
    const catFilter = document.getElementById('questionCategoryFilter')?.value || '';
    const filtered = allQuestions.filter(q =>
        (!catFilter || q.CATEGORY === catFilter) &&
        (q.QUESTION.toLowerCase().includes(search) || q.OPTION1.toLowerCase().includes(search) ||
         q.OPTION2.toLowerCase().includes(search) || q.OPTION3.toLowerCase().includes(search))
    );
    document.getElementById('questionsList').innerHTML = renderQuestionCards(filtered);
    attachQuestionActions();
}

function attachQuestionActions() {
    document.querySelectorAll('.edit-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const q = allQuestions.find(q => q.Q_NUMBER === btn.dataset.qNumber);
            if (q) openQuestionModal(q);
        });
    });
    document.querySelectorAll('.delete-question').forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = document.getElementById('questionLangSelect')?.value || 'en';
            if (!confirm(`Delete question #${btn.dataset.qNumber}?`)) return;
            const res = await window.api(`/api/exam/admin/questions/${btn.dataset.qNumber}?lang=${lang}`, { method:'DELETE' });
            if (res.success) { alert('Deleted'); loadQuestions(); } else alert('Failed');
        });
    });
}

function openQuestionModal(question = null) {
    const modal = document.getElementById('questionModal');
    const title = document.getElementById('questionModalTitle');
    if (question) {
        title.textContent = `Edit Question #${question.Q_NUMBER}`;
        document.getElementById('qNumber').value   = question.Q_NUMBER;
        document.getElementById('qCategory').value = question.CATEGORY;
        document.getElementById('qQuestion').value = question.QUESTION;
        document.getElementById('qOption1').value  = question.OPTION1;
        document.getElementById('qOption2').value  = question.OPTION2;
        document.getElementById('qOption3').value  = question.OPTION3;
        document.getElementById('qAnswer').value   = question.ANSWER;
        document.getElementById('qImage').value    = question.IMAGE || '';
    } else {
        title.textContent = 'Add Question';
        document.getElementById('questionForm').reset();
        document.getElementById('qNumber').value = '';
    }
    document.getElementById('qNewCategory').classList.add('hidden');
    modal.classList.remove('hidden');
}

function closeQuestionModal() {
    document.getElementById('questionModal').classList.add('hidden');
}

async function saveQuestion() {
    const qNumber = document.getElementById('qNumber').value;
    const lang    = document.getElementById('questionLangSelect')?.value || 'en';
    let category  = document.getElementById('qCategory').value;
    if (category === '__new__') {
        category = document.getElementById('qNewCategory').value.trim();
        if (!category) { alert('Please enter a category name'); return; }
    }
    const data = {
        CATEGORY: category,
        QUESTION: document.getElementById('qQuestion').value,
        OPTION1:  document.getElementById('qOption1').value,
        OPTION2:  document.getElementById('qOption2').value,
        OPTION3:  document.getElementById('qOption3').value,
        ANSWER:   document.getElementById('qAnswer').value,
        IMAGE:    document.getElementById('qImage').value || null
    };
    try {
        const res = qNumber
            ? await window.api(`/api/exam/admin/questions/${qNumber}?lang=${lang}`, { method:'PUT', body:JSON.stringify(data) })
            : await window.api(`/api/exam/admin/questions?lang=${lang}`, { method:'POST', body:JSON.stringify(data) });
        if (res.success) { alert(res.message); closeQuestionModal(); loadQuestions(); }
        else alert(res.message || 'Failed to save');
    } catch (err) { alert('Failed to save'); }
}

// ─────────────────────────────────────────────
// PRACTICE LOGS TAB
// ─────────────────────────────────────────────
async function loadPracticeLogs(from = '', to = '') {
    const container = document.getElementById('examPracticeLogs');
    container.innerHTML = '<div class="loading">Loading…</div>';

    try {
        const qs = from && to ? `?from=${from}&to=${to}` : '';
        const res = await window.api(`/api/exam/admin/practice-logs${qs}`);
        if (!res.success) throw new Error('Failed to load logs');

        const logs = res.logs; // [{date, email, questions_answered, correct, first_time, last_time, categories}]

        // Build daily chart data from flat rows
        const dayMap = {};
        logs.forEach(r => {
            if (!dayMap[r.date]) dayMap[r.date] = { users: 0, questions: 0 };
            dayMap[r.date].users++;
            dayMap[r.date].questions += Number(r.questions_answered);
        });
        const chartDays = Object.keys(dayMap).sort();

        container.innerHTML = `
            <div class="pl-header">
                <h3>Practice Activity Logs</h3>
                <div class="pl-date-range">
                    <input type="date" id="plFrom" class="filter-input" value="${from}">
                    <span>–</span>
                    <input type="date" id="plTo" class="filter-input" value="${to}">
                    <button class="btn btn-sm btn-primary" id="plApply">Apply</button>
                    <button class="btn btn-sm" id="plReset">Reset</button>
                </div>
            </div>

            <div class="pl-chart-wrap">
                <canvas id="practiceLogsChart" height="120"></canvas>
            </div>

            <div class="exam-table-wrap" style="margin-top:16px;">
                <table class="exam-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Questions</th>
                            <th>Correct</th>
                            <th>Accuracy</th>
                            <th>Time</th>
                            <th>Categories</th>
                        </tr>
                    </thead>
                    <tbody id="plTableBody">${renderLogRows(logs)}</tbody>
                </table>
            </div>
        `;

        renderLogsChart(chartDays, dayMap);

        document.getElementById('plApply')?.addEventListener('click', () => {
            const f = document.getElementById('plFrom').value;
            const t = document.getElementById('plTo').value;
            if (f && t) loadPracticeLogs(f, t);
        });
        document.getElementById('plReset')?.addEventListener('click', () => loadPracticeLogs());

    } catch (err) {
        console.error('Practice logs error:', err);
        container.innerHTML = '<div class="error">Failed to load practice logs</div>';
    }
}

function formatLogDate(dateStr) {
    // dateStr is always 'YYYY-MM-DD' from DATE_FORMAT in MySQL
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function renderLogRows(logs) {
    if (!logs.length) return `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">No practice activity found</td></tr>`;

    let lastDate = null;
    return logs.map(r => {
        const acc = r.questions_answered > 0
            ? Math.round((Number(r.correct) / r.questions_answered) * 100) : 0;
        const accColor = acc >= 70 ? '#10b981' : acc >= 50 ? '#f59e0b' : '#ef4444';

        const isNewDate = r.date !== lastDate;
        lastDate = r.date;

        const dateCell = isNewDate
            ? `<td class="pl-date-cell" rowspan="1" style="font-weight:600; color:#1e293b; white-space:nowrap;">${formatLogDate(r.date)}</td>`
            : `<td class="pl-date-cell pl-date-blank"></td>`;

        return `
            <tr class="${isNewDate ? 'pl-row-first' : ''}">
                ${dateCell}
                <td style="font-size:13px;">${r.email}</td>
                <td style="font-weight:600;">${r.questions_answered}</td>
                <td>${Number(r.correct)}</td>
                <td><span style="color:${accColor}; font-weight:600;">${acc}%</span></td>
                <td style="font-size:12px; color:#64748b;">${r.first_time}–${r.last_time}</td>
                <td style="font-size:11px; color:#64748b; max-width:180px; white-space:normal;">${r.categories || '—'}</td>
            </tr>
        `;
    }).join('');
}

function renderLogsChart(days, dayMap) {
    const ctx = document.getElementById('practiceLogsChart')?.getContext('2d');
    if (!ctx) return;
    if (examChartInstances.practiceLogs) examChartInstances.practiceLogs.destroy();

    const labels = days.map(d => {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { month:'short', day:'numeric' });
    });

    examChartInstances.practiceLogs = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Questions Answered',
                    data: days.map(d => dayMap[d].questions),
                    backgroundColor: 'rgba(139,92,246,0.7)',
                    borderRadius: 4,
                    yAxisID: 'yQ'
                },
                {
                    label: 'Active Users',
                    data: days.map(d => dayMap[d].users),
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.15)',
                    tension: 0.3,
                    pointRadius: 4,
                    fill: false,
                    yAxisID: 'yU'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' },
                datalabels: { display: false }
            },
            scales: {
                yQ: { beginAtZero: true, position: 'left',  title: { display: true, text: 'Questions' }, ticks: { stepSize: 1 } },
                yU: { beginAtZero: true, position: 'right', title: { display: true, text: 'Users' },     ticks: { stepSize: 1 }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}
function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

window.renderExamsModule = renderExamsModule;
