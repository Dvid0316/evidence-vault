import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { api } from "./api";
import "./Dashboard.css";

type DashboardData = Awaited<ReturnType<typeof api.getDashboard>>;

const CASE_COLORS = ["#4263eb", "#2b8a3e", "#e67700", "#ae3ec9", "#0b7285", "#d9480f", "#5c7cfa", "#868e96"];

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  onNavigateToRecords: (opts?: { caseId?: string; recordId?: string }) => void;
}

export default function Dashboard({ onNavigateToRecords }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getDashboard()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="dashboard"><p className="muted" style={{ textAlign: "center", marginTop: "3rem" }}>Loading dashboard...</p></div>;
  if (error) return <div className="dashboard"><div className="error" role="alert">{error}</div></div>;
  if (!data) return null;

  const { summary, recordsByCase, recordsByTag, recentActivity, exhibitProgress, timelineData } = data;

  const timelineFormatted = timelineData.map((d) => ({
    ...d,
    label: d.date.slice(5), // "02-14"
  }));

  const caseChartData = recordsByCase.map((c, i) => ({
    name: c.caseName.length > 20 ? c.caseName.slice(0, 18) + "..." : c.caseName,
    count: c.count,
    fill: c.caseId === null ? "#868e96" : CASE_COLORS[i % CASE_COLORS.length],
    caseId: c.caseId,
  }));

  const tagChartData = recordsByTag.map((t) => ({
    name: t.tagName,
    count: t.count,
    fill: t.tagColor,
  }));

  return (
    <div className="dashboard">
      {/* Section 1: Summary Cards */}
      <div className="dashboard-grid stats-grid">
        <div className="stat-card" style={{ borderLeftColor: "#4263eb" }}>
          <div className="stat-number">{summary.totalRecords}</div>
          <div className="stat-label">Records</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: "#2b8a3e" }}>
          <div className="stat-number">{summary.activeRecords}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: "#ae3ec9" }}>
          <div className="stat-number">{summary.totalExhibits}</div>
          <div className="stat-label">Exhibits</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: "#e67700" }}>
          <div className="stat-number">{summary.totalAttachments}</div>
          <div className="stat-label">Attachments</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: "#0b7285" }}>
          <div className="stat-number">{summary.activeCases}</div>
          <div className="stat-label">Cases</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: "#868e96" }}>
          <div className="stat-number">{summary.archivedRecords}</div>
          <div className="stat-label">Archived</div>
        </div>
      </div>

      {/* Section 2: Charts row */}
      <div className="dashboard-grid charts-grid">
        <div className="chart-card">
          <h3>Activity Timeline</h3>
          {timelineData.every((d) => d.records === 0 && d.versions === 0 && d.attachments === 0) ? (
            <div className="chart-empty">No activity data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timelineFormatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRecords" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4263eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4263eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradVersions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2b8a3e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2b8a3e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAttachments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e67700" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e67700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#868e96" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#868e96" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #dee2e6" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="records" stroke="#4263eb" fill="url(#gradRecords)" strokeWidth={2} name="Records" />
                <Area type="monotone" dataKey="versions" stroke="#2b8a3e" fill="url(#gradVersions)" strokeWidth={2} name="Versions" />
                <Area type="monotone" dataKey="attachments" stroke="#e67700" fill="url(#gradAttachments)" strokeWidth={2} name="Attachments" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h3>Records by Case</h3>
          {recordsByCase.length === 0 ? (
            <div className="chart-empty">No data yet</div>
          ) : recordsByCase.length <= 4 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={caseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  dataKey="count"
                  nameKey="name"
                  label={(props: any) => `${props.name ?? ""} (${props.value ?? 0})`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {caseChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} cursor="pointer" onClick={() => entry.caseId !== null && onNavigateToRecords({ caseId: entry.caseId })} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={caseChartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#868e96" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} stroke="#868e96" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]}>
                  {caseChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} cursor="pointer" onClick={() => entry.caseId !== null && onNavigateToRecords({ caseId: entry.caseId })} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section 3: Tags + Exhibits */}
      <div className="dashboard-grid panels-grid">
        <div className="chart-card">
          <h3>Records by Tag</h3>
          {tagChartData.length === 0 ? (
            <div className="chart-empty">No tags yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, tagChartData.length * 36 + 40)}>
              <BarChart data={tagChartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#868e96" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} stroke="#868e96" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]}>
                  {tagChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h3>Exhibit Checklist</h3>
          {exhibitProgress.length === 0 ? (
            <div className="chart-empty">No exhibits designated</div>
          ) : (
            <div className="exhibit-checklist">
              {exhibitProgress.map((ex) => (
                <div
                  key={ex.exhibitCode}
                  className="exhibit-item"
                  onClick={() => onNavigateToRecords({ recordId: ex.recordId })}
                >
                  <span className="exhibit-item-code">{ex.exhibitCode}</span>
                  <span className="exhibit-item-label">{ex.label ?? "Untitled"}</span>
                  <span className={`exhibit-item-status ${ex.hasAttachments ? "status-ok" : "status-warn"}`}>
                    {ex.hasAttachments ? "Ready" : "No files"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Recent Activity Feed */}
      <div className="dashboard-grid full-grid">
        <div className="chart-card">
          <h3>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="chart-empty">No recent activity</div>
          ) : (
            <div className="activity-feed">
              {recentActivity.map((a) => {
                const isAccess = a.changeSummary.startsWith("VIEW ") || a.changeSummary.startsWith("DOWNLOAD ") || a.changeSummary.startsWith("SHARE_VIEW ");
                const isSystem = a.changeType === "SYSTEM";
                return (
                  <div key={a.id} className="activity-item">
                    <span className={`activity-badge ${isAccess ? "badge-access" : isSystem ? "badge-system" : "badge-edit"}`}>
                      {a.changeType}
                    </span>
                    <span className="activity-summary">{a.changeSummary}</span>
                    <span className="activity-meta">
                      {a.ipAddress && <span className="activity-ip">{a.ipAddress}</span>}
                      <span className="activity-time">{relativeTime(a.createdAt)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
