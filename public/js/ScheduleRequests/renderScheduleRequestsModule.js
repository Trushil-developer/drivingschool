window.renderScheduleRequestsModule = function(container) {
  return async function(filterStatus = '') {
    container.innerHTML = `<div class="loading-spinner">Loading schedule requests...</div>`;
    try {
      const url = '/api/admin/schedule-requests' + (filterStatus ? `?status=${filterStatus}` : '');
      const res = await window.api(url);
      if (!res.success) throw new Error(res.error || 'Failed to load');

      const reqs = res.requests || [];

      const filterBar = `
        <div class="leave-filter-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          ${['', 'Pending', 'Approved', 'Rejected'].map(s => `
            <button class="btn schedule-request-filter-btn ${filterStatus === s ? 'btn-primary' : ''}" data-status="${s}">
              ${s || 'All'}
            </button>`).join('')}
        </div>`;

      const fmtD = s => {
        const d = new Date(s); if (isNaN(d)) return s;
        return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
      };
      const fmtT = t => {
        if (!t) return '—';
        const [hStr, mStr] = t.split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mStr ?? '00'} ${ampm}`;
      };

      if (!reqs.length) {
        container.innerHTML = filterBar + `<div class="empty">No schedule requests found</div>`;
      } else {
        const rows = reqs.map(r => {
          const statusCls = r.status === 'Approved' ? 'status-active' : r.status === 'Rejected' ? 'status-expired' : 'status-hold';
          const typeColor = r.request_type === 'Cancel' ? '#a32d2d' : '#185fa5';
          const timeStr = r.request_type === 'Replacement'
            ? `${fmtT(r.original_time)} → ${fmtT(r.new_time)}`
            : fmtT(r.original_time);
          const actions = r.status === 'Pending'
            ? `<button class="btn schedule-request-approve" data-id="${r.id}" style="background:#0f6e56;color:#fff;margin-right:4px">Approve</button>
               <button class="btn schedule-request-reject"  data-id="${r.id}" style="background:#a32d2d;color:#fff">Reject</button>`
            : `<span style="color:#9ba3b2;font-size:13px">—</span>`;
          const noteRow = r.status === 'Rejected' && r.admin_note ? ` <div style="color:#9ba3b2;font-size:12px;margin-top:2px">Note: ${r.admin_note}</div>` : '';
          return `
            <tr>
              <td>${r.customer_name || '—'}</td>
              <td>${r.branch || '—'}${r.car_name ? ` · ${r.car_name}` : ''}</td>
              <td style="color:${typeColor};font-weight:600">${r.request_type}</td>
              <td>${fmtD(r.occurrence_date)}<br><span style="color:#9ba3b2">${timeStr}</span></td>
              <td>${r.reason || '—'}${noteRow}</td>
              <td><span class="status-badge ${statusCls}">${r.status}</span></td>
              <td>${actions}</td>
            </tr>`;
        }).join('');

        container.innerHTML = filterBar + `
          <table class="bookings-table">
            <thead>
              <tr>
                <th>Student</th><th>Branch / Car</th><th>Type</th>
                <th>Date · Time</th><th>Reason</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

      // Filter buttons
      container.querySelectorAll('.schedule-request-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.renderScheduleRequestsModule(container)(btn.dataset.status);
        });
      });

      // Approve / Reject
      const doAction = async (id, status) => {
        try {
          let admin_note;
          if (status === 'Rejected') {
            admin_note = window.prompt('Rejection reason (optional):') || undefined;
          }
          const r = await window.api(`/api/admin/schedule-requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, admin_note }),
          });
          if (!r.success) throw new Error(r.error || 'Failed');
          window.renderScheduleRequestsModule(container)(filterStatus);
        } catch (e) { alert('Error: ' + e.message); }
      };

      container.querySelectorAll('.schedule-request-approve').forEach(b =>
        b.addEventListener('click', () => doAction(b.dataset.id, 'Approved'))
      );
      container.querySelectorAll('.schedule-request-reject').forEach(b =>
        b.addEventListener('click', () => doAction(b.dataset.id, 'Rejected'))
      );

    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="error">${err.message}</div>`;
    }
  };
};
