import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminCommissionService } from '../../services/adminCommissionService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const statusLabels = {
  pending_collection: 'Chờ thu',
  collected: 'Đã thu',
  paid_to_broker: 'Đã trả broker',
  cancelled: 'Đã hủy',
};

const statusOptions = [
  ['pending_collection', 'Chờ thu'],
  ['collected', 'Đã thu'],
  ['paid_to_broker', 'Đã trả broker'],
  ['cancelled', 'Hủy'],
];

const AdminCommissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const dialog = useDialog();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminCommissionService.list();
      setCommissions(data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không tải được hoa hồng.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => commissions.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + Number(item.amount || 0);
    return acc;
  }, {}), [commissions]);
  const totalPages = Math.max(Math.ceil(commissions.length / pageSize), 1);
  const pagedCommissions = commissions.slice((page - 1) * pageSize, page * pageSize);
  const showingFrom = commissions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, commissions.length);

  const changeStatus = async (commission, status) => {
    const note = await dialog.prompt({
      title: status === 'collected' ? 'Xác nhận đã thu hoa hồng' : status === 'paid_to_broker' ? 'Xác nhận đã trả broker' : 'Cập nhật hoa hồng',
      label: 'Ghi chú',
      placeholder: 'VD: Đã thu tiền mặt, đã chuyển khoản cho broker...',
      required: false,
      confirmText: 'Cập nhật',
    });
    if (note === null) return;
    setBusyId(commission.id);
    try {
      await adminCommissionService.updateStatus(commission.id, status, note);
      await load();
      toast.success('Đã cập nhật hoa hồng.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật hoa hồng thất bại.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-commissions">
      <div className="ar-header">
        <h2>Hoa hồng môi giới</h2>
        <span className="badge badge-admin">{commissions.length} khoản</span>
      </div>

      <div className="admin-ops-stats" style={{ marginBottom: 16 }}>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.pending_collection || 0)}</strong><span>Chờ thu</span></div>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.collected || 0)}</strong><span>Đã thu</span></div>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.paid_to_broker || 0)}</strong><span>Đã trả broker</span></div>
      </div>

      {loading ? <p>Đang tải hoa hồng...</p> : !commissions.length ? (
        <div className="empty-state"><h2>Chưa có hoa hồng</h2><p>Khi broker chốt lead, hoa hồng sẽ hiển thị tại đây.</p></div>
      ) : (
        <>
          <div className="commission-table-wrap">
            <table className="commission-table">
              <thead>
                <tr>
                  <th>Hoa hong</th>
                  <th>Broker</th>
                  <th>Lead / phong</th>
                  <th>Ngay</th>
                  <th>Ghi chu</th>
                  <th>Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {pagedCommissions.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge badge-${item.status === 'paid_to_broker' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{statusLabels[item.status] || item.status}</span>
                      <strong className="commission-amount">{formatCurrency(item.amount)}</strong>
                    </td>
                    <td>
                      <strong className="table-person">{item.broker?.full_name || 'Broker'}</strong>
                      <span className="table-muted">{item.broker?.email || '-'}</span>
                    </td>
                    <td>
                      <strong className="table-person">{item.lead?.full_name || 'Lead'}</strong>
                      <span className="table-muted">{item.room?.title || 'Phong'}</span>
                    </td>
                    <td>
                      <span className="table-muted">Tao: {formatDate(item.created_at)}</span>
                      {item.collected_at && <span className="table-muted">Thu: {formatDate(item.collected_at)}</span>}
                      {item.paid_at && <span className="table-muted">Tra: {formatDate(item.paid_at)}</span>}
                    </td>
                    <td>{item.note ? <span className="table-muted">{item.note}</span> : <span className="table-muted">-</span>}</td>
                    <td>
                      <div className="table-actions">
                        {statusOptions.filter(([value]) => value !== item.status).map(([value, label]) => (
                          <button key={value} className="btn btn-sm" disabled={busyId === item.id} onClick={() => changeStatus(item, value)}>{label}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Hien thi {showingFrom}-{showingTo} / {commissions.length} khoan</span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>Truoc</button>
              <strong>Trang {page}/{totalPages}</strong>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Sau</button>
            </div>
          </div>
        </>
      )}
      <style>{`
        .commission-table-wrap { width:100%;overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-card); }
        .commission-table { width:100%;min-width:980px;border-collapse:collapse; }
        .commission-table th { text-align:left;padding:11px 14px;background:var(--bg-surface);border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em; }
        .commission-table td { padding:13px 14px;border-bottom:1px solid var(--border-subtle);vertical-align:top;color:var(--text-secondary);font-size:13px; }
        .commission-table tr:last-child td { border-bottom:0; }
        .commission-table tr:hover td { background:var(--bg-hover); }
        .commission-amount, .table-person { display:block;color:var(--text-primary);font-weight:800;margin-top:5px; }
        .table-muted { display:block;color:var(--text-muted);font-size:12px;line-height:1.45; }
        .table-actions { display:flex;gap:6px;flex-wrap:wrap;min-width:220px; }
        .table-pagination { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 2px 0;color:var(--text-secondary);font-size:13px; }
        .table-pagination > div { display:flex;align-items:center;gap:10px; }
        .table-pagination strong { color:var(--text-primary);font-size:13px; }
        @media(max-width:700px){ .table-pagination{align-items:flex-start;flex-direction:column;} }
      `}</style>
    </div>
  );
};

export default AdminCommissions;
