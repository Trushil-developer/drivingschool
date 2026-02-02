// Store chart instances for cleanup
let examChartInstances = {};

export function renderExamsModule(container) {
    return async function renderExams() {
        // Destroy existing charts
        Object.values(examChartInstances).forEach(chart => chart?.destroy());
        examChartInstances = {};

        container.innerHTML = `
            <div class="exams-module">
                <div class="exams-tabs">
                    <button class="tab-btn active" data-tab="overview">Overview</button>
                    <button class="tab-btn" data-tab="users">Users</button>
                    <button class="tab-btn" data-tab="attempts">Attempts</button>
                </div>

                <div class="exams-content">
                    <div id="examOverview" class="tab-content active"></div>
                    <div id="examUsers" class="tab-content hidden"></div>
                    <div id="examAttempts" class="tab-content hidden"></div>
                </div>
            </div>
        `;

        // Tab switching
        const tabBtns = container.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                container.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                const tabId = btn.dataset.tab;
                document.getElementById(`exam${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.remove('hidden');

                if (tabId === 'users') loadUsers();
                else if (tabId === 'attempts') loadAttempts();
            });
        });

        // Load overview by default
        await loadOverview();
    };
}

async function loadOverview() {
    const container = document.getElementById('examOverview');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const res = await window.api('/api/exam/admin/overview');
        if (!res.success) throw new Error('Failed to load overview');

        const { stats, recentActivity } = res;

        container.innerHTML = `
            <div class="exam-stats-cards">
                <div class="stat-card">
                    <h4>Total Users</h4>
                    <p class="stat-value">${stats.totalUsers}</p>
                </div>
                <div class="stat-card">
                    <h4>Total Attempts</h4>
                    <p class="stat-value">${stats.totalAttempts}</p>
                </div>
                <div class="stat-card success">
                    <h4>Passed</h4>
                    <p class="stat-value">${stats.passed}</p>
                </div>
                <div class="stat-card danger">
                    <h4>Failed</h4>
                    <p class="stat-value">${stats.failed}</p>
                </div>
                <div class="stat-card">
                    <h4>Pass Rate</h4>
                    <p class="stat-value">${stats.passRate}%</p>
                </div>
                <div class="stat-card">
                    <h4>Avg Score</h4>
                    <p class="stat-value">${stats.avgScore}%</p>
                </div>
            </div>

            <div class="exam-charts">
                <div class="chart-section">
                    <h3>Pass/Fail Distribution</h3>
                    <canvas id="passFailChart"></canvas>
                </div>
                <div class="chart-section">
                    <h3>Recent Activity (Last 30 Days)</h3>
                    <canvas id="activityChart"></canvas>
                </div>
            </div>
        `;

        // Render Pass/Fail chart
        const passFailCtx = document.getElementById('passFailChart')?.getContext('2d');
        if (passFailCtx) {
            examChartInstances.passFail = new Chart(passFailCtx, {
                type: 'doughnut',
                plugins: [ChartDataLabels],
                data: {
                    labels: ['Passed', 'Failed'],
                    datasets: [{
                        data: [stats.passed, stats.failed],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        datalabels: {
                            color: '#fff',
                            font: { weight: 'bold', size: 14 },
                            formatter: (value) => value > 0 ? value : ''
                        }
                    }
                }
            });
        }

        // Render Activity chart
        const activityCtx = document.getElementById('activityChart')?.getContext('2d');
        if (activityCtx && recentActivity.length) {
            const labels = recentActivity.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });

            examChartInstances.activity = new Chart(activityCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Attempts',
                        data: recentActivity.map(d => d.attempts),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    }
                }
            });
        }

    } catch (err) {
        console.error('Exam overview error:', err);
        container.innerHTML = '<div class="error">Failed to load overview</div>';
    }
}

async function loadUsers() {
    const container = document.getElementById('examUsers');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const res = await window.api('/api/exam/admin/users');
        if (!res.success) throw new Error('Failed to load users');

        if (!res.users.length) {
            container.innerHTML = '<div class="empty">No exam users found</div>';
            return;
        }

        container.innerHTML = `
            <div class="exam-table-wrap">
                <table class="exam-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>First Verified</th>
                            <th>Last Seen</th>
                            <th>Attempts</th>
                            <th>Best Score</th>
                            <th>Last Score</th>
                            <th>Last Result</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${res.users.map(u => `
                            <tr>
                                <td>${u.email}</td>
                                <td>${formatDate(u.first_verified_at)}</td>
                                <td>${formatDate(u.last_seen_at)}</td>
                                <td>${u.total_attempts}</td>
                                <td>${u.best_score}%</td>
                                <td>${u.last_score}%</td>
                                <td class="${u.last_result === 'PASS' ? 'status-pass' : 'status-fail'}">${u.last_result || '-'}</td>
                                <td>
                                    <button class="btn btn-sm view-attempts" data-user-id="${u.id}" data-email="${u.email}">View Attempts</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Add click handler for view attempts
        container.querySelectorAll('.view-attempts').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                const email = btn.dataset.email;
                loadAttempts(userId, email);

                // Switch to attempts tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.tab-btn[data-tab="attempts"]').classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById('examAttempts').classList.remove('hidden');
            });
        });

    } catch (err) {
        console.error('Exam users error:', err);
        container.innerHTML = '<div class="error">Failed to load users</div>';
    }
}

async function loadAttempts(userId = null, userEmail = null) {
    const container = document.getElementById('examAttempts');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const url = userId ? `/api/exam/admin/attempts?user_id=${userId}` : '/api/exam/admin/attempts';
        const res = await window.api(url);
        if (!res.success) throw new Error('Failed to load attempts');

        const headerText = userEmail ? `Attempts for ${userEmail}` : 'All Recent Attempts';
        const clearFilter = userId ? `<button class="btn btn-sm clear-filter">Show All</button>` : '';

        if (!res.attempts.length) {
            container.innerHTML = `
                <div class="attempts-header">
                    <h3>${headerText}</h3>
                    ${clearFilter}
                </div>
                <div class="empty">No attempts found</div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="attempts-header">
                <h3>${headerText}</h3>
                ${clearFilter}
            </div>
            <div class="exam-table-wrap">
                <table class="exam-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>Mode</th>
                            <th>Score</th>
                            <th>Questions</th>
                            <th>Result</th>
                            <th>Started</th>
                            <th>Finished</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${res.attempts.map(a => `
                            <tr>
                                <td>${a.id}</td>
                                <td>${a.email}</td>
                                <td>${a.mode || '-'}</td>
                                <td>${a.score !== null ? a.score + '%' : '-'}</td>
                                <td>${a.correct_answers || 0}/${a.total_questions || '-'}</td>
                                <td class="${a.result === 'PASS' ? 'status-pass' : a.result === 'FAIL' ? 'status-fail' : ''}">${a.result || '-'}</td>
                                <td>${formatDateTime(a.started_at)}</td>
                                <td>${formatDateTime(a.finished_at)}</td>
                                <td class="status-${a.status}">${a.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Add clear filter handler
        container.querySelector('.clear-filter')?.addEventListener('click', () => {
            loadAttempts();
        });

    } catch (err) {
        console.error('Exam attempts error:', err);
        container.innerHTML = '<div class="error">Failed to load attempts</div>';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Export to window for admin.js
window.renderExamsModule = renderExamsModule;
