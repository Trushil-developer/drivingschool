window.renderAppSettingsModule = async function (tableWrap) {

    // ── Fetch current settings (fail gracefully) ────────────────────────────────
    let settings = [];
    let serverError = null;

    try {
        const res = await window.api('/api/admin/app-settings');
        if (res?.success) {
            settings = res.settings ?? [];
        } else {
            serverError = res?.error || 'Could not load settings from server.';
        }
    } catch (err) {
        serverError = err?.message || 'Unexpected error loading settings.';
    }

    const sm = {};
    for (const s of settings) sm[s.key] = s;

    const val  = key => sm[key]?.value ?? '';
    const isOn = key => val(key) === 'true';

    // ── Render layout ───────────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="as-wrap">
            <div class="as-header">
                <h2 class="as-title">App Settings</h2>
                <p class="as-subtitle">Control app features and maintenance mode. Changes take effect immediately — drivers and students will see them on their next app launch.</p>
            </div>

            ${serverError ? `
            <div class="as-error-banner">
                ⚠️ Could not connect to server: <strong>${serverError}</strong><br>
                <span style="font-size:12px;opacity:.8">Deploy the latest server.js to EC2 and reload this page to enable controls.</span>
            </div>` : ''}

            <!-- Maintenance Mode -->
            <div class="as-section-label">GLOBAL</div>
            <div class="as-card as-card--maintenance ${isOn('maintenance_mode') ? 'as-card--maintenance-on' : ''}">
                <div class="as-item">
                    <div class="as-item-icon">🔧</div>
                    <div class="as-item-info">
                        <div class="as-item-title">Maintenance Mode</div>
                        <div class="as-item-desc">When <strong>ON</strong>, all drivers and students see a maintenance screen instead of the app. You can still manage everything here from the admin panel.</div>
                    </div>
                    <label class="as-toggle ${isOn('maintenance_mode') ? 'as-toggle--on' : ''}">
                        <input type="checkbox" id="toggle_maintenance_mode" ${isOn('maintenance_mode') ? 'checked' : ''} ${serverError ? 'disabled' : ''}>
                        <span class="as-slider"></span>
                    </label>
                </div>

                <div class="as-maintenance-extra" id="maintenanceExtra" style="${isOn('maintenance_mode') ? '' : 'display:none'}">
                    <label class="as-msg-label">Message shown to users</label>
                    <textarea class="as-msg-input" id="maintenanceMsg" rows="3" ${serverError ? 'disabled' : ''}>${val('maintenance_message') || 'We are currently performing maintenance. Please check back soon.'}</textarea>
                    <button class="as-msg-save-btn" id="saveMsgBtn" ${serverError ? 'disabled' : ''}>Save Message</button>
                    <span class="as-msg-saved" id="msgSavedLabel" style="display:none">Saved</span>
                </div>
            </div>

            <!-- Driver App Features -->
            <div class="as-section-label" style="margin-top:28px">DRIVER APP FEATURES</div>
            <div class="as-card">
                <div class="as-item" id="featureRow_leave_request">
                    <div class="as-item-icon">🗓</div>
                    <div class="as-item-info">
                        <div class="as-item-title">Leave Request</div>
                        <div class="as-item-desc">Drivers can submit leave requests from the app. When OFF, the button is hidden from all drivers.</div>
                    </div>
                    <label class="as-toggle ${isOn('feature_leave_request') ? 'as-toggle--on' : ''}">
                        <input type="checkbox" id="toggle_feature_leave_request" ${isOn('feature_leave_request') ? 'checked' : ''} ${serverError ? 'disabled' : ''}>
                        <span class="as-slider"></span>
                    </label>
                </div>
            </div>

            <!-- Connectivity -->
            <div class="as-section-label" style="margin-top:28px">CONNECTIVITY</div>
            <div class="as-card">
                <div class="as-item">
                    <div class="as-item-icon">📶</div>
                    <div class="as-item-info">
                        <div class="as-item-title">WiFi SSID — configured per branch</div>
                        <div class="as-item-desc">Each branch has its own WiFi SSID. Instructors can only clock in when connected to their branch's WiFi network. Set the SSID for each branch under <strong>School Setup → Branches → Edit</strong>.</div>
                    </div>
                </div>
            </div>

            <p class="as-hint">More features will appear here as they are added to the app.</p>
        </div>
    `;

    // Don't wire up events if server is unreachable — toggles are already disabled above
    if (serverError) return;

    // ── Helper: update one setting ──────────────────────────────────────────────
    async function updateSetting(key, value) {
        try {
            const res = await window.api(`/api/admin/app-settings/${encodeURIComponent(key)}`, {
                method: 'PATCH',
                body: { value: String(value) },
            });
            if (!res?.success) throw new Error(res?.error || 'Save failed');
        } catch (err) {
            alert(`Failed to save setting: ${err.message}`);
        }
    }

    // ── Wire: Maintenance Mode toggle ───────────────────────────────────────────
    document.getElementById('toggle_maintenance_mode').addEventListener('change', async function () {
        const on = this.checked;
        const label = this.closest('label');
        const card  = tableWrap.querySelector('.as-card--maintenance');
        label.classList.toggle('as-toggle--on', on);
        card.classList.toggle('as-card--maintenance-on', on);
        document.getElementById('maintenanceExtra').style.display = on ? '' : 'none';
        await updateSetting('maintenance_mode', on);
    });

    // ── Wire: Save maintenance message ──────────────────────────────────────────
    document.getElementById('saveMsgBtn').addEventListener('click', async function () {
        const msg = document.getElementById('maintenanceMsg').value.trim();
        this.disabled = true;
        this.textContent = 'Saving…';
        await updateSetting('maintenance_message', msg || 'We are currently performing maintenance. Please check back soon.');
        this.textContent = 'Save Message';
        this.disabled = false;
        const saved = document.getElementById('msgSavedLabel');
        saved.style.display = 'inline';
        setTimeout(() => { saved.style.display = 'none'; }, 2500);
    });

    // ── Wire: Feature toggles ───────────────────────────────────────────────────
    document.getElementById('toggle_feature_leave_request').addEventListener('change', async function () {
        this.closest('label').classList.toggle('as-toggle--on', this.checked);
        await updateSetting('feature_leave_request', this.checked);
    });

};
