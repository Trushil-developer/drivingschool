window.openCarAddModal = async function(tabRenderers, currentTab) {
    if (!window.Modal) return;
    if (!window.Modal.el) window.Modal.init();

    const formHTML = `
        <h2>Add Car</h2>
        <div class="modal-content-form car-modal">
            <label>Car Name</label><input id="car_name" type="text" placeholder="Car Name" required>
            <label>Branch</label><select id="branch"><option value="">Loading...</option></select>
            <label>Registration No</label><input id="car_registration_no" type="text" placeholder="Car Registration No">
            <label>Insurance Policy No</label><input id="insurance_policy_no" type="text" placeholder="Policy No">
            <label>Insurance Company</label><input id="insurance_company" type="text" placeholder="Company No.">
            <label>Insurance Issue Date</label><input id="insurance_issue_date" type="date">
            <label>Insurance Expiry Date</label><input id="insurance_expiry_date" type="date">
            <label>PUC Issue Date</label><input id="puc_issue_date" type="date">
            <label>PUC Expiry Date</label><input id="puc_expiry_date" type="date">
            <button id="saveCar" class="btn primary">Save Car</button>
        </div>
    `;

    window.Modal.setContent(formHTML);
    window.Modal.show();

    setTimeout(async () => {
        document.getElementById("branch").innerHTML = await getBranchOptionsHTML();
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

            if (!payload.car_name) return alert("Car name is required");

            try {
                const res = await window.api("/api/cars", {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { "Content-Type": "application/json" }
                });
                if (!res.success) throw new Error(res.error || "Failed to save car");
                alert("Car saved successfully!");
                window.Modal.hide();
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();
            } catch (err) {
                alert("Error: " + err.message);
            }
        };
    }, 50);
};

window.openCarEditModal = async function(id, data, tabRenderers, currentTab) {
    if (!window.Modal) return;
    if (!window.Modal.el) window.Modal.init();

    const innerFormHTML = `
        <h2>Edit Car</h2>
        <div class="modal-content-form car-modal">
            <label>Car Name</label><input id="car_name" type="text" value="${data.car_name || ''}" required>
            <label>Branch</label><select id="branch"><option value="">Loading...</option></select>
            <label>Registration No</label><input id="car_registration_no" type="text" value="${data.car_registration_no || ''}">
            <label>Insurance Policy No</label><input id="insurance_policy_no" type="text" value="${data.insurance_policy_no || ''}">
            <label>Insurance Company</label><input id="insurance_company" type="text" value="${data.insurance_company || ''}">
            <label>Insurance Issue Date</label><input id="insurance_issue_date" type="date" value="${formatDateForInput(data.insurance_issue_date)}">
            <label>Insurance Expiry Date</label><input id="insurance_expiry_date" type="date" value="${formatDateForInput(data.insurance_expiry_date)}">
            <label>PUC Issue Date</label><input id="puc_issue_date" type="date" value="${formatDateForInput(data.puc_issue_date)}">
            <label>PUC Expiry Date</label><input id="puc_expiry_date" type="date" value="${formatDateForInput(data.puc_expiry_date)}">
            <button id="saveCar" class="btn primary">Save Changes</button>
        </div>
    `;

    window.Modal.setContent(innerFormHTML);
    window.Modal.show();

    setTimeout(async () => {
        document.getElementById("branch").innerHTML = await getBranchOptionsHTML(data.branch);

        const saveBtn = document.getElementById("saveCar");
        if(!saveBtn) return;
        saveBtn.addEventListener("click", async () => {
            const payload = {
                car_name: document.getElementById("car_name").value.trim(),
                branch: document.getElementById("branch").value.trim(),
                car_registration_no: document.getElementById("car_registration_no").value.trim(),
                insurance_policy_no: document.getElementById("insurance_policy_no").value.trim(),
                insurance_company: document.getElementById("insurance_company").value.trim(),
                insurance_issue_date: document.getElementById("insurance_issue_date").value || null,
                insurance_expiry_date: document.getElementById("insurance_expiry_date").value || null,
                puc_issue_date: document.getElementById("puc_issue_date").value || null,
                puc_expiry_date: document.getElementById("puc_expiry_date").value || null
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
                if(tabRenderers[currentTab]) tabRenderers[currentTab]();
            } catch(err) {
                alert("Error: " + err.message);
            }
        });
    }, 50);
};
