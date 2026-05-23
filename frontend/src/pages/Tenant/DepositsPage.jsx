import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { depositService } from '../../services/depositService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const statusLabels = {
  pending_payment: 'Ch? thanh to?n',
  paid: '?? c?c / gi? ph?ng',
  cancelled: '?? h?y',
  refunded: '?? ho?n c?c',
};

const statusClass = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'muted',
  refunded: 'info',
};

const DepositsPage = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const dialog = useDialog();
  const toast = useToast();

  const loadDeposits = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await depositService.list();
      setDeposits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Kh?ng t?i ???c danh s?ch c?c ph?ng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const counts = useMemo(() => deposits.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {}), [deposits]);

  const updateStatus = async (deposit, status) => {
    let note = '';
    if (status === 'paid') {
      const paidNote = await dialog.prompt({
        title: 'Xác nhận đã nhận cọc',
        label: 'Ghi chú tùy chọn',
        placeholder: 'Ví dụ: Đã nhận chuyển khoản...',
        required: false,
        confirmText: 'Xác nhận',
      });
      if (paidNote === null) return;
      note = paidNote;
    } else {
      note = await dialog.prompt({
        title: status === 'cancelled' ? 'Hủy yêu cầu cọc' : 'Hoàn cọc',
        label: status === 'cancelled' ? 'Lý do hủy' : 'Lý do hoàn cọc',
        placeholder: 'Nhập lý do để lưu vào lịch sử...',
        confirmText: status === 'cancelled' ? 'Hủy yêu cầu' : 'Hoàn cọc',
        tone: status === 'cancelled' ? 'danger' : 'primary',
      });
      if (!note?.trim()) return;
    }

    setBusyId(deposit.id);
    try {
      await depositService.updateStatus(deposit.id, status, note);
      await loadDeposits();
      toast.success('Cập nhật cọc phòng thành công.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật cọc phòng thất bại.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="deposits-page container"><p>?ang t?i c?c ph?ng...</p><style>{styles}</style></div>;
  }

  return (
    <div className="deposits-page container">
      <div className="deposits-header">
        <div>
          <h1>C?c ph?ng</h1>
          <p>{user?.role === 'landlord' ? 'Qu?n l? y?u c?u c?c v? gi? ph?ng.' : 'Theo d?i c?c y?u c?u c?c ph?ng c?a b?n.'}</p>
        </div>
        <div className="deposit-stats">
          <span>Ch? thanh to?n: <strong>{counts.pending_payment || 0}</strong></span>
          <span>?? c?c: <strong>{counts.paid || 0}</strong></span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!deposits.length ? (
        <div className="empty-state">
          <h2>Ch?a c? y?u c?u c?c ph?ng</h2>
          <p>{user?.role === 'tenant' ? 'Khi ???c ch?p nh?n ? gh?p ho?c c? l?ch h?n h?p l?, b?n c? th? g?i y?u c?u c?c t? trang chi ti?t ph?ng.' : 'Y?u c?u c?c c?a tenant s? hi?n th? t?i ??y.'}</p>
          {user?.role === 'tenant' && <Link to="/rooms" className="btn btn-primary">T?m ph?ng</Link>}
        </div>
      ) : (
        <div className="deposit-list">
          {deposits.map((deposit) => (
            <article key={deposit.id} className="deposit-card">
              <div className="deposit-card__main">
                <span className={`deposit-badge deposit-badge--${statusClass[deposit.status] || 'muted'}`}>
                  {statusLabels[deposit.status] || deposit.status}
                </span>
                <h2><Link to={`/rooms/${deposit.room_id}`}>{deposit.room?.title || 'Ph?ng'}</Link></h2>
                <p className="deposit-meta">{deposit.room?.address}, {deposit.room?.city}</p>
                <p className="deposit-amount">{formatCurrency(deposit.amount)}</p>
                <p className="deposit-meta">
                  {user?.role === 'landlord'
                    ? `Tenant: ${deposit.tenant?.full_name || deposit.tenant?.email || 'Tenant'}`
                    : `Ch? nh?: ${deposit.landlord?.full_name || deposit.landlord?.email || 'Landlord'}`}
                </p>
                {deposit.note && <p className="deposit-note">Ghi ch? tenant: {deposit.note}</p>}
                {deposit.landlord_note && <p className="deposit-note">Ghi ch? landlord: {deposit.landlord_note}</p>}
                {(deposit.cancel_reason || deposit.refund_reason) && (
                  <p className="deposit-note">L? do: {deposit.cancel_reason || deposit.refund_reason}</p>
                )}
              </div>

              <div className="deposit-card__side">
                <p>T?o l?c: {formatDate(deposit.created_at)}</p>
                {deposit.paid_at && <p>?? c?c: {formatDate(deposit.paid_at)}</p>}
                {deposit.status === 'pending_payment' && user?.role === 'tenant' && (
                  <button className="btn btn-ghost btn-sm" disabled={busyId === deposit.id} onClick={() => updateStatus(deposit, 'cancelled')}>
                    H?y y?u c?u
                  </button>
                )}
                {deposit.status === 'pending_payment' && user?.role === 'landlord' && (
                  <>
                    <button className="btn btn-primary btn-sm" disabled={busyId === deposit.id} onClick={() => updateStatus(deposit, 'paid')}>
                      X?c nh?n ?? nh?n c?c
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busyId === deposit.id} onClick={() => updateStatus(deposit, 'cancelled')}>
                      T? ch?i / h?y
                    </button>
                  </>
                )}
                {deposit.status === 'paid' && ['landlord', 'admin'].includes(user?.role) && (
                  <button className="btn btn-ghost btn-sm" disabled={busyId === deposit.id} onClick={() => updateStatus(deposit, 'refunded')}>
                    Ho?n c?c
                  </button>
                )}
              </div>

              {deposit.transactions?.length > 0 && (
                <div className="deposit-history">
                  <strong>L?ch s?</strong>
                  {deposit.transactions.map((tx) => (
                    <span key={tx.id}>{formatDate(tx.created_at)}: {tx.from_status || 'new'} {'->'} {tx.to_status}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .deposits-page { padding: 32px 0 64px; }
  .deposits-header { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:24px; }
  .deposits-header h1 { font-size:28px; font-weight:800; color:var(--text-primary); }
  .deposits-header p, .deposit-meta, .deposit-card__side, .deposit-history { color:var(--text-secondary); font-size:13px; }
  .deposit-stats { display:flex; gap:10px; flex-wrap:wrap; }
  .deposit-stats span { padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); }
  .deposit-list { display:flex; flex-direction:column; gap:14px; }
  .deposit-card { display:grid; grid-template-columns:1fr 220px; gap:18px; padding:18px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); }
  .deposit-card h2 { font-size:18px; font-weight:700; margin:8px 0 4px; }
  .deposit-card h2 a { color:var(--text-primary); }
  .deposit-amount { color:var(--primary); font-size:20px; font-weight:800; margin:8px 0; }
  .deposit-note { margin-top:6px; color:var(--text-secondary); font-size:13px; }
  .deposit-card__side { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
  .deposit-badge { display:inline-flex; padding:4px 10px; border-radius:var(--radius-full); font-size:12px; font-weight:700; }
  .deposit-badge--warning { background:rgba(245,158,11,.1); color:#b45309; }
  .deposit-badge--success { background:rgba(16,185,129,.1); color:#047857; }
  .deposit-badge--info { background:rgba(59,130,246,.1); color:#1d4ed8; }
  .deposit-badge--muted { background:var(--bg-hover); color:var(--text-muted); }
  .deposit-history { grid-column:1 / -1; display:flex; flex-direction:column; gap:4px; padding-top:12px; border-top:1px solid var(--border); }
  .empty-state { padding:36px; border:1px dashed var(--border); border-radius:var(--radius-md); background:var(--bg-warm); text-align:center; }
  .empty-state h2 { font-size:18px; font-weight:700; margin-bottom:8px; }
  .empty-state p { color:var(--text-secondary); max-width:560px; margin:0 auto 16px; }
  .alert-error { padding:12px 14px; border-radius:var(--radius-sm); background:rgba(239,68,68,.08); color:var(--danger); margin-bottom:16px; }
  @media(max-width:720px) {
    .deposits-header, .deposit-stats { align-items:flex-start; flex-direction:column; }
    .deposit-card { grid-template-columns:1fr; }
  }
`;

export default DepositsPage;
