window.renderRewardsTab = function(container) {
  return async function() {
    container.innerHTML = `<div class="loading-spinner">Loading rewards...</div>`;
    try {
      const res = await window.api('/api/rewards/summary');
      if (!res.success) throw new Error(res.error || 'Failed to load rewards');

      const instructors = res.instructors || [];
      if (!instructors.length) {
        container.innerHTML = '<div class="empty">No instructors found</div>';
        return;
      }

      container.innerHTML = `
        <table class="bookings-table">
          <thead>
            <tr>
              <th>Employee No</th>
              <th>Name</th>
              <th>Points Balance</th>
              <th>₹ Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${instructors.map(i => `
              <tr>
                <td>${i.employee_no || '-'}</td>
                <td>${i.instructor_name || '-'}</td>
                <td>${i.balance}</td>
                <td>₹${i.rupee_value.toFixed(2)}</td>
                <td><button class="btn view-rewards" data-id="${i.instructor_id}">View / Withdraw</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.querySelectorAll('.view-rewards').forEach(btn => {
        btn.addEventListener('click', () => openRewardsDetailModal(btn.dataset.id, container));
      });
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="error">${err.message}</div>`;
    }
  };
};

async function openRewardsDetailModal(instructorId, container) {
  if (!window.Modal) return;
  if (!window.Modal.el) window.Modal.init();

  window.Modal.setContent('<h2>Loading...</h2>');
  window.Modal.show();

  try {
    const res = await window.api(`/api/rewards/${instructorId}`);
    if (!res.success) throw new Error(res.error || 'Failed to load rewards');

    renderRewardsDetail(instructorId, res, container);
  } catch (err) {
    window.Modal.setContent(`<h2>Error</h2><div class="error">${err.message}</div>`);
  }
}

function renderRewardsDetail(instructorId, data, container) {
  const { instructor, balance, rupee_value, history } = data;

  const fmtDate = s => {
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
  };

  const historyRows = (history || []).length
    ? history.map(h => {
        const isEarn = h.points > 0;
        return `
          <tr>
            <td>${fmtDate(h.created_at)}</td>
            <td>${isEarn ? 'Trip Completed' : 'Withdrawn'}</td>
            <td style="color:${isEarn ? '#0f6e56' : '#a32d2d'};font-weight:600">${isEarn ? '+' : ''}${h.points}</td>
            <td>${h.rupee_value != null ? '₹' + Number(h.rupee_value).toFixed(2) : '-'}</td>
            <td>${h.note || '-'}</td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="empty">No history yet</td></tr>';

  const formHTML = `
    <h2>${instructor.instructor_name} — Rewards</h2>
    <div class="modal-content-form">
      <div style="display:flex;gap:24px;margin-bottom:16px;">
        <div><strong>Points Balance</strong><div style="font-size:22px;font-weight:700;">${balance}</div></div>
        <div><strong>₹ Value</strong><div style="font-size:22px;font-weight:700;">₹${rupee_value.toFixed(2)}</div></div>
      </div>

      <label>Withdraw Points</label>
      <input id="rw_points" type="number" min="1" step="1" placeholder="Points to withdraw">
      <label>Note (required)</label>
      <textarea id="rw_note" placeholder="e.g. Paid ₹50 cash bonus"></textarea>
      <button id="rw_withdraw_btn" class="btn primary">Withdraw</button>

      <h3 style="margin-top:20px;">History</h3>
      <table class="bookings-table">
        <thead>
          <tr><th>Date</th><th>Type</th><th>Points</th><th>₹</th><th>Note</th></tr>
        </thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>
  `;
  window.Modal.setContent(formHTML);

  setTimeout(() => {
    document.getElementById('rw_withdraw_btn').onclick = async () => {
      const points = Number(document.getElementById('rw_points').value);
      const note = document.getElementById('rw_note').value.trim();
      if (!Number.isInteger(points) || points <= 0) return alert('Enter a valid whole number of points');
      if (!note) return alert('Please enter a note for this withdrawal');

      try {
        const res = await window.api(`/api/rewards/${instructorId}/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points, note }),
        });
        if (!res.success) throw new Error(res.error || 'Failed to withdraw points');
        openRewardsDetailModal(instructorId, container);
        if (window.renderRewardsTab) window.renderRewardsTab(container)();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
  }, 50);
}
