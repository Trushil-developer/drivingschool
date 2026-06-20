// Store chart instances for cleanup
let chartInstances = {};

const _IST_TZ = 'Asia/Kolkata';
const _todayIST = new Date().toLocaleDateString('en-CA', { timeZone: _IST_TZ });

// Attendance date navigator state — initialised to IST today
let attendanceDate = new Date(_todayIST);

// Joined date navigator state — initialised to IST today
let joinedDate = new Date(_todayIST);

function formatAttendanceDateParam(d) {
  return d.toLocaleDateString('en-CA', { timeZone: _IST_TZ });
}

function formatAttendanceDateLabel(d) {
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: _IST_TZ });
  if (d.toLocaleDateString('en-CA', { timeZone: _IST_TZ }) === todayIST) return 'Today';
  return d.toLocaleDateString('en-IN', { timeZone: _IST_TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

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
                <select id="expenseSubFilter" class="chart-filter-select" style="display:none">
                  <option value="">All</option>
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
          <div class="dashboard-section">
            <h3>Car Workload</h3>
            <canvas id="carChart"></canvas>
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
    const currentMonth = now.toLocaleDateString('en-CA', { timeZone: _IST_TZ }).slice(0, 7);
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
    document.getElementById("expenseCategoryFilter").addEventListener("change", () => {
      const sub = document.getElementById("expenseSubFilter");
      if (sub) { sub.innerHTML = '<option value="">All</option>'; sub.style.display = 'none'; }
      loadExpenseChart();
    });
    document.getElementById("expenseSubFilter").addEventListener("change", loadExpenseChart);
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

        if (res.success) {
          const fmt = n => `₹${Number(n).toLocaleString('en-IN')}`;
          e.target.textContent = fmt(res.trainingRevenue);
          e.target.classList.remove('revenue-locked');
          const breakdown = document.getElementById('revenueBreakdown');
          if (breakdown) {
            document.getElementById('revTraining').textContent   = fmt(res.trainingRevenue);
            document.getElementById('revCollected').textContent  = fmt(res.collectedRevenue);
            document.getElementById('revPending').textContent    = fmt(res.pendingRevenue);
            document.getElementById('revLicence').textContent    = fmt(res.licenceRevenue);
            breakdown.style.display = 'block';
          }
        } else alert("Incorrect password");
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
    // Fetch main stats (with joinDate for "Joined" card)
    const joinDateParam = formatAttendanceDateParam(joinedDate);
    const statsQuery = query ? `${query}&joinDate=${joinDateParam}` : `joinDate=${joinDateParam}`;
    const statsRes = await window.api(`/api/dashboard/stats?${statsQuery}`);
    if (!statsRes.success) return;
    const s = statsRes.stats;

    // Fetch slots + students present for selected attendance date
    const attendanceDateParam = formatAttendanceDateParam(attendanceDate);
    const slotsQuery = query ? `${query}&date=${attendanceDateParam}` : `date=${attendanceDateParam}`;
    const slotsRes = await window.api(`/api/dashboard/today-slots?${slotsQuery}`);
    const branchStats = slotsRes.success ? (slotsRes.branchStats || []) : [];
    const studentsPresent = slotsRes.success ? slotsRes.studentsPresent : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = attendanceDate.getTime() === today.getTime();
    const dateLabel = formatAttendanceDateLabel(attendanceDate);
    const isJoinedToday = joinedDate.getTime() === today.getTime();
    const joinedDateLabel = formatAttendanceDateLabel(joinedDate);

    const branchRowsHtml = branchStats.map(b => {
      return `<div class="branch-slot-row">
        <span class="branch-slot-name">${b.branch}</span>
        <span class="branch-slot-pat">
          <span class="pat-p">P ${b.present}</span>
          <span class="pat-a">A ${b.absent}</span>
          <span class="pat-m">M ${b.missing}</span>
          <span class="pat-t">T ${b.total}</span>
        </span>
      </div>`;
    }).join('');

    // Render dashboard cards
    document.getElementById("dashboardCards").innerHTML = `
      <div class="card"><h4>Total Bookings</h4><p>${s.totalBookings}</p></div>
      <div class="card active"><h4>Active</h4><p>${s.active}</p></div>
      <div class="card completed"><h4>Completed</h4><p>${s.completed}</p></div>
      <div class="card hold"><h4>On Hold</h4><p>${s.hold}</p></div>
      <div class="card expired"><h4>Expired</h4><p>${s.expired}</p></div>
      <div class="card today">
          <h4>Joined</h4>
          <div class="attendance-date-nav">
            <button class="att-nav-btn" id="joinPrevBtn">&#8249;</button>
            <span class="att-date-label">${joinedDateLabel}</span>
            ${isJoinedToday ? '' : '<button class="att-nav-btn" id="joinNextBtn">&#8250;</button>'}
          </div>
          <p>${s.todayBookings}</p>
      </div>
      <div class="card slots">
          <h4>Attendance</h4>
          <div class="attendance-date-nav">
            <button class="att-nav-btn" id="attPrevBtn">&#8249;</button>
            <span class="att-date-label">${dateLabel}</span>
            ${isToday ? '' : '<button class="att-nav-btn" id="attNextBtn">&#8250;</button>'}
          </div>
          <div class="branch-slots-list">${branchRowsHtml}</div>
          <p class="slots-total">P ${slotsRes.studentsPresent || 0} &nbsp; A ${slotsRes.studentsAbsent || 0} &nbsp; M ${slotsRes.studentsMissing || 0} &nbsp; T ${(slotsRes.studentsPresent || 0) + (slotsRes.studentsAbsent || 0) + (slotsRes.studentsMissing || 0)}</p>
      </div>
      <div class="card revenue">
          <h4>Revenue</h4>
          <p id="revenueValue" class="revenue-locked">🔒 Click to unlock</p>
          <div id="revenueBreakdown" class="revenue-breakdown" style="display:none;">
              <div class="rev-row"><span>Total Fees</span><span id="revTraining">—</span></div>
              <div class="rev-row rev-row--collected"><span>Collected</span><span id="revCollected">—</span></div>
              <div class="rev-row rev-row--pending"><span>Pending</span><span id="revPending">—</span></div>
              <div class="rev-row rev-row--licence"><span>Licence Fees</span><span id="revLicence">—</span></div>
          </div>
      </div>
    `;

    // Wire up attendance date navigation
    const currentQuery = query;
    document.getElementById("attPrevBtn")?.addEventListener("click", () => {
      attendanceDate.setDate(attendanceDate.getDate() - 1);
      loadDashboardData(currentQuery);
    });
    document.getElementById("attNextBtn")?.addEventListener("click", () => {
      attendanceDate.setDate(attendanceDate.getDate() + 1);
      loadDashboardData(currentQuery);
    });

    // Wire up joined date navigation
    document.getElementById("joinPrevBtn")?.addEventListener("click", () => {
      joinedDate.setDate(joinedDate.getDate() - 1);
      loadDashboardData(currentQuery);
    });
    document.getElementById("joinNextBtn")?.addEventListener("click", () => {
      joinedDate.setDate(joinedDate.getDate() + 1);
      loadDashboardData(currentQuery);
    });

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
    loadInstructorChart(query),
    loadCarChart(query)
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

    const labels      = res.data.map(d => formatPeriodLabel(d.period, granularity));
    const present     = res.data.map(d => Number(d.present_count));
    const absent      = res.data.map(d => Number(d.absent_count));
    const totals      = res.data.map(d => Number(d.total));
    const untracked   = totals.map((t, i) => Math.max(0, t - present[i] - absent[i]));
    const showBlue    = granularity === 'day';

    const datasets = [
      {
        label: 'Present',
        data: present,
        backgroundColor: 'rgba(16,185,129,0.9)',
        stack: 'att'
      },
      {
        label: 'Absent',
        data: absent,
        backgroundColor: 'rgba(239,68,68,0.9)',
        stack: 'att'
      }
    ];
    if (showBlue) {
      datasets.push({
        label: 'Not Yet Marked',
        data: untracked,
        backgroundColor: 'rgba(59,130,246,0.55)',
        stack: 'att'
      });
    }

    chartInstances.attendance = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (item) => {
                const idx   = item.dataIndex;
                const total = totals[idx] || 1;
                const pct   = Math.round((item.raw / total) * 100);
                return ` ${item.dataset.label}: ${item.raw} (${pct}%)`;
              },
              afterBody: (items) => {
                const idx   = items[0]?.dataIndex;
                const total = totals[idx] || 0;
                const p     = present[idx] || 0;
                if (!total) return '';
                return `Attendance rate: ${Math.round((p / total) * 100)}%`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
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

    // Sub-filter: car (for car-related categories) or employee name
    const subFilterSelect = document.getElementById('expenseSubFilter');
    const currentSubValue = subFilterSelect?.value || '';
    const isCarRelated = categoryFilter && res.expenses.find(e => e.category === categoryFilter)?.is_car_related;
    const hasEmployeeNames = categoryFilter && data.some(e => e.employee_name);

    if (categoryFilter && isCarRelated) {
      const cars = [...new Set(data.map(e => e.car_name).filter(Boolean))].sort();
      if (subFilterSelect && cars.length > 0) {
        subFilterSelect.innerHTML = `<option value="">All Cars</option>` +
          cars.map(c => `<option value="${c}"${c === currentSubValue ? ' selected' : ''}>${c}</option>`).join('');
        subFilterSelect.style.display = '';
      }
      if (currentSubValue) data = data.filter(e => e.car_name === currentSubValue);
    } else if (categoryFilter && hasEmployeeNames) {
      const employees = [...new Set(data.map(e => e.employee_name).filter(Boolean))].sort();
      if (subFilterSelect && employees.length > 0) {
        subFilterSelect.innerHTML = `<option value="">All Employees</option>` +
          employees.map(emp => `<option value="${emp}"${emp === currentSubValue ? ' selected' : ''}>${emp}</option>`).join('');
        subFilterSelect.style.display = '';
      }
      if (currentSubValue) data = data.filter(e => e.employee_name === currentSubValue);
    } else if (subFilterSelect) {
      subFilterSelect.innerHTML = '<option value="">All</option>';
      subFilterSelect.style.display = 'none';
    }

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
      else if (granularity === 'year') period = d.toLocaleDateString('en-CA', { timeZone: _IST_TZ }).slice(0, 4);
      else                             period = d.toLocaleDateString('en-CA', { timeZone: _IST_TZ }).slice(0, 7);

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

    const datasets = visibleCategories.map((cat, i) => {
      const color = palette[i % palette.length];
      return {
        label: cat,
        data: labels.map(p => periodMap[p]?.[cat] || 0),
        borderColor: color,
        backgroundColor: color + '28',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        borderWidth: 2
      };
    });

    const ctx = document.getElementById('expenseDashboardChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.expense) chartInstances.expense.destroy();

    chartInstances.expense = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
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
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
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

async function loadCarChart(query) {
  try {
    const branchParam = new URLSearchParams(query).get('branch');
    const params = branchParam ? `?branch=${branchParam}` : '';
    const res = await window.api(`/api/dashboard/car-workload${params}`);
    if (!res.success) return;

    const ctx = document.getElementById('carChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.car) chartInstances.car.destroy();

    chartInstances.car = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: res.data.map(d => d.car),
        datasets: [{
          label: 'Active Students',
          data: res.data.map(d => d.activeStudents),
          backgroundColor: COLORS.cyan,
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
    console.error("Car chart error:", err);
  }
}
