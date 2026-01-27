// ========================
// ADD PACKAGE MODAL
// ========================
window.openPackageAddModal = function (tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            const formHTML = `
                <h2>Add New Package</h2>
                <div class="modal-content-form package-modal">

                    <label>Badge (Optional)</label>
                    <input id="badge" type="text" placeholder="e.g., Best for Beginners, Most Popular">

                    <label>Title *</label>
                    <input id="title" type="text" placeholder="e.g., Beginner Driving Course">

                    <label>Description</label>
                    <textarea id="description" rows="3" placeholder="Brief description of the package"></textarea>

                    <label>Practical Sessions</label>
                    <input id="practical_sessions" type="number" placeholder="e.g., 21">

                    <label>Session Duration</label>
                    <input id="session_duration" type="text" placeholder="e.g., 30 Minutes">

                    <label>Daily Distance</label>
                    <input id="daily_distance" type="text" placeholder="e.g., 7-8 km">

                    <label>Extra Features (one per line)</label>
                    <textarea id="extra_features" rows="5" placeholder="Basic Driving Skills&#10;Traffic Rules & Safety&#10;No Experience Required"></textarea>

                    <button id="savePackage" class="btn primary">Save Package</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Save handler
            document.getElementById("savePackage").onclick = async () => {
                const title = document.getElementById("title").value.trim();
                const badge = document.getElementById("badge").value.trim();
                const description = document.getElementById("description").value.trim();
                const practical_sessions = document.getElementById("practical_sessions").value.trim();
                const session_duration = document.getElementById("session_duration").value.trim();
                const daily_distance = document.getElementById("daily_distance").value.trim();
                const extraFeaturesText = document.getElementById("extra_features").value.trim();

                if (!title) return alert("Title is required");

                // Parse extra features from textarea (one per line)
                const extra_features = {};
                if (extraFeaturesText) {
                    extraFeaturesText.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .forEach((line, index) => {
                            extra_features[`feature_${index + 1}`] = line;
                        });
                }

                const payload = {
                    badge: badge || null,
                    title,
                    description: description || null,
                    practical_sessions: practical_sessions ? parseInt(practical_sessions) : null,
                    session_duration: session_duration || null,
                    daily_distance: daily_distance || null,
                    extra_features: Object.keys(extra_features).length > 0 ? extra_features : null
                };

                try {
                    const res = await window.api("/api/packages", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to add package");

                    alert("Package added successfully!");
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
// EDIT PACKAGE MODAL
// ========================
window.openPackageEditModal = function (id, data, tabRenderers, currentTab) {
    return async function () {
        try {
            if (!window.Modal) throw new Error("Modal not initialized");
            if (!window.Modal.el) window.Modal.init();

            // Convert extra_features object/array to text (one per line)
            let extraFeaturesText = '';
            if (data.extra_features) {
                const features = Array.isArray(data.extra_features)
                    ? data.extra_features
                    : Object.values(data.extra_features);
                extraFeaturesText = features.join('\n');
            }

            const formHTML = `
                <h2>Edit Package</h2>
                <div class="modal-content-form package-modal">

                    <label>Badge (Optional)</label>
                    <input id="badge" type="text" value="${data.badge || ''}" placeholder="e.g., Best for Beginners, Most Popular">

                    <label>Title *</label>
                    <input id="title" type="text" value="${data.title || ''}" placeholder="e.g., Beginner Driving Course">

                    <label>Description</label>
                    <textarea id="description" rows="3" placeholder="Brief description of the package">${data.description || ''}</textarea>

                    <label>Practical Sessions</label>
                    <input id="practical_sessions" type="number" value="${data.practical_sessions || ''}" placeholder="e.g., 21">

                    <label>Session Duration</label>
                    <input id="session_duration" type="text" value="${data.session_duration || ''}" placeholder="e.g., 30 Minutes">

                    <label>Daily Distance</label>
                    <input id="daily_distance" type="text" value="${data.daily_distance || ''}" placeholder="e.g., 7-8 km">

                    <label>Extra Features (one per line)</label>
                    <textarea id="extra_features" rows="5" placeholder="Basic Driving Skills&#10;Traffic Rules & Safety&#10;No Experience Required">${extraFeaturesText}</textarea>

                    <button id="savePackage" class="btn primary">Save Changes</button>
                </div>
            `;

            window.Modal.setContent(formHTML);
            window.Modal.show();

            // Save handler
            document.getElementById("savePackage").onclick = async () => {
                const title = document.getElementById("title").value.trim();
                const badge = document.getElementById("badge").value.trim();
                const description = document.getElementById("description").value.trim();
                const practical_sessions = document.getElementById("practical_sessions").value.trim();
                const session_duration = document.getElementById("session_duration").value.trim();
                const daily_distance = document.getElementById("daily_distance").value.trim();
                const extraFeaturesText = document.getElementById("extra_features").value.trim();

                if (!title) return alert("Title is required");

                // Parse extra features from textarea (one per line)
                const extra_features = {};
                if (extraFeaturesText) {
                    extraFeaturesText.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .forEach((line, index) => {
                            extra_features[`feature_${index + 1}`] = line;
                        });
                }

                const payload = {
                    badge: badge || null,
                    title,
                    description: description || null,
                    practical_sessions: practical_sessions ? parseInt(practical_sessions) : null,
                    session_duration: session_duration || null,
                    daily_distance: daily_distance || null,
                    extra_features: Object.keys(extra_features).length > 0 ? extra_features : null
                };

                try {
                    const res = await window.api(`/api/packages/${id}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!res.success) throw new Error(res.error || "Failed to update package");

                    alert("Package updated successfully!");
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
