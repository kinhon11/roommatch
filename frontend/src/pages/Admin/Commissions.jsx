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
        <div className="pending-list">
          {commissions.map(item => (
            <article className="pending-card" key={item.id}>
              <div className="pending-card__body">
                <span className={`badge badge-${item.status === 'paid_to_broker' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{statusLabels[item.status] || item.status}</span>
                <h3 className="pending-card__title">{formatCurrency(item.amount)}</h3>
                <p className="pending-card__meta">Broker: {item.broker?.full_name || item.broker?.email || 'Broker'}</p>
                <p className="pending-card__meta">Lead: {item.lead?.full_name || 'Lead'} · Phòng: {item.room?.title || 'Phòng'}</p>
                <p className="pending-card__date">Tạo: {formatDate(item.created_at)}{item.collected_at ? ` · Thu: ${formatDate(item.collected_at)}` : ''}{item.paid_at ? ` · Trả: ${formatDate(item.paid_at)}` : ''}</p>
                {item.note && <p className="pending-card__date">Ghi chú: {item.note}</p>}
              </div>
              <div className="pending-card__actions">
                {statusOptions.filter(([value]) => value !== item.status).map(([value, label]) => (
                  <button key={value} className="btn btn-sm" disabled={busyId === item.id} onClick={() => changeStatus(item, value)}>{label}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCommissions;
