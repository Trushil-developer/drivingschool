export function attachFilterListeners(tabRenderers, getCurrentTab) {
    const filterBranch = document.getElementById("filterBranch");
    const filterStatus = document.getElementById("filterStatus");

    if (!filterBranch || !filterStatus) return;

    // When branch is changed --> re-render current tab
    filterBranch.addEventListener("change", () => {
        const tab = getCurrentTab();
        if (tabRenderers[tab]) tabRenderers[tab]();
    });

    // When status is changed --> re-render current tab
    filterStatus.addEventListener("change", () => {
        const tab = getCurrentTab();
        if (tabRenderers[tab]) tabRenderers[tab]();
    });
}

export async function loadFilterBranches() {
    const filterBranch = document.getElementById("filterBranch");
    if (!filterBranch) return;

    const res = await window.api("/api/branches");
    const branches = res.branches || [];

    filterBranch.innerHTML = `<option value="">All Branches</option>`;
    branches.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.branch_name;
        opt.textContent = b.branch_name;
        filterBranch.appendChild(opt);
    });
}

/**
 * Main filtering logic shared across all tabs
 */
export function filterData(tab, items, query) {
    const filterBranch = document.getElementById("filterBranch");
    const filterStatus = document.getElementById("filterStatus");

    let filtered = [...items];

    // ---- Search Filter ----
    if (query) {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter(item => {
            let fields = [];

            switch (tab) {
                case "bookings":
                case "upcoming":
                    fields = [
                        item.customer_name,
                        item.mobile_no,
                        item.whatsapp_no,
                        item.branch,
                        item.car_name,
                        item.instructor_name
                    ];
                    break;

                case "instructors":
                    fields = [
                        item.instructor_name,
                        item.email,
                        item.mobile_no,
                        item.branch,
                        item.drivers_license,
                        item.adhar_no
                    ];
                    break;

                case "cars":
                    fields = [
                        item.car_name,
                        item.branch,
                        item.car_registration_no
                    ];
                    break;

                case "branches":
                    fields = [
                        item.branch_name,
                        item.city,
                        item.state,
                        item.mobile_no,
                        item.email
                    ];
                    break;
            }

            return fields.some(f => (f || "").toLowerCase().includes(q));
        });
    }

    // ---- Branch Filter ----
    const branchSelected = filterBranch?.value || "";
    if (branchSelected) {
        filtered = filtered.filter(item =>
            (item.branch || "").toLowerCase() === branchSelected.toLowerCase()
        );
    }

    // ---- Status Filter ----
    const statusSelected = filterStatus?.value || "";
    if (statusSelected && (tab === "bookings" || tab === "upcoming")) {
        filtered = filtered.filter(item =>
            (item.attendance_status || "") === statusSelected
        );
    }

    return filtered;
}
