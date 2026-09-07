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
        return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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

                    <label>Tag (optional)</label>
                    <input id="tag" type="text" placeholder="e.g. NEW">

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

                    <label>15 Days Price</label>
                    <input id="price_15_days" type="number" step="0.01" min="0" value="0">

                    <label>21 Days Price</label>
                    <input id="price_21_days" type="number" step="0.01" min="0" value="0">

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
                    tag: document.getElementById("tag").value.trim() || null,
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value,
                    puc_issue_date: document.getElementById("puc_issue_date").value,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value,
                    price_15_days: parseFloat(document.getElementById("price_15_days").value) || 0,
                    price_21_days: parseFloat(document.getElementById("price_21_days").value) || 0
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
// RESET CAR METER MODAL
// ========================
window.openCarMeterModal = function (id, carName, tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const nfmt = n => Number(n || 0).toLocaleString('en-IN');

            window.Modal.setContent(`<h2>Car Meter — ${carName || ''}</h2>
                <div class="modal-content-form"><p>Loading…</p></div>`);
            window.Modal.show();

            const res = await window.api(`/api/cars/${id}/meter`);
            if (!res.success) throw new Error(res.error || "Failed to load meter");

            const resets = res.resets || [];
            const resetsHTML = resets.length
                ? `<ul style="margin:6px 0 0; padding-left:18px;">${resets.map(r => {
                        const when = new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                        return `<li>${nfmt(r.reading)} km &middot; ${when}${r.note ? ` &middot; ${r.note}` : ''}</li>`;
                    }).join('')}</ul>`
                : `<p style="color:#6b7280; margin:6px 0 0;">No resets recorded yet.</p>`;

            window.Modal.setContent(`
                <h2>Car Meter — ${carName || ''}</h2>
                <div class="modal-content-form car-modal">
                    <p><strong>Current meter:</strong> ${nfmt(res.current_meter)} km<br>
                       <span style="color:#6b7280; font-size:13px;">
                       The next start / end reading an instructor enters for this car
                       must be at least this value.</span></p>

                    <label>New meter reading (km)</label>
                    <input id="meter_reading" type="number" min="0" step="1" value="${res.current_meter || 0}">

                    <label>Reason (optional)</label>
                    <input id="meter_note" type="text" maxlength="255"
                        placeholder="e.g. wrong reading entered, odometer replaced">

                    <p style="color:#b45309; font-size:13px; margin:8px 0 0;">
                        This sets a new baseline for the car. Trip readings recorded before
                        now are ignored for the minimum-reading check from here on.
                    </p>

                    <button id="saveMeter" class="btn primary">Reset Meter</button>

                    <h3 style="margin:18px 0 0;">Recent resets</h3>
                    ${resetsHTML}
                </div>
            `);

            document.getElementById("saveMeter").onclick = async () => {
                const reading = parseInt(document.getElementById("meter_reading").value, 10);
                const note = document.getElementById("meter_note").value.trim();
                if (!Number.isInteger(reading) || reading < 0) {
                    return alert("Enter a valid meter reading (a whole number, 0 or more).");
                }
                if (!confirm(`Set ${carName || 'this car'}'s meter baseline to ${reading.toLocaleString('en-IN')} km?`)) return;
                try {
                    const r = await window.api(`/api/cars/${id}/meter/reset`, {
                        method: "POST",
                        body: JSON.stringify({ reading, note }),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!r.success) throw new Error(r.error || "Failed to reset meter");
                    alert(`Meter reset. New baseline: ${Number(r.current_meter).toLocaleString('en-IN')} km`);
                    window.Modal.hide();
                    tabRenderers?.[currentTab]?.();
                } catch (err) {
                    alert("Error: " + err.message);
                }
            };
        } catch (err) {
            console.error(err);
            alert("Error opening meter modal: " + err.message);
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

                    <label>Tag (optional)</label>
                    <input id="tag" type="text" value="${data.tag || ''}" placeholder="e.g. NEW ARRIVAL">

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

                    <label>15 Days Price</label>
                    <input id="price_15_days" type="number" step="0.01" min="0"
                        value="${data.price_15_days ?? 0}">

                    <label>21 Days Price</label>
                    <input id="price_21_days" type="number" step="0.01" min="0"
                        value="${data.price_21_days ?? 0}">

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
                    tag: document.getElementById("tag").value.trim() || null,
                    branch: document.getElementById("branch").value.trim(),
                    car_registration_no: document.getElementById("car_registration_no").value.trim(),
                    insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                    insurance_company: document.getElementById("insurance_company").value.trim(),
                    insurance_issue_date: document.getElementById("insurance_issue_date").value,
                    insurance_expiry_date: document.getElementById("insurance_expiry_date").value,
                    puc_issue_date: document.getElementById("puc_issue_date").value,
                    puc_expiry_date: document.getElementById("puc_expiry_date").value,
                    price_15_days: parseFloat(document.getElementById("price_15_days").value) || 0,
                    price_21_days: parseFloat(document.getElementById("price_21_days").value) || 0
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
