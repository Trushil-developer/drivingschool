window.openInstructorAddModal = async function(tabRenderers, currentTab) {
    if (!window.Modal) return;
    if (!window.Modal.el) try { window.Modal.init(); } catch(err){ console.error(err); return; }

    const innerFormHTML = `
        <h2>Add Instructor</h2>
        <div class="modal-content-form">
            <label>Name</label><input id="ins_name" type="text" placeholder="Instructor Name" required>
            <label>Email</label><input id="ins_email" type="email" placeholder="Email" required>
            <label>Mobile</label><input id="ins_mobile" type="text" placeholder="Mobile" required>
            <label>Branch</label><input id="ins_branch" type="text" placeholder="Branch" required>
            <label>Driver Licence</label><input id="ins_license" type="text" placeholder="Driver Licence" required>
            <label>Adhar No</label><input id="ins_adhar" type="text" placeholder="Adhar" required>
            <label>Address</label><textarea id="ins_address" placeholder="Address" required></textarea>
            <button id="saveInstructor" class="btn primary">Save Instructor</button>
        </div>
    `;
    window.Modal.setContent(innerFormHTML);
    window.Modal.show();

    setTimeout(() => {
        const saveBtn = document.getElementById("saveInstructor");
        if (!saveBtn) return;
        saveBtn.addEventListener("click", async () => {
            const instructorData = {
                instructor_name: document.getElementById("ins_name").value.trim(),
                email: document.getElementById("ins_email").value.trim(),
                mobile_no: document.getElementById("ins_mobile").value.trim(),
                branch: document.getElementById("ins_branch").value.trim(),
                drivers_license: document.getElementById("ins_license").value.trim(),
                adhar_no: document.getElementById("ins_adhar").value.trim(),
                address: document.getElementById("ins_address").value.trim(),
            };

            for (const [key, value] of Object.entries(instructorData)) {
                if (!value) {
                    alert(`Please fill in the ${key.replace('_', ' ')}`);
                    return;
                }
            }

            try {
                const res = await window.api("/api/instructors", {
                    method: "POST",
                    body: JSON.stringify(instructorData),
                    headers: { "Content-Type": "application/json" }
                });
                if (!res.success) throw new Error(res.error || "Failed to save instructor");
                alert("Instructor saved successfully!");
                window.Modal.hide();
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();
            } catch(err) {
                alert("Error: " + err.message);
            }
        });
    }, 50);
};

window.openInstructorEditModal = async function(id, data, tabRenderers, currentTab) {
    if(!window.Modal) return;
    if(!window.Modal.el) try { window.Modal.init(); } catch(err){ console.error(err); return; }

    const innerFormHTML = `
        <h2>Edit Instructor</h2>
        <div class="modal-content-form">
            <label>Name</label><input id="ins_name" type="text" value="${data.instructor_name || ''}" required>
            <label>Email</label><input id="ins_email" type="email" value="${data.email || ''}" required>
            <label>Mobile</label><input id="ins_mobile" type="text" value="${data.mobile_no || ''}" required>
            <label>Branch</label><input id="ins_branch" type="text" value="${data.branch || ''}" required>
            <label>Driver Licence</label><input id="ins_license" type="text" value="${data.drivers_license || ''}" required>
            <label>Adhar No</label><input id="ins_adhar" type="text" value="${data.adhar_no || ''}" required>
            <label>Address</label><textarea id="ins_address" required>${data.address || ''}</textarea>
            <button id="saveInstructor" class="btn primary">Save Changes</button>
        </div>
    `;

    window.Modal.setContent(innerFormHTML);
    window.Modal.show();

    setTimeout(() => {
        const saveBtn = document.getElementById("saveInstructor");
        if (!saveBtn) return;
        saveBtn.addEventListener("click", async () => {
            const instructorData = {
                instructor_name: document.getElementById("ins_name").value.trim(),
                email: document.getElementById("ins_email").value.trim(),
                mobile_no: document.getElementById("ins_mobile").value.trim(),
                branch: document.getElementById("ins_branch").value.trim(),
                drivers_license: document.getElementById("ins_license").value.trim(),
                adhar_no: document.getElementById("ins_adhar").value.trim(),
                address: document.getElementById("ins_address").value.trim(),
            };

            for (const [key, value] of Object.entries(instructorData)) {
                if (!value) {
                    alert(`Please fill in the ${key.replace('_', ' ')}`);
                    return;
                }
            }

            try {
                const res = await window.api(`/api/instructors/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(instructorData),
                    headers: { "Content-Type": "application/json" }
                });
                if (!res.success) throw new Error(res.error || "Failed to update instructor");
                alert("Instructor updated successfully!");
                window.Modal.hide();
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();
            } catch(err) {
                alert("Error: " + err.message);
            }
        });
    }, 50);
};
