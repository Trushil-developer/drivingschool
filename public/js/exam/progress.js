export async function renderProgressMonitor(container) {
    container.innerHTML = '<div class="loading-progress">Loading progress...</div>';

    try {
        const res = await fetch('/api/exam/progress');
        const data = await res.json();

        if (!data.success) throw new Error('Failed to load progress');

        const { mockHistory, practiceSummary, userStats } = data;

        container.innerHTML = `
            <div class="progress-overview">
                <div class="progress-stat-cards">
                    <div class="progress-stat-card">
                        <h4>Total Mock Tests</h4>
                        <p class="stat-value">${userStats.total_attempts || 0}</p>
                    </div>
                    <div class="progress-stat-card">
                        <h4>Best Score</h4>
                        <p class="stat-value">${userStats.best_score || 0}/15</p>
                    </div>
                    <div class="progress-stat-card">
                        <h4>Last Score</h4>
                        <p class="stat-value">${userStats.last_score || 0}/15</p>
                    </div>
                    <div class="progress-stat-card">
                        <h4>Last Result</h4>
                        <p class="stat-value ${userStats.last_result === 'PASS' ? 'pass-text' : userStats.last_result === 'FAIL' ? 'fail-text' : ''}">
                            ${userStats.last_result || 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            <div class="progress-section-block">
                <h3>Mock Test History</h3>
                ${renderMockHistoryTable(mockHistory)}
            </div>

            ${renderWeakAreas(practiceSummary)}

            <div class="progress-section-block">
                <h3>Practice Progress by Category</h3>
                ${renderPracticeSummary(practiceSummary)}
            </div>
        `;
    } catch (err) {
        console.error("Progress monitor error:", err);
        container.innerHTML = '<div class="error-msg">Failed to load progress. Please try again.</div>';
    }
}

function renderMockHistoryTable(history) {
    if (!history || !history.length) {
        return '<p class="empty-msg">No mock tests taken yet. Start a mock test to see your results here.</p>';
    }

    return `<div class="progress-table-wrap">
        <table class="progress-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${history.map((h, i) => {
                    let duration = '-';
                    if (h.finished_at && h.started_at) {
                        const diff = Math.floor((new Date(h.finished_at) - new Date(h.started_at)) / 1000);
                        const mins = Math.floor(diff / 60);
                        const secs = diff % 60;
                        duration = `${mins}m ${secs}s`;
                    }
                    return `<tr>
                        <td>${i + 1}</td>
                        <td>${new Date(h.finished_at || h.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>${h.score}/${h.total_questions}</td>
                        <td><span class="result-badge ${h.result === 'PASS' ? 'pass' : 'fail'}">${h.result}</span></td>
                        <td>${duration}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>`;
}

function renderWeakAreas(summary) {
    if (!summary || !summary.length) return '';

    const weakCategories = summary
        .map(s => ({
            category: s.category,
            answered: s.answered,
            correct: Number(s.correct),
            accuracy: s.answered > 0 ? Math.round((Number(s.correct) / s.answered) * 100) : 0
        }))
        .filter(s => s.answered >= 3 && s.accuracy < 70)
        .sort((a, b) => a.accuracy - b.accuracy);

    if (!weakCategories.length) return '';

    return `
        <div class="progress-section-block weak-areas-block">
            <h3>Areas to Improve</h3>
            <p class="weak-areas-hint">Categories where your accuracy is below 70%. Focus your practice on these topics.</p>
            <div class="weak-areas-grid">
                ${weakCategories.map(s => `
                    <div class="weak-area-card">
                        <div class="weak-area-header">
                            <span class="weak-area-name">${s.category}</span>
                            <span class="weak-area-accuracy">${s.accuracy}%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill weak" style="width: ${s.accuracy}%"></div>
                        </div>
                        <span class="weak-area-detail">${s.correct}/${s.answered} correct</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPracticeSummary(summary) {
    if (!summary || !summary.length) {
        return '<p class="empty-msg">No practice questions answered yet. Start practicing to track your progress.</p>';
    }

    return `<div class="practice-progress-grid">
        ${summary.map(s => {
            const accuracy = s.answered > 0 ? Math.round((Number(s.correct) / s.answered) * 100) : 0;
            return `
                <div class="practice-progress-card">
                    <h4>${s.category}</h4>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${accuracy}%"></div>
                    </div>
                    <div class="practice-progress-stats">
                        <span>${s.answered} answered</span>
                        <span>${Number(s.correct)} correct</span>
                        <span class="accuracy">${accuracy}%</span>
                    </div>
                </div>
            `;
        }).join('')}
    </div>`;
}
