import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminCommissionService } from '../../services/adminCommissionService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const statusLabels = {
  pending_collection: 'Cho thu',
  collected: 'Da thu',
  paid_to_broker: 'Da tra broker',
  cancelled: 'Da huy',
};

const statusOptions = [
  ['pending_collection', 'Cho thu'],
  ['collected', 'Da thu'],
  ['paid_to_broker', 'Da tra broker'],
  ['cancelled', 'Huy'],
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
      toast.error(err.response?.data?.error || 'Khong tai duoc hoa hong.');
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
      title: status === 'collected' ? 'Xac nhan da thu hoa hong' : status === 'paid_to_broker' ? 'Xac nhan da tra broker' : 'Cap nhat hoa hong',
      label: 'Ghi chu',
      placeholder: 'VD: Da thu tien mat, da chuyen khoan cho broker...',
      required: false,
      confirmText: 'Cap nhat',
    });
    if (note === null) return;
    setBusyId(commission.id);
    try {
      await adminCommissionService.updateStatus(commission.id, status, note);
      await load();
      toast.success('Da cap nhat hoa hong.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cap nhat hoa hong that bai.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-commissions">
      <div className="ar-header">
        <h2>Hoa hong moi gioi</h2>
        <span className="badge badge-admin">{commissions.length} khoan</span>
      </div>

      <div className="admin-ops-stats" style={{ marginBottom: 16 }}>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.pending_collection || 0)}</strong><span>Cho thu</span></div>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.collected || 0)}</strong><span>Da thu</span></div>
        <div className="admin-ops-stat"><strong>{formatCurrency(totals.paid_to_broker || 0)}</strong><span>Da tra broker</span></div>
      </div>

      {loading ? <p>Dang tai hoa hong...</p> : !commissions.length ? (
        <div className="empty-state"><h2>Chua co hoa hong</h2><p>Khi broker chot lead, hoa hong se hien thi tai day.</p></div>
      ) : (
        <div className="pending-list">
          {commissions.map(item => (
            <article className="pending-card" key={item.id}>
              <div className="pending-card__body">
                <span className={`badge badge-${item.status === 'paid_to_broker' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{statusLabels[item.status] || item.status}</span>
                <h3 className="pending-card__title">{formatCurrency(item.amount)}</h3>
                <p className="pending-card__meta">Broker: {item.broker?.full_name || item.broker?.email || 'Broker'}</p>
                <p className="pending-card__meta">Lead: {item.lead?.full_name || 'Lead'} · Phong: {item.room?.title || 'Phong'}</p>
                <p className="pending-card__date">Tao: {formatDate(item.created_at)}{item.collected_at ? ` · Thu: ${formatDate(item.collected_at)}` : ''}{item.paid_at ? ` · Tra: ${formatDate(item.paid_at)}` : ''}</p>
                {item.note && <p className="pending-card__date">Ghi chu: {item.note}</p>}
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
