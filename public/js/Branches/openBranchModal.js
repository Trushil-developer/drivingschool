// Add Branch Modal
window.openBranchModal = function(tabRenderers, currentTab) {
    return async function() {
        try {
            if (!window.Modal) throw new Error("Modal component not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Add Branch</h2>
                <div class="modal-content-form">
                    <label>Branch Name</label><input id="br_name" type="text">
                    <label>City</label><input id="br_city" type="text">
                    <label>State</label><input id="br_state" type="text">
                    <label>Mobile</label><input id="br_mobile" type="text">
                    <label>Email</label><input id="br_email" type="email">
                    <label>WiFi SSID <span style="font-weight:400;color:#6b7280;font-size:12px">(for instructor clock-in)</span></label>
                    <input id="br_wifi" type="text" placeholder="e.g. BranchName_WiFi">
                    <button id="saveBranch" class="btn primary">Save Branch</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            document.getElementById("saveBranch").onclick = async () => {
                const payload = {
                    branch_name: document.getElementById("br_name").value.trim(),
                    city: document.getElementById("br_city").value.trim(),
                    state: document.getElementById("br_state").value.trim(),
                    mobile_no: document.getElementById("br_mobile").value.trim(),
                    email: document.getElementById("br_email").value.trim(),
                    wifi_ssid: document.getElementById("br_wifi").value.trim(),
                };

                try {
                    const res = await window.api("/api/branches", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to add branch");

                    alert("Branch added successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            };

        } catch(err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    }
};

// Edit Branch Modal
window.openBranchEditModal = function(id, data, tabRenderers, currentTab) {
    return async function() {
        try {
            if (!window.Modal) throw new Error("Modal component not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Edit Branch</h2>
                <div class="modal-content-form">
                    <label>Branch Name</label><input id="br_name" type="text" value="${data.branch_name}">
                    <label>City</label><input id="br_city" type="text" value="${data.city}">
                    <label>State</label><input id="br_state" type="text" value="${data.state}">
                    <label>Mobile</label><input id="br_mobile" type="text" value="${data.mobile_no}">
                    <label>Email</label><input id="br_email" type="email" value="${data.email}">
                    <label>WiFi SSID <span style="font-weight:400;color:#6b7280;font-size:12px">(for instructor clock-in)</span></label>
                    <input id="br_wifi" type="text" placeholder="e.g. BranchName_WiFi" value="${data.wifi_ssid || ''}">
                    <button id="saveBranch" class="btn primary">Save Changes</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            document.getElementById("saveBranch").onclick = async () => {
                const payload = {
                    branch_name: document.getElementById("br_name").value.trim(),
                    city: document.getElementById("br_city").value.trim(),
                    state: document.getElementById("br_state").value.trim(),
                    mobile_no: document.getElementById("br_mobile").value.trim(),
                    email: document.getElementById("br_email").value.trim(),
                    wifi_ssid: document.getElementById("br_wifi").value.trim(),
                };

                try {
                    const res = await window.api(`/api/branches/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!res.success) throw new Error(res.error || "Failed to update branch");

                    alert("Branch updated successfully!");
                    window.Modal.hide();
                    if(tabRenderers[currentTab]) tabRenderers[currentTab]();
                } catch(err) {
                    alert("Error: " + err.message);
                }
            };

        } catch(err) {
            console.error(err);
            alert("Error opening modal: " + err.message);
        }
    }
};
