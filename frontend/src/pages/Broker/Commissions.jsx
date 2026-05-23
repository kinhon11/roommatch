import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { brokerService } from '../../services/brokerService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';

const statusLabels = {
  pending_collection: 'Chờ thu',
  collected: 'Đã thu',
  paid_to_broker: 'Đã trả broker',
  cancelled: 'Đã hủy',
};

const BrokerCommissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await brokerService.listCommissions();
        setCommissions(data || []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Không tải được hoa hồng.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const totals = useMemo(() => commissions.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + Number(item.amount || 0);
    return acc;
  }, {}), [commissions]);

  return (
    <div className="broker-commissions container">
      <header className="bc-head">
        <div>
          <h1>Hoa hồng môi giới</h1>
          <p>Theo dõi các khoản hoa hồng sau khi lead được chốt.</p>
        </div>
        <Link to="/broker/leads" className="btn btn-secondary">Quản lý lead</Link>
      </header>

      <section className="bc-stats">
        <div><strong>{formatCurrency(totals.pending_collection || 0)}</strong><span>Chờ thu từ khách/chủ nhà</span></div>
        <div><strong>{formatCurrency(totals.collected || 0)}</strong><span>Công ty đã thu</span></div>
        <div><strong>{formatCurrency(totals.paid_to_broker || 0)}</strong><span>Đã trả broker</span></div>
      </section>

      {loading ? <p>Đang tải hoa hồng...</p> : !commissions.length ? (
        <div className="bc-empty">
          <h2>Chưa có hoa hồng</h2>
          <p>Khi broker chuyển lead sang trạng thái Đã chốt, hệ thống sẽ tạo hoa hồng cho admin xử lý.</p>
        </div>
      ) : (
        <div className="bc-list">
          {commissions.map(item => (
            <article className="bc-card" key={item.id}>
              <div>
                <span className={`bc-badge bc-badge--${item.status}`}>{statusLabels[item.status] || item.status}</span>
                <h2>{formatCurrency(item.amount)}</h2>
                <p>{item.lead?.full_name || 'Lead'} · {item.lead?.phone || item.tenant?.phone || 'Chưa có SĐT'}</p>
                <p>{item.room?.title || 'Phòng'}{item.room?.address ? `, ${item.room.address}` : ''}</p>
              </div>
              <div className="bc-meta">
                <span>Tạo: {formatDate(item.created_at)}</span>
                {item.collected_at && <span>Đã thu: {formatDate(item.collected_at)}</span>}
                {item.paid_at && <span>Đã trả: {formatDate(item.paid_at)}</span>}
                {item.note && <span>Ghi chú: {item.note}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .broker-commissions { padding:32px 0 80px; }
        .bc-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
        .bc-head h1 { font-size:26px; font-weight:800; color:var(--text-primary); }
        .bc-head p { color:var(--text-secondary); margin-top:4px; }
        .bc-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px; }
        .bc-stats div, .bc-card, .bc-empty { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:18px; }
        .bc-stats strong { display:block; font-size:22px; color:var(--text-primary); margin-bottom:4px; }
        .bc-stats span, .bc-meta, .bc-card p, .bc-empty p { color:var(--text-secondary); font-size:14px; }
        .bc-list { display:flex; flex-direction:column; gap:14px; }
        .bc-card { display:flex; justify-content:space-between; gap:16px; }
        .bc-card h2 { font-size:22px; margin:8px 0; color:var(--text-primary); }
        .bc-meta { display:flex; flex-direction:column; gap:6px; text-align:right; min-width:220px; }
        .bc-badge { display:inline-flex; padding:4px 10px; border-radius:var(--radius-full); font-size:12px; font-weight:800; background:#fef3c7; color:#92400e; }
        .bc-badge--paid_to_broker { background:#dcfce7; color:#166534; }
        .bc-badge--cancelled { background:#fee2e2; color:#991b1b; }
        @media (max-width: 768px) {
          .bc-head, .bc-card { flex-direction:column; }
          .bc-stats { grid-template-columns:1fr; }
          .bc-meta { text-align:left; min-width:0; }
        }
      `}</style>
    </div>
  );
};

export default BrokerCommissions;
