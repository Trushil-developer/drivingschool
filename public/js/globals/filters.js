export function attachFilterListeners(tabRenderers, getCurrentTab) {
    const filterBranch = document.getElementById("filterBranch");
    const filterStatus = document.getElementById("filterStatus");
    const filterPending = document.getElementById("filterPending");

    if (!filterBranch || !filterStatus) return;

    const rerender = () => {
        const tab = getCurrentTab();
        if (tabRenderers[tab]) tabRenderers[tab]();
    };

    filterBranch.addEventListener("change", rerender);
    filterStatus.addEventListener("change", rerender);
    if (filterPending) filterPending.addEventListener("change", rerender);
    document.getElementById("filterCar")?.addEventListener("change", rerender);
}

// The same car name can exist at several branches, so the list is de-duplicated.
export async function loadFilterCars() {
    const filterCar = document.getElementById("filterCar");
    if (!filterCar) return;

    const res = await window.api("/api/cars");
    const names = [...new Set((res.cars || []).map(c => (c.car_name || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    filterCar.innerHTML = `<option value="">All Cars</option>`;
    names.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        filterCar.appendChild(opt);
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

    // ---- Car Filter ----
    const carSelected = document.getElementById("filterCar")?.value || "";
    if (carSelected && (tab === "bookings" || tab === "upcoming")) {
        filtered = filtered.filter(item => (item.car_name || "").trim() === carSelected);
    }

    // ---- Status Filter ----
    const statusSelected = filterStatus?.value || "";
    if (statusSelected && (tab === "bookings" || tab === "upcoming")) {
        filtered = filtered.filter(item =>
            (item.attendance_status || "") === statusSelected
        );
    }

    // ---- Pending Payment Filter ----
    const pendingSelected = document.getElementById("filterPending")?.value || "";
    if (pendingSelected && (tab === "bookings" || tab === "upcoming")) {
        filtered = filtered.filter(item => {
            const pending = Math.round((parseFloat(item.total_fees || 0) - parseFloat(item.advance || 0)) * 100) / 100;
            if (pendingSelected === "pending") return pending > 0;
            if (pendingSelected === "paid") return pending <= 0;
            return true;
        });
    }

    return filtered;
}
