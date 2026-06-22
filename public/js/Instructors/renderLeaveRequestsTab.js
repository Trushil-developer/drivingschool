window.renderLeaveRequestsTab = function(container) {
  return async function(filterStatus = '') {
    container.innerHTML = `<div class="loading-spinner">Loading leave requests...</div>`;
    try {
      const url = '/api/admin/leave-requests' + (filterStatus ? `?status=${filterStatus}` : '');
      const res = await window.api(url);
      if (!res.success) throw new Error(res.error || 'Failed to load');

      const reqs = res.requests || [];

      const filterBar = `
        <div class="leave-filter-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          ${['', 'Pending', 'Approved', 'Rejected'].map(s => `
            <button class="btn leave-filter-btn ${filterStatus === s ? 'btn-primary' : ''}" data-status="${s}">
              ${s || 'All'}
            </button>`).join('')}
        </div>`;

      if (!reqs.length) {
        container.innerHTML = filterBar + `<div class="empty">No leave requests found</div>`;
      } else {
        const rows = reqs.map(r => {
          const sameDay = r.leave_from === r.leave_to;
          const days = sameDay ? 1 :
            Math.round((new Date(r.leave_to) - new Date(r.leave_from)) / 86400000) + 1;
          const fmtD = s => {
            const d = new Date(s); if (isNaN(d)) return s;
            return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
          };
          const dateStr = sameDay ? fmtD(r.leave_from) : `${fmtD(r.leave_from)} → ${fmtD(r.leave_to)}`;
          const statusCls = r.status === 'Approved' ? 'status-active' : r.status === 'Rejected' ? 'status-expired' : 'status-hold';
          const actions = r.status === 'Pending'
            ? `<button class="btn leave-approve" data-id="${r.id}" style="background:#0f6e56;color:#fff;margin-right:4px">Approve</button>
               <button class="btn leave-reject"  data-id="${r.id}" style="background:#a32d2d;color:#fff">Reject</button>`
            : `<span style="color:#9ba3b2;font-size:13px">—</span>`;
          return `
            <tr>
              <td>${r.employee_no || '—'}</td>
              <td>${r.instructor_name || '—'}</td>
              <td>${r.branch || '—'}</td>
              <td>${dateStr}${days > 1 ? ` <span style="color:#9ba3b2">(${days} days)</span>` : ''}</td>
              <td>${r.leave_type}</td>
              <td>${r.reason || '—'}</td>
              <td><span class="status-badge ${statusCls}">${r.status}</span></td>
              <td>${actions}</td>
            </tr>`;
        }).join('');

        container.innerHTML = filterBar + `
          <table class="bookings-table">
            <thead>
              <tr>
                <th>Emp No</th><th>Name</th><th>Branch</th>
                <th>Date(s)</th><th>Type</th><th>Reason</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

      // Filter buttons
      container.querySelectorAll('.leave-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.renderLeaveRequestsTab(container)(btn.dataset.status);
        });
      });

      // Approve / Reject
      const doAction = async (id, status) => {
        try {
          const r = await window.api(`/api/admin/leave-requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
          if (!r.success) throw new Error(r.error || 'Failed');
          window.renderLeaveRequestsTab(container)(filterStatus);
        } catch (e) { alert('Error: ' + e.message); }
      };

      container.querySelectorAll('.leave-approve').forEach(b =>
        b.addEventListener('click', () => doAction(b.dataset.id, 'Approved'))
      );
      container.querySelectorAll('.leave-reject').forEach(b =>
        b.addEventListener('click', () => doAction(b.dataset.id, 'Rejected'))
      );

    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="error">${err.message}</div>`;
    }
  };
};
