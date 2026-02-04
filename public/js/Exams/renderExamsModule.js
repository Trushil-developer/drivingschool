// Store chart instances for cleanup
let examChartInstances = {};
let allUsers = [];
let allAttempts = [];
let allQuestions = [];
let questionCategories = [];

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
                    <button class="tab-btn" data-tab="questions">Question Bank</button>
                </div>

                <div class="exams-content">
                    <div id="examOverview" class="tab-content active"></div>
                    <div id="examUsers" class="tab-content hidden"></div>
                    <div id="examAttempts" class="tab-content hidden"></div>
                    <div id="examQuestions" class="tab-content hidden"></div>
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
                else if (tabId === 'questions') loadQuestions();
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
        const [overviewRes, scoreDistRes] = await Promise.all([
            window.api('/api/exam/admin/overview'),
            window.api('/api/exam/admin/score-distribution')
        ]);

        if (!overviewRes.success) throw new Error('Failed to load overview');

        const { stats, recentActivity } = overviewRes;
        const scoreDistribution = scoreDistRes.success ? scoreDistRes.distribution : [];

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
                    <h3>Score Distribution</h3>
                    <canvas id="scoreDistChart"></canvas>
                </div>
            </div>

            <div class="exam-charts">
                <div class="chart-section chart-section-wide">
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

        // Render Score Distribution chart
        const scoreDistCtx = document.getElementById('scoreDistChart')?.getContext('2d');
        if (scoreDistCtx && scoreDistribution.length) {
            examChartInstances.scoreDist = new Chart(scoreDistCtx, {
                type: 'bar',
                data: {
                    labels: scoreDistribution.map(d => d.score_range),
                    datasets: [{
                        label: 'Count',
                        data: scoreDistribution.map(d => d.count),
                        backgroundColor: scoreDistribution.map(d => {
                            const range = d.score_range;
                            if (range === '0-4' || range === '5-6' || range === '7-8') return '#ef4444';
                            return '#10b981';
                        }),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#fff',
                            font: { weight: 'bold', size: 12 },
                            formatter: (value) => value > 0 ? value : ''
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
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

        allUsers = res.users;

        if (!res.users.length) {
            container.innerHTML = '<div class="empty">No exam users found</div>';
            return;
        }

        renderUsersTable(container, allUsers);

    } catch (err) {
        console.error('Exam users error:', err);
        container.innerHTML = '<div class="error">Failed to load users</div>';
    }
}

function renderUsersTable(container, users) {
    container.innerHTML = `
        <div class="exam-toolbar">
            <div class="search-box">
                <input type="text" id="userSearch" placeholder="Search by email..." class="search-input">
            </div>
            <div class="filter-box">
                <select id="userResultFilter" class="filter-select">
                    <option value="">All Results</option>
                    <option value="PASS">Passed</option>
                    <option value="FAIL">Failed</option>
                </select>
            </div>
        </div>
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
                <tbody id="usersTableBody">
                    ${renderUserRows(users)}
                </tbody>
            </table>
        </div>
    `;

    // Search handler
    document.getElementById('userSearch')?.addEventListener('input', (e) => {
        filterUsers();
    });

    // Filter handler
    document.getElementById('userResultFilter')?.addEventListener('change', () => {
        filterUsers();
    });

    attachUserActions(container);
}

function renderUserRows(users) {
    return users.map(u => `
        <tr data-user-id="${u.id}">
            <td>${u.email}</td>
            <td>${formatDate(u.first_verified_at)}</td>
            <td>${formatDate(u.last_seen_at)}</td>
            <td>${u.total_attempts}</td>
            <td>${u.best_score}%</td>
            <td>${u.last_score !== null ? u.last_score + '%' : '-'}</td>
            <td class="${u.last_result === 'PASS' ? 'status-pass' : u.last_result === 'FAIL' ? 'status-fail' : ''}">${u.last_result || '-'}</td>
            <td class="action-btns">
                <button class="btn btn-sm view-attempts" data-user-id="${u.id}" data-email="${u.email}">View</button>
                <button class="btn btn-sm btn-warning reset-attempts" data-user-id="${u.id}" data-email="${u.email}">Reset</button>
                <button class="btn btn-sm btn-danger delete-user" data-user-id="${u.id}" data-email="${u.email}">Delete</button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const resultFilter = document.getElementById('userResultFilter')?.value || '';

    let filtered = allUsers.filter(u => {
        const matchSearch = u.email.toLowerCase().includes(search);
        const matchResult = !resultFilter || u.last_result === resultFilter;
        return matchSearch && matchResult;
    });

    document.getElementById('usersTableBody').innerHTML = renderUserRows(filtered);
    attachUserActions(document.getElementById('examUsers'));
}

function attachUserActions(container) {
    // View attempts
    container.querySelectorAll('.view-attempts').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.userId;
            const email = btn.dataset.email;
            loadAttempts(userId, email);

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="attempts"]').classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('examAttempts').classList.remove('hidden');
        });
    });

    // Reset attempts
    container.querySelectorAll('.reset-attempts').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const email = btn.dataset.email;

            if (!confirm(`Reset all attempts for ${email}? This cannot be undone.`)) return;

            try {
                const res = await window.api(`/api/exam/admin/users/${userId}/attempts`, { method: 'DELETE' });
                if (res.success) {
                    alert('Attempts reset successfully');
                    loadUsers();
                } else {
                    alert('Failed to reset attempts');
                }
            } catch (err) {
                console.error('Reset error:', err);
                alert('Failed to reset attempts');
            }
        });
    });

    // Delete user
    container.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const email = btn.dataset.email;

            if (!confirm(`Delete user ${email} and all their attempts? This cannot be undone.`)) return;

            try {
                const res = await window.api(`/api/exam/admin/users/${userId}`, { method: 'DELETE' });
                if (res.success) {
                    alert('User deleted successfully');
                    loadUsers();
                } else {
                    alert('Failed to delete user');
                }
            } catch (err) {
                console.error('Delete error:', err);
                alert('Failed to delete user');
            }
        });
    });
}

async function loadAttempts(userId = null, userEmail = null) {
    const container = document.getElementById('examAttempts');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const url = userId ? `/api/exam/admin/attempts?user_id=${userId}` : '/api/exam/admin/attempts';
        const res = await window.api(url);
        if (!res.success) throw new Error('Failed to load attempts');

        allAttempts = res.attempts;
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
                <div class="header-actions">
                    ${clearFilter}
                    <button class="btn btn-sm btn-primary export-csv">Export CSV</button>
                </div>
            </div>
            <div class="exam-toolbar">
                <div class="search-box">
                    <input type="text" id="attemptSearch" placeholder="Search by email..." class="search-input">
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
                    <tbody id="attemptsTableBody">
                        ${renderAttemptRows(allAttempts)}
                    </tbody>
                </table>
            </div>
        `;

        // Clear filter handler
        container.querySelector('.clear-filter')?.addEventListener('click', () => {
            loadAttempts();
        });

        // Export CSV handler
        container.querySelector('.export-csv')?.addEventListener('click', () => {
            window.location.href = '/api/exam/admin/attempts/export';
        });

        // Search handler
        document.getElementById('attemptSearch')?.addEventListener('input', () => {
            filterAttempts();
        });

        // Filter handlers
        document.getElementById('attemptResultFilter')?.addEventListener('change', () => {
            filterAttempts();
        });

        document.getElementById('attemptStatusFilter')?.addEventListener('change', () => {
            filterAttempts();
        });

    } catch (err) {
        console.error('Exam attempts error:', err);
        container.innerHTML = '<div class="error">Failed to load attempts</div>';
    }
}

function renderAttemptRows(attempts) {
    return attempts.map(a => `
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
    `).join('');
}

function filterAttempts() {
    const search = document.getElementById('attemptSearch')?.value.toLowerCase() || '';
    const resultFilter = document.getElementById('attemptResultFilter')?.value || '';
    const statusFilter = document.getElementById('attemptStatusFilter')?.value || '';

    let filtered = allAttempts.filter(a => {
        const matchSearch = a.email.toLowerCase().includes(search);
        const matchResult = !resultFilter || a.result === resultFilter;
        const matchStatus = !statusFilter || a.status === statusFilter;
        return matchSearch && matchResult && matchStatus;
    });

    document.getElementById('attemptsTableBody').innerHTML = renderAttemptRows(filtered);
}

async function loadQuestions() {
    const container = document.getElementById('examQuestions');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const res = await window.api('/api/exam/admin/questions?lang=en');
        if (!res.success) throw new Error('Failed to load questions');

        allQuestions = res.questions;
        questionCategories = res.categories;

        renderQuestionsView(container);

    } catch (err) {
        console.error('Questions error:', err);
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
                <input type="text" id="questionSearch" placeholder="Search questions..." class="search-input">
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
        <div class="questions-list" id="questionsList">
            ${renderQuestionCards(allQuestions)}
        </div>

        <!-- Question Modal -->
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
                        <div class="form-group">
                            <label>Question</label>
                            <textarea id="qQuestion" rows="3" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Option 1</label>
                            <input type="text" id="qOption1" required>
                        </div>
                        <div class="form-group">
                            <label>Option 2</label>
                            <input type="text" id="qOption2" required>
                        </div>
                        <div class="form-group">
                            <label>Option 3</label>
                            <input type="text" id="qOption3" required>
                        </div>
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

    // Language select handler
    document.getElementById('questionLangSelect')?.addEventListener('change', async (e) => {
        const lang = e.target.value;
        try {
            const res = await window.api(`/api/exam/admin/questions?lang=${lang}`);
            if (res.success) {
                allQuestions = res.questions;
                questionCategories = res.categories;
                renderQuestionsView(container);
                document.getElementById('questionLangSelect').value = lang;
            }
        } catch (err) {
            console.error('Language switch error:', err);
        }
    });

    // Search handler
    document.getElementById('questionSearch')?.addEventListener('input', () => {
        filterQuestions();
    });

    // Category filter handler
    document.getElementById('questionCategoryFilter')?.addEventListener('change', () => {
        filterQuestions();
    });

    // Add question handler
    container.querySelector('.add-question')?.addEventListener('click', () => {
        openQuestionModal();
    });

    // Modal handlers
    const modal = document.getElementById('questionModal');
    modal?.querySelector('.modal-close')?.addEventListener('click', () => closeQuestionModal());
    modal?.querySelector('.modal-cancel')?.addEventListener('click', () => closeQuestionModal());
    modal?.querySelector('.save-question')?.addEventListener('click', () => saveQuestion());

    // Category select handler for new category
    document.getElementById('qCategory')?.addEventListener('change', (e) => {
        const newCatInput = document.getElementById('qNewCategory');
        if (e.target.value === '__new__') {
            newCatInput.classList.remove('hidden');
            newCatInput.required = true;
        } else {
            newCatInput.classList.add('hidden');
            newCatInput.required = false;
        }
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
                ${q.IMAGE ? `<div class="q-image-indicator">Has image: ${q.IMAGE}</div>` : ''}
            </div>
            <div class="question-card-actions">
                <button class="btn btn-sm edit-question" data-q-number="${q.Q_NUMBER}">Edit</button>
                <button class="btn btn-sm btn-danger delete-question" data-q-number="${q.Q_NUMBER}">Delete</button>
            </div>
        </div>
    `).join('');
}

function filterQuestions() {
    const search = document.getElementById('questionSearch')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('questionCategoryFilter')?.value || '';

    let filtered = allQuestions.filter(q => {
        const matchSearch = q.QUESTION.toLowerCase().includes(search) ||
            q.OPTION1.toLowerCase().includes(search) ||
            q.OPTION2.toLowerCase().includes(search) ||
            q.OPTION3.toLowerCase().includes(search);
        const matchCategory = !categoryFilter || q.CATEGORY === categoryFilter;
        return matchSearch && matchCategory;
    });

    document.getElementById('questionsList').innerHTML = renderQuestionCards(filtered);
    attachQuestionActions();
}

function attachQuestionActions() {
    // Edit question
    document.querySelectorAll('.edit-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const qNumber = btn.dataset.qNumber;
            const question = allQuestions.find(q => q.Q_NUMBER === qNumber);
            if (question) {
                openQuestionModal(question);
            }
        });
    });

    // Delete question
    document.querySelectorAll('.delete-question').forEach(btn => {
        btn.addEventListener('click', async () => {
            const qNumber = btn.dataset.qNumber;
            const lang = document.getElementById('questionLangSelect')?.value || 'en';

            if (!confirm(`Delete question #${qNumber}? This cannot be undone.`)) return;

            try {
                const res = await window.api(`/api/exam/admin/questions/${qNumber}?lang=${lang}`, { method: 'DELETE' });
                if (res.success) {
                    alert('Question deleted successfully');
                    loadQuestions();
                } else {
                    alert('Failed to delete question');
                }
            } catch (err) {
                console.error('Delete question error:', err);
                alert('Failed to delete question');
            }
        });
    });
}

function openQuestionModal(question = null) {
    const modal = document.getElementById('questionModal');
    const title = document.getElementById('questionModalTitle');

    if (question) {
        title.textContent = `Edit Question #${question.Q_NUMBER}`;
        document.getElementById('qNumber').value = question.Q_NUMBER;
        document.getElementById('qCategory').value = question.CATEGORY;
        document.getElementById('qQuestion').value = question.QUESTION;
        document.getElementById('qOption1').value = question.OPTION1;
        document.getElementById('qOption2').value = question.OPTION2;
        document.getElementById('qOption3').value = question.OPTION3;
        document.getElementById('qAnswer').value = question.ANSWER;
        document.getElementById('qImage').value = question.IMAGE || '';
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
    const lang = document.getElementById('questionLangSelect')?.value || 'en';

    let category = document.getElementById('qCategory').value;
    if (category === '__new__') {
        category = document.getElementById('qNewCategory').value.trim();
        if (!category) {
            alert('Please enter a category name');
            return;
        }
    }

    const data = {
        CATEGORY: category,
        QUESTION: document.getElementById('qQuestion').value,
        OPTION1: document.getElementById('qOption1').value,
        OPTION2: document.getElementById('qOption2').value,
        OPTION3: document.getElementById('qOption3').value,
        ANSWER: document.getElementById('qAnswer').value,
        IMAGE: document.getElementById('qImage').value || null
    };

    try {
        let res;
        if (qNumber) {
            res = await window.api(`/api/exam/admin/questions/${qNumber}?lang=${lang}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            res = await window.api(`/api/exam/admin/questions?lang=${lang}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        if (res.success) {
            alert(res.message);
            closeQuestionModal();
            loadQuestions();
        } else {
            alert(res.message || 'Failed to save question');
        }
    } catch (err) {
        console.error('Save question error:', err);
        alert('Failed to save question');
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
