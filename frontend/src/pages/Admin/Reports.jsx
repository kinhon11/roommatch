import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../../services/reportService';
import { formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending:   { label: 'Chờ xử lý', cls: 'badge-pending'  },
  resolved:  { label: 'Đã xử lý',  cls: 'badge-approved' },
  dismissed: { label: 'Bỏ qua',    cls: 'badge-rejected' },
};

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getAllReports({ status: filter === 'all' ? undefined : filter });
      setReports(res.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id, status) => {
    setProcessing(id);
    try {
      await reportService.resolveReport(id, status);
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* resolve/dismiss may fail silently */ } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>🚨 Quản lý báo cáo</h2>
        <div style={{ display:'flex', gap:6 }}>
          {['pending','resolved','dismissed','all'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding:'6px 14px', borderRadius:'var(--radius-md)', border:'none',
                fontSize:13, fontWeight:600, cursor:'pointer',
                background: filter === s ? 'var(--primary)' : 'var(--bg-hover)',
                color: filter === s ? '#fff' : 'var(--text-secondary)',
                transition:'var(--transition)',
              }}
            >
              {s === 'pending' ? '⏳ Chờ' : s === 'resolved' ? '✅ Đã xử lý' : s === 'dismissed' ? '❌ Bỏ qua' : '📋 Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>⏳ Đang tải...</p>
      ) : reports.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <p>Không có báo cáo nào.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {reports.map(r => {
            const s = STATUS_MAP[r.status] || STATUS_MAP.pending;
            return (
              <div key={r.id} style={{
                background:'var(--bg-surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)', padding:'16px 20px',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                      <strong style={{ color:'var(--text-primary)', fontSize:14 }}>{r.reason}</strong>
                    </div>
                    {r.description && (
                      <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:8 }}>"{r.description}"</p>
                    )}
                    <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>👤 {r.users?.full_name} ({r.users?.email})</span>
                      {r.rooms && <span>🏠 {r.rooms.title} – {r.rooms.city}</span>}
                      <span>🕐 {formatDate(r.created_at)}</span>
                    </div>
                  </div>

                  {r.status === 'pending' && (
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <button
                        className="btn btn-sm"
                        style={{ background:'rgba(16,185,129,.15)', color:'#10b981', border:'1px solid rgba(16,185,129,.3)', fontSize:12 }}
                        disabled={processing === r.id}
                        onClick={() => handleResolve(r.id, 'resolved')}
                      >
                        ✅ Xử lý xong
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background:'rgba(239,68,68,.1)', color:'#f87171', border:'1px solid rgba(239,68,68,.3)', fontSize:12 }}
                        disabled={processing === r.id}
                        onClick={() => handleResolve(r.id, 'dismissed')}
                      >
                        ❌ Bỏ qua
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminReports;
