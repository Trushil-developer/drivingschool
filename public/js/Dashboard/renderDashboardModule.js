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

          <!-- Enquiry Trends -->
          <div class="dashboard-section dashboard-section-wide">
            <div class="chart-header">
              <h3>Enquiry Trends</h3>
              <div class="chart-filters">
                <select id="enquiryBranchFilter" class="chart-filter-select">
                  <option value="">All Branches</option>
                </select>
                <select id="enquiryHeardAboutFilter" class="chart-filter-select">
                  <option value="">All Sources</option>
                </select>
                <select id="enquiryGranularity" class="chart-filter-select">
                  <option value="day" selected>By Day</option>
                  <option value="month">By Month</option>
                  <option value="year">By Year</option>
                </select>
              </div>
            </div>
            <canvas id="enquiryChart"></canvas>
          </div>

          <!-- Enrollment Trends -->
          <div class="dashboard-section dashboard-section-wide">
            <div class="chart-header">
              <h3>Enrollment Trends</h3>
              <div class="chart-filters">
                <select id="enrollmentBranchFilter" class="chart-filter-select">
                  <option value="">All Branches</option>
                </select>
                <select id="enrollmentGranularity" class="chart-filter-select">
                  <option value="day" selected>By Day</option>
                  <option value="month">By Month</option>
                  <option value="year">By Year</option>
                </select>
              </div>
            </div>
            <canvas id="enrollmentChart"></canvas>
          </div>

          <!-- Attendance Trends -->
          <div class="dashboard-section dashboard-section-wide">
            <div class="chart-header">
              <h3>Attendance Trends</h3>
              <div class="chart-filters">
                <select id="attendanceBranchFilter" class="chart-filter-select">
                  <option value="">All Branches</option>
                </select>
                <select id="attendanceGranularity" class="chart-filter-select">
                  <option value="day" selected>By Day</option>
                  <option value="month">By Month</option>
                  <option value="year">By Year</option>
                </select>
              </div>
            </div>
            <canvas id="attendanceChart"></canvas>
          </div>

          <!-- Expense Trends -->
          <div class="dashboard-section dashboard-section-wide">
            <div class="chart-header">
              <h3>Expense Trends</h3>
              <div class="chart-filters">
                <select id="expenseBranchFilter" class="chart-filter-select">
                  <option value="">All Branches</option>
                </select>
                <select id="expenseCategoryFilter" class="chart-filter-select">
                  <option value="">All Categories</option>
                </select>
                <select id="expenseGranularity" class="chart-filter-select">
                  <option value="day" selected>By Day</option>
                  <option value="month">By Month</option>
                  <option value="year">By Year</option>
                </select>
              </div>
            </div>
            <canvas id="expenseDashboardChart"></canvas>
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

    // Load branches, heard_about options and initial dashboard
    await loadBranches();
    await loadHeardAboutOptions();
    await updateDashboard();

    // Add event listeners for main filters
    fromDate.addEventListener("change", () => { monthPicker.value = ""; updateDashboard(); });
    toDate.addEventListener("change", () => { monthPicker.value = ""; updateDashboard(); });
    monthPicker.addEventListener("change", () => { fromDate.value = ""; toDate.value = ""; updateDashboard(); });
    branchFilter.addEventListener("change", () => { updateDashboard(); });

    // Add event listeners for chart-specific filters
    document.getElementById("enquiryBranchFilter").addEventListener("change", loadEnquiryChart);
    document.getElementById("enquiryHeardAboutFilter").addEventListener("change", loadEnquiryChart);
    document.getElementById("enquiryGranularity").addEventListener("change", loadEnquiryChart);

    document.getElementById("enrollmentBranchFilter").addEventListener("change", loadEnrollmentChart);
    document.getElementById("enrollmentGranularity").addEventListener("change", loadEnrollmentChart);

    document.getElementById("attendanceBranchFilter").addEventListener("change", loadAttendanceChart);
    document.getElementById("attendanceGranularity").addEventListener("change", loadAttendanceChart);

    document.getElementById("expenseBranchFilter").addEventListener("change", loadExpenseChart);
    document.getElementById("expenseCategoryFilter").addEventListener("change", loadExpenseChart);
    document.getElementById("expenseGranularity").addEventListener("change", loadExpenseChart);

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
    const totalSlotsToday = slotsRes.success ? slotsRes.totalSlotsToday : 0;

    // Render dashboard cards
    document.getElementById("dashboardCards").innerHTML = `
      <div class="card"><h4>Total Bookings</h4><p>${s.totalBookings}</p></div>
      <div class="card active"><h4>Active</h4><p>${s.active}</p></div>
      <div class="card completed"><h4>Completed</h4><p>${s.completed}</p></div>
      <div class="card hold"><h4>On Hold</h4><p>${s.hold}</p></div>
      <div class="card expired"><h4>Expired</h4><p>${s.expired}</p></div>
      <div class="card today"><h4>Joined Today</h4><p>${s.todayBookings}</p></div>
      <div class="card slots">
          <h4>Today's Attendance</h4>
          <p>${totalSlotsToday} / ${activeSlots} Slots</p>
          <p style="font-size:0.82em;color:#64748b;margin-top:4px;">Students: ${studentsPresent}</p>
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

  // Populate all branch filter dropdowns
  const branchSelects = [
    document.getElementById("branchFilter"),
    document.getElementById("enquiryBranchFilter"),
    document.getElementById("enrollmentBranchFilter"),
    document.getElementById("attendanceBranchFilter"),
    document.getElementById("expenseBranchFilter")
  ];

  branchSelects.forEach(select => {
    if (!select) return;
    data.branches.forEach(branch => {
      const option = document.createElement("option");
      option.value = branch.branch_name;
      option.textContent = branch.branch_name;
      select.appendChild(option);
    });
  });
}

async function loadHeardAboutOptions() {
  try {
    const res = await window.api("/api/dashboard/heard-about-options");
    if (!res.success) return;

    const select = document.getElementById("enquiryHeardAboutFilter");
    if (!select) return;

    res.data.forEach(source => {
      const option = document.createElement("option");
      option.value = source;
      option.textContent = source;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Load heard about options error:", err);
  }
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
    loadEnquiryChart(),
    loadEnrollmentChart(),
    loadAttendanceChart(),
    loadExpenseChart(),
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

async function loadEnquiryChart() {
  try {
    const branch = document.getElementById('enquiryBranchFilter')?.value || '';
    const heardAbout = document.getElementById('enquiryHeardAboutFilter')?.value || '';
    const granularity = document.getElementById('enquiryGranularity')?.value || 'month';

    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (heardAbout) params.append('heard_about', heardAbout);
    params.append('granularity', granularity);

    const res = await window.api(`/api/dashboard/enquiry-trends?${params.toString()}`);
    if (!res.success) return;

    const ctx = document.getElementById('enquiryChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.enquiry) chartInstances.enquiry.destroy();

    const labels = res.data.map(d => formatPeriodLabel(d.period, granularity));

    chartInstances.enquiry = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Enquiries',
          data: res.data.map(d => d.count),
          borderColor: COLORS.purple,
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: COLORS.purple,
          pointRadius: 4
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
    console.error("Enquiry chart error:", err);
  }
}

async function loadEnrollmentChart() {
  try {
    const branch = document.getElementById('enrollmentBranchFilter')?.value || '';
    const granularity = document.getElementById('enrollmentGranularity')?.value || 'month';

    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    params.append('granularity', granularity);

    const res = await window.api(`/api/dashboard/enrollment-trends?${params.toString()}`);
    if (!res.success) return;

    const ctx = document.getElementById('enrollmentChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.enrollment) chartInstances.enrollment.destroy();

    const labels = res.data.map(d => formatPeriodLabel(d.period, granularity));

    chartInstances.enrollment = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Enrollments',
          data: res.data.map(d => d.count),
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: COLORS.primary,
          pointRadius: 4
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
    console.error("Enrollment chart error:", err);
  }
}

async function loadAttendanceChart() {
  try {
    const branch = document.getElementById('attendanceBranchFilter')?.value || '';
    const granularity = document.getElementById('attendanceGranularity')?.value || 'month';

    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    params.append('granularity', granularity);

    const res = await window.api(`/api/dashboard/attendance-trends?${params.toString()}`);
    if (!res.success) return;

    const ctx = document.getElementById('attendanceChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.attendance) chartInstances.attendance.destroy();

    const labels = res.data.map(d => formatPeriodLabel(d.period, granularity));

    chartInstances.attendance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Students Present',
            data: res.data.map(d => d.present_count),
            backgroundColor: COLORS.success,
            borderRadius: 4
          },
          {
            label: 'Total Slots Attended',
            data: res.data.map(d => d.total_slots),
            backgroundColor: 'rgba(59,130,246,0.5)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                const d = res.data[idx];
                if (d && d.absent_count > 0) return [`Marked Absent: ${d.absent_count}`];
                return [];
              }
            }
          }
        },
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch (err) {
    console.error("Attendance chart error:", err);
  }
}

function formatPeriodLabel(period, granularity) {
  if (granularity === 'year') {
    return period.toString();
  } else if (granularity === 'day') {
    const date = new Date(period);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // month format: YYYY-MM
    const [year, month] = period.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}

async function loadExpenseChart() {
  try {
    const branch      = document.getElementById('expenseBranchFilter')?.value || '';
    const granularity = document.getElementById('expenseGranularity')?.value || 'month';

    const res = await window.api('/api/expenses');
    if (!res.success) return;

    // Populate category filter on first load
    const catSelect = document.getElementById('expenseCategoryFilter');
    const allCategories = [...new Set(res.expenses.map(e => e.category).filter(Boolean))].sort();
    if (catSelect && catSelect.options.length === 1) {
      allCategories.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        catSelect.appendChild(opt);
      });
    }

    const categoryFilter = catSelect?.value || '';

    // Apply filters
    let data = res.expenses;
    if (branch)         data = data.filter(e => e.branch === branch);
    if (categoryFilter) data = data.filter(e => e.category === categoryFilter);

    // Determine which categories to show as stacked segments
    const visibleCategories = categoryFilter
      ? [categoryFilter]
      : [...new Set(data.map(e => e.category).filter(Boolean))].sort();

    // Build period → category → total map
    const periodMap = {};
    data.forEach(e => {
      if (!e.expense_date) return;
      const d = new Date(e.expense_date);
      let period;
      if (granularity === 'day')       period = e.expense_date.split('T')[0];
      else if (granularity === 'year') period = String(d.getFullYear());
      else                             period = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

      if (!periodMap[period]) periodMap[period] = {};
      const cat = e.category || 'Other';
      periodMap[period][cat] = (periodMap[period][cat] || 0) + Number(e.amount || 0);
    });

    const labels = Object.keys(periodMap).sort();

    // Color palette for categories
    const palette = [
      COLORS.danger, COLORS.primary, COLORS.warning, COLORS.success,
      COLORS.purple, COLORS.cyan, COLORS.indigo, COLORS.pink,
      '#f97316', '#14b8a6'
    ];

    const datasets = visibleCategories.map((cat, i) => ({
      label: cat,
      data: labels.map(p => periodMap[p]?.[cat] || 0),
      backgroundColor: palette[i % palette.length],
      borderRadius: i === visibleCategories.length - 1 ? 5 : 0,
      borderSkipped: false
    }));

    const ctx = document.getElementById('expenseDashboardChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.expense) chartInstances.expense.destroy();

    chartInstances.expense = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 }, padding: 12 }
          },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: Rs.${Number(ctx.raw).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: '#F3F4F6' },
            ticks: { callback: v => 'Rs.' + v.toLocaleString('en-IN'), font: { size: 11 } }
          }
        }
      }
    });
  } catch (err) {
    console.error("Expense chart error:", err);
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
