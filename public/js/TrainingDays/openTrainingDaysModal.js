// openTrainingDaysModal.js

/**
 * Opens the "Add Training Days" modal and handles saving new entries.
 * @param {Object} tabRenderers - The tab renderer map from admin.js
 * @param {string} currentTab - The current active tab ("trainingDays")
 */
function openTrainingDaysModal(tabRenderers, currentTab) {
    if (!window.Modal) return;
    if (!window.Modal.el) {
        try { window.Modal.init(); } 
        catch(err) { console.error(err); return; }
    }

    const modalContent = `
        <h2>Add Training Days</h2>
        <div class="modal-content-form">
            <label>Days</label>
            <input id="td_days" type="number" placeholder="Enter number of days" min="1" required>
            <button id="saveTrainingDays" class="btn primary" style="margin-top: 15px;">Save</button>
        </div>
    `;

    window.Modal.setContent(modalContent);
    window.Modal.show();

    setTimeout(() => {
        const saveBtn = document.getElementById("saveTrainingDays");
        if (!saveBtn) return;

        saveBtn.addEventListener("click", async () => {
            const daysValue = document.getElementById("td_days").value.trim();
            const days = Number(daysValue);

            if (!daysValue || isNaN(days) || days <= 0) {
                return alert("Please enter a valid number of days");
            }

            try {
                const res = await window.api("/api/training-days", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ days })
                });

                if (!res.success) throw new Error(res.error || "Failed to save training days");

                alert("Training days added successfully!");
                window.Modal.hide();

                // Refresh the training days table
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();

            } catch (err) {
                alert("Error: " + err.message);
            }
        });
    }, 50);
}

// Expose globally for admin.js to call
window.openTrainingDaysModal = openTrainingDaysModal;
