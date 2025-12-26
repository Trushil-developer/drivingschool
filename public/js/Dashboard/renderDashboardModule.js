export function renderDashboardModule(container) {
  return async function renderDashboard() {
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
          <p>Active: ${activeSlots}<br>Present: ${studentsPresent}</p>
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
