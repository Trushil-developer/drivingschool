// ========================
// INTERNAL BRANCH FETCHER
// ========================
async function fetchBranchOptions(selected = "") {
    try {
        const res = await window.api("/api/branches");

        if (!res.success || !res.branches) {
            console.error("Failed to load branches:", res.error);
            return `<option value="">Error loading branches</option>`;
        }

        return res.branches
            .map(b => {
                const sel = b.branch_name === selected ? "selected" : "";
                return `<option value="${b.branch_name}" ${sel}>${b.branch_name}</option>`;
            })
            .join("");

    } catch (err) {
        console.error("Branch load error:", err);
        return `<option value="">Error</option>`;
    }
}


function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
    
// ========================
// ADD CAR MODAL
// ========================
window.openCarAddModal = function (tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Add Car</h2>
                <div class="modal-content-form car-modal">
                    <label>Car Name</label>
                    <input id="car_name" type="text">

                    <label>Branch</label>
                    <select id="branch"><option>Loading...</option></select>

                    <label>Registration No</label>
                    <input id="car_registration_no" type="text">

                    <label>Insurance Policy No</label>
                    <input id="insurance_policy_no" type="text">

                    <label>Insurance Company</label>
                    <input id="insurance_company" type="text">

                    <label>Insurance Issue Date</label>
                    <input id="insurance_issue_date" type="date">

                    <label>Insurance Expiry Date</label>
                    <input id="insurance_expiry_date" type="date">

                    <label>PUC Issue Date</label>
                    <input id="puc_issue_date" type="date">

                    <label>PUC Expiry Date</label>
                    <input id="puc_expiry_date" type="date">

                    <button id="saveCar" class="btn primary">Save Car</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Load branches directly
            setTimeout(async () => {
                document.getElementById("branch").innerHTML =
                    await fetchBranchOptions();
            }, 10);

            // Save handler
            document.getElementById("saveCar").onclick = async () => {
                const payload = {
                    car_name: document.getElementById("car_name").value.trim(),
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value,
                    puc_issue_date: document.getElementById("puc_issue_date").value,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value
                };

                if (!payload.car_name) return alert("Car name required");

                try {
                    const res = await window.api("/api/cars", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to add car");

                    alert("Car added successfully!");
                    window.Modal.hide();
                    tabRenderers[currentTab]?.();
                } catch (err) {
                    alert("Error: " + err.message);
                }
            };
        } catch (err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    };
};


// ========================
// EDIT CAR MODAL
// ========================
window.openCarEditModal = function (id, data, tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Edit Car</h2>
                <div class="modal-content-form car-modal">
                    <label>Car Name</label>
                    <input id="car_name" type="text" value="${data.car_name || ''}">

                    <label>Branch</label>
                    <select id="branch"><option>Loading...</option></select>

                    <label>Registration No</label>
                    <input id="car_registration_no" type="text" value="${data.car_registration_no || ''}">

                    <label>Insurance Policy No</label>
                    <input id="insurance_policy_no" type="text" value="${data.insurance_policy_no || ''}">

                    <label>Insurance Company</label>
                    <input id="insurance_company" type="text" value="${data.insurance_company || ''}">

                    <label>Insurance Issue Date</label>
                    <input id="insurance_issue_date" type="date" value="${formatDate(data.insurance_issue_date)}">

                    <label>Insurance Expiry Date</label>
                    <input id="insurance_expiry_date" type="date" value="${formatDate(data.insurance_expiry_date)}">

                    <label>PUC Issue Date</label>
                    <input id="puc_issue_date" type="date" value="${formatDate(data.puc_issue_date)}">

                    <label>PUC Expiry Date</label>
                    <input id="puc_expiry_date" type="date" value="${formatDate(data.puc_expiry_date)}">

                    <button id="saveCar" class="btn primary">Save Changes</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Load branches directly
            setTimeout(async () => {
                document.getElementById("branch").innerHTML =
                    await fetchBranchOptions(data.branch);
            }, 10);

            // Save handler
            document.getElementById("saveCar").onclick = async () => {
                const payload = {
                    car_name: document.getElementById("car_name").value.trim(),
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value,
                    puc_issue_date: document.getElementById("puc_issue_date").value,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value
                };

                try {
                    const res = await window.api(`/api/cars/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to update car");

                    alert("Car updated successfully!");
                    window.Modal.hide();
                    tabRenderers[currentTab]?.();
                } catch (err) {
                    alert("Error: " + err.message);
                }
            };
        } catch (err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    };
};
