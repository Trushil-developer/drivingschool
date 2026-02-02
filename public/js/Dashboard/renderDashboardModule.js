// Store chart instances for cleanup
let chartInstances = {};

export function renderDashboardModule(container) {
  return async function renderDashboard() {
    // Destroy existing charts before re-rendering
    Object.values(chartInstances).forEach(chart => chart?.destroy());
    chartInstances = {};

    container.innerHTML = `
      <div class="dashboard">

        <div class="dashboard-filters">
          <input type="date" id="fromDate">
          <input type="date" id="toDate">

          <span class="or">OR</span>

          <input type="month" id="monthPicker">

          <select id="branchFilter" class="branch-select">
              <option value="">All Branches</option>
          </select>
        </div>

        <div class="dashboard-cards" id="dashboardCards">
          <div class="card loading">Loading...</div>
        </div>

        <div class="dashboard-charts">
          <div class="dashboard-section">
            <h3>Booking Status Distribution</h3>
            <canvas id="statusChart"></canvas>
          </div>
          <div class="dashboard-section">
            <h3>Bookings by Branch</h3>
            <canvas id="branchChart"></canvas>
          </div>
          <div class="dashboard-section">
            <h3>Monthly Enrollment Trends</h3>
            <canvas id="trendsChart"></canvas>
          </div>
          <div class="dashboard-section">
            <h3>Theory Exam Performance</h3>
            <canvas id="examChart"></canvas>
          </div>
          <div class="dashboard-section">
            <h3>Popular Training Packages</h3>
            <canvas id="packageChart"></canvas>
          </div>
          <div class="dashboard-section">
            <h3>Instructor Workload</h3>
            <canvas id="instructorChart"></canvas>
          </div>
        </div>

      </div>
    `;

    const fromDate = document.getElementById("fromDate");
    const toDate = document.getElementById("toDate");
    const monthPicker = document.getElementById("monthPicker");
    const branchFilter = document.getElementById("branchFilter");

    // Default: current month
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    monthPicker.value = currentMonth;

    // Load branches and initial dashboard
    await loadBranches();
    await updateDashboard();

    // Add event listeners for filters
    fromDate.addEventListener("change", () => { monthPicker.value = ""; updateDashboard(); });
    toDate.addEventListener("change", () => { monthPicker.value = ""; updateDashboard(); });
    monthPicker.addEventListener("change", () => { fromDate.value = ""; toDate.value = ""; updateDashboard(); });
    branchFilter.addEventListener("change", () => { updateDashboard(); });

    // Revenue unlock logic
    document.addEventListener("click", async (e) => {
      if (e.target.id === "revenueValue") {
        const pwd = prompt("Enter admin password to view revenue:");
        if (!pwd) return;

        const body = { password: pwd };
        if (fromDate.value && toDate.value) { body.from = fromDate.value; body.to = toDate.value; }
        else if (monthPicker.value) { body.month = monthPicker.value; }
        if (branchFilter.value) body.branch = branchFilter.value;

        const res = await window.api("/api/dashboard/unlock-revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (res.success) e.target.textContent = `₹${res.totalRevenue}`;
        else alert("Incorrect password");
      }
    });

    async function updateDashboard() {
      const params = new URLSearchParams();
      if (fromDate.value && toDate.value) { params.append("from", fromDate.value); params.append("to", toDate.value); }
      else if (monthPicker.value) params.append("month", monthPicker.value);
      if (branchFilter.value) params.append("branch", branchFilter.value);

      await loadDashboardData(params.toString());
      await loadAllCharts(params.toString());
    }
  };
}

async function loadDashboardData(query = "") {
  try {
    // Fetch main stats
    const statsRes = await window.api(`/api/dashboard/stats?${query}`);
    if (!statsRes.success) return;
    const s = statsRes.stats;

    // Fetch today's slots + students present
    const slotsRes = await window.api(`/api/dashboard/today-slots?${query}`);
    const activeSlots = slotsRes.success ? slotsRes.activeSlots : 0;
    const studentsPresent = slotsRes.success ? slotsRes.studentsPresent : 0;

    // Render dashboard cards
    document.getElementById("dashboardCards").innerHTML = `
      <div class="card"><h4>Total Bookings</h4><p>${s.totalBookings}</p></div>
      <div class="card active"><h4>Active</h4><p>${s.active}</p></div>
      <div class="card completed"><h4>Completed</h4><p>${s.completed}</p></div>
      <div class="card hold"><h4>On Hold</h4><p>${s.hold}</p></div>
      <div class="card expired"><h4>Expired</h4><p>${s.expired}</p></div>
      <div class="card today"><h4>Joined Today</h4><p>${s.todayBookings}</p></div>
      <div class="card slots">
          <h4>Today's Slots</h4>
          <p>Present: ${studentsPresent}</p>
      </div>
      <div class="card revenue">
          <h4>Total Revenue</h4>
          <p id="revenueValue">🔒 Locked</p>
      </div>
    `;
  } catch (err) {
    console.error("LOAD DASHBOARD DATA ERROR:", err);
    document.getElementById("dashboardCards").innerHTML = `<div class="card loading">Error loading data</div>`;
  }
}

async function loadBranches() {
  const res = await fetch("/api/branches");
  const data = await res.json();
  if (!data.success || !Array.isArray(data.branches)) return;

  const select = document.getElementById("branchFilter");
  data.branches.forEach(branch => {
    const option = document.createElement("option");
    option.value = branch.branch_name;
    option.textContent = branch.branch_name;
    select.appendChild(option);
  });
}

// Chart color palette
const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  pink: '#ec4899',
  cyan: '#06b6d4'
};

async function loadAllCharts(query = "") {
  await Promise.all([
    loadStatusChart(query),
    loadBranchChart(query),
    loadTrendsChart(query),
    loadExamChart(),
    loadPackageChart(query),
    loadInstructorChart(query)
  ]);
}

async function loadStatusChart(query) {
  try {
    const res = await window.api(`/api/dashboard/stats?${query}`);
    if (!res.success) return;

    const { active, completed, hold, expired } = res.stats;
    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.status) chartInstances.status.destroy();

    chartInstances.status = new Chart(ctx, {
      type: 'doughnut',
      plugins: [ChartDataLabels],
      data: {
        labels: ['Active', 'Completed', 'On Hold', 'Expired'],
        datasets: [{
          data: [active, completed, hold, expired],
          backgroundColor: [COLORS.success, COLORS.primary, COLORS.warning, COLORS.danger],
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
  } catch (err) {
    console.error("Status chart error:", err);
  }
}

async function loadBranchChart(query) {
  try {
    const res = await window.api(`/api/dashboard/bookings-by-branch?${query}`);
    if (!res.success) return;

    const ctx = document.getElementById('branchChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.branch) chartInstances.branch.destroy();

    chartInstances.branch = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: res.data.map(d => d.branch),
        datasets: [{
          label: 'Bookings',
          data: res.data.map(d => d.total),
          backgroundColor: COLORS.primary,
          borderRadius: 6
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
  } catch (err) {
    console.error("Branch chart error:", err);
  }
}

async function loadTrendsChart(query) {
  try {
    const branchParam = new URLSearchParams(query).get('branch');
    const params = branchParam ? `?branch=${branchParam}` : '';
    const res = await window.api(`/api/dashboard/monthly-trends${params}`);
    if (!res.success) return;

    const ctx = document.getElementById('trendsChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.trends) chartInstances.trends.destroy();

    const labels = res.data.map(d => {
      const [year, month] = d.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    chartInstances.trends = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Enrollments',
            data: res.data.map(d => d.bookings),
            borderColor: COLORS.primary,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: COLORS.primary,
            pointRadius: 4
          }
        ]
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
  } catch (err) {
    console.error("Trends chart error:", err);
  }
}

async function loadExamChart() {
  try {
    const res = await window.api('/api/dashboard/exam-stats');
    if (!res.success) return;

    const ctx = document.getElementById('examChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.exam) chartInstances.exam.destroy();

    const { passed, failed, avgScore } = res.data;

    chartInstances.exam = new Chart(ctx, {
      type: 'doughnut',
      plugins: [ChartDataLabels],
      data: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [passed, failed],
          backgroundColor: [COLORS.success, COLORS.danger],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: `Avg Score: ${avgScore}%`,
            position: 'bottom',
            font: { size: 14 }
          },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold', size: 14 },
            formatter: (value) => value > 0 ? value : ''
          }
        }
      }
    });
  } catch (err) {
    console.error("Exam chart error:", err);
  }
}

async function loadPackageChart(query) {
  try {
    const branchParam = new URLSearchParams(query).get('branch');
    const params = branchParam ? `?branch=${branchParam}` : '';
    const res = await window.api(`/api/dashboard/package-popularity${params}`);
    if (!res.success) return;

    const ctx = document.getElementById('packageChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.package) chartInstances.package.destroy();

    const colors = [COLORS.primary, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.indigo];

    chartInstances.package = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: res.data.map(d => `${d.package} Days`),
        datasets: [{
          label: 'Students',
          data: res.data.map(d => d.count),
          backgroundColor: res.data.map((_, i) => colors[i % colors.length]),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch (err) {
    console.error("Package chart error:", err);
  }
}

async function loadInstructorChart(query) {
  try {
    const branchParam = new URLSearchParams(query).get('branch');
    const params = branchParam ? `?branch=${branchParam}` : '';
    const res = await window.api(`/api/dashboard/instructor-workload${params}`);
    if (!res.success) return;

    const ctx = document.getElementById('instructorChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.instructor) chartInstances.instructor.destroy();

    chartInstances.instructor = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: res.data.map(d => d.instructor),
        datasets: [{
          label: 'Active Students',
          data: res.data.map(d => d.activeStudents),
          backgroundColor: COLORS.indigo,
          borderRadius: 6
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
  } catch (err) {
    console.error("Instructor chart error:", err);
  }
}
