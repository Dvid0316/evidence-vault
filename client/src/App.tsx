import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import Dashboard from "./Dashboard";
import type { Attachment, CaseWithCount, EditHistoryEntry, Exhibit, RecordVersion, RecordWithVersion, ShareLink, TagInfo, TagWithCount } from "./types";
import "./App.css";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

function App() {
  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async () => {
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password || authLoading) return;
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = authMode === "login" ? await api.login(email, password) : await api.register(email, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setAuthUser(data.user);
      setAuthEmail("");
      setAuthPassword("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setAuthUser(null);
  };

  useEffect(() => {
    if (!token) return;
    api.getMe().then((data) => {
      setAuthUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    }).catch(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setAuthUser(null);
    });
  }, [token]);

  if (!token || !authUser) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h1 className="login-title">Record App</h1>
          <p className="login-subtitle">Legal Evidence Collection</p>
          {authError && <div className="error" role="alert">{authError}</div>}
          <div className="login-form">
            <input type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} disabled={authLoading} onKeyDown={(e) => e.key === "Enter" && handleAuth()} autoFocus />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} disabled={authLoading} onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
            <button className="btn-primary" onClick={handleAuth} disabled={authLoading || !authEmail.trim() || !authPassword}>{authLoading ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Account"}</button>
          </div>
          <p className="login-toggle">
            {authMode === "login" ? (<>Don't have an account?{" "}<button className="btn-text" onClick={() => { setAuthMode("register"); setAuthError(null); }}>Register</button></>) : (<>Already have an account?{" "}<button className="btn-text" onClick={() => { setAuthMode("login"); setAuthError(null); }}>Sign In</button></>)}
          </p>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp authUser={authUser} onLogout={handleLogout} />;
}

function AuthenticatedApp({ authUser, onLogout }: { authUser: AuthUser; onLogout: () => void }) {
  const [view, setView] = useState<"dashboard" | "records">("dashboard");
  const [records, setRecords] = useState<RecordWithVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [record, setRecord] = useState<{ id: string; ownerUserId: string; status: string; currentVersion: { versionNumber: number; contentText: string; eventDateText: string | null } } | null>(null);
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [contentText, setContentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContentText, setNewContentText] = useState("");
  const [newEventDateText, setNewEventDateText] = useState("");
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareExpiry, setShareExpiry] = useState("");
  const [recordExhibit, setRecordExhibit] = useState<Exhibit | null>(null);
  const [loadingExhibit, setLoadingExhibit] = useState(false);
  const [designating, setDesignating] = useState(false);
  const [exhibitLabel, setExhibitLabel] = useState("");
  const [exhibits, setExhibits] = useState<Exhibit[]>([]);
  const [loadingExhibits, setLoadingExhibits] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"records" | "exhibits">("records");

  // Cases
  const [cases, setCases] = useState<CaseWithCount[]>([]);
  const [filterCaseId, setFilterCaseId] = useState("");
  const [showCaseManager, setShowCaseManager] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCaseNumber, setNewCaseNumber] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [creatingCase, setCreatingCase] = useState(false);
  const [recordCaseId, setRecordCaseId] = useState<string | null>(null);

  // Tags
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [filterTagId, setFilterTagId] = useState("");
  const [recordTags, setRecordTags] = useState<TagInfo[]>([]);
  const [loadingRecordTags, setLoadingRecordTags] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4263eb");
  const [creatingTag, setCreatingTag] = useState(false);

  // --- Loaders ---
  const loadCases = async () => { try { const d = await api.listCases(); setCases(d.cases as CaseWithCount[]); } catch { /* */ } };
  const loadTags = async () => { try { const d = await api.listTags(); setAllTags(d.tags as TagWithCount[]); } catch { /* */ } };

  const loadRecords = async () => {
    setError(null); setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterCaseId) params.caseId = filterCaseId;
      if (filterTagId) params.tagId = filterTagId;
      const data = await api.getRecords(params);
      setRecords((data.records as RecordWithVersion[]) || []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setRecords([]); } finally { setLoading(false); }
  };
  const loadRecord = async (id: string) => { setError(null); setLoadingRecord(true); try { const r = await api.getRecord(id); setRecord(r); setContentText(r.currentVersion?.contentText ?? ""); setRecordCaseId((r as any).caseId ?? null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setRecord(null); setContentText(""); } finally { setLoadingRecord(false); } };
  const loadVersions = async (id: string) => { setLoadingVersions(true); try { const d = await api.getVersions(id); setVersions((d.versions as RecordVersion[]) || []); } catch { setVersions([]); } finally { setLoadingVersions(false); } };
  const loadHistory = async (id: string) => { setLoadingHistory(true); try { const d = await api.getHistory(id); setHistory((d.history as EditHistoryEntry[]) || []); } catch { setHistory([]); } finally { setLoadingHistory(false); } };
  const loadAttachments = async (id: string) => { setLoadingAttachments(true); try { const d = await api.getAttachments(id); setAttachments((d.attachments as Attachment[]) || []); } catch { setAttachments([]); } finally { setLoadingAttachments(false); } };
  const loadShareLinks = async (id: string) => { setLoadingShares(true); try { const d = await api.getShareLinks(id); setShareLinks((d.shareLinks as ShareLink[]) || []); } catch { setShareLinks([]); } finally { setLoadingShares(false); } };
  const loadRecordExhibit = async (id: string) => { setLoadingExhibit(true); try { const d = await api.getRecordExhibit(id); setRecordExhibit((d.exhibit as Exhibit) ?? null); } catch { setRecordExhibit(null); } finally { setLoadingExhibit(false); } };
  const loadExhibits = async () => { setLoadingExhibits(true); try { const d = await api.listExhibits(); setExhibits((d.exhibits as Exhibit[]) || []); } catch { setExhibits([]); } finally { setLoadingExhibits(false); } };
  const loadRecordTags = async (id: string) => { setLoadingRecordTags(true); try { const d = await api.getRecordTags(id); setRecordTags(d.tags as TagInfo[]); } catch { setRecordTags([]); } finally { setLoadingRecordTags(false); } };

  useEffect(() => { loadRecords(); }, [searchQuery, filterCaseId, filterTagId]);
  useEffect(() => { loadCases(); loadTags(); loadExhibits(); }, []);
  useEffect(() => {
    if (!selectedId) { setRecord(null); setVersions([]); setHistory([]); setAttachments([]); setShareLinks([]); setRecordExhibit(null); setRecordTags([]); setContentText(""); return; }
    loadRecord(selectedId); loadVersions(selectedId); loadHistory(selectedId); loadAttachments(selectedId); loadShareLinks(selectedId); loadRecordExhibit(selectedId); loadRecordTags(selectedId);
  }, [selectedId]);

  const handleSearchChange = (val: string) => { setSearchInput(val); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setSearchQuery(val.trim()), 300); };

  // --- Handlers ---
  const handleSaveVersion = async () => { if (!selectedId || saving) return; setError(null); setSaving(true); try { await api.addVersion(selectedId, { contentText }); await loadRecord(selectedId); await loadVersions(selectedId); await loadHistory(selectedId); await loadRecords(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); } };
  const handleRestore = async (versionId: string) => { if (!selectedId || restoring) return; setError(null); setRestoring(versionId); try { await api.restoreVersion(selectedId, { versionId }); await loadRecord(selectedId); await loadVersions(selectedId); await loadHistory(selectedId); await loadRecords(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setRestoring(null); } };
  const handleRefresh = () => { if (selectedId) { loadRecord(selectedId); loadVersions(selectedId); loadHistory(selectedId); loadRecordTags(selectedId); } loadRecords(); };
  const handleCreateRecord = async () => { const trimmed = newContentText.trim(); if (!trimmed || creating) return; setError(null); setCreating(true); try { const result = await api.createRecord({ contentText: trimmed, eventDateText: newEventDateText.trim() || null }); setShowCreateForm(false); setNewContentText(""); setNewEventDateText(""); await loadRecords(); const rec = result.record as { id?: string }; if (rec?.id) setSelectedId(rec.id); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCreating(false); } };
  const handleArchive = async () => { if (!selectedId || archiving) return; setError(null); setArchiving(true); try { await api.archiveRecord(selectedId); await loadRecord(selectedId); await loadRecords(); await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setArchiving(false); } };
  const handleUnarchive = async () => { if (!selectedId || archiving) return; setError(null); setArchiving(true); try { await api.unarchiveRecord(selectedId); await loadRecord(selectedId); await loadRecords(); await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setArchiving(false); } };
  const handleUploadAttachment = async (file: File) => { if (!selectedId || uploading) return; setError(null); setUploading(true); try { await api.uploadAttachment(selectedId, file); await loadAttachments(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; } };
  const handleDeleteAttachment = async (attachmentId: string) => { setError(null); try { await api.deleteAttachment(attachmentId); if (selectedId) await loadAttachments(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const handleCreateShare = async () => { if (!selectedId || creatingShare) return; setError(null); setCreatingShare(true); try { await api.createShareLink(selectedId, shareExpiry || undefined); setShareExpiry(""); await loadShareLinks(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCreatingShare(false); } };
  const handleRevokeShare = async (linkId: string) => { setError(null); try { await api.revokeShareLink(linkId); if (selectedId) await loadShareLinks(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const handleDesignateExhibit = async () => { if (!selectedId || designating) return; setError(null); setDesignating(true); try { await api.designateExhibit(selectedId, { label: exhibitLabel.trim() || undefined }); setExhibitLabel(""); await loadRecordExhibit(selectedId); await loadExhibits(); await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setDesignating(false); } };
  const handleRemoveExhibit = async () => { if (!recordExhibit || designating) return; setError(null); setDesignating(true); try { await api.removeExhibit(recordExhibit.id); setRecordExhibit(null); await loadExhibits(); if (selectedId) await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setDesignating(false); } };

  // Case handlers
  const handleCreateCase = async () => { if (!newCaseName.trim() || creatingCase) return; setError(null); setCreatingCase(true); try { await api.createCase({ name: newCaseName.trim(), caseNumber: newCaseNumber.trim() || undefined, description: newCaseDesc.trim() || undefined }); setNewCaseName(""); setNewCaseNumber(""); setNewCaseDesc(""); await loadCases(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCreatingCase(false); } };
  const handleAssignCase = async (caseId: string) => { if (!selectedId) return; setError(null); try { await api.assignRecordToCase(selectedId, caseId); setRecordCaseId(caseId); await loadRecords(); await loadHistory(selectedId); await loadCases(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const handleRemoveFromCase = async () => { if (!selectedId) return; setError(null); try { await api.removeRecordFromCase(selectedId); setRecordCaseId(null); await loadRecords(); await loadHistory(selectedId); await loadCases(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };

  // Tag handlers
  const handleCreateTag = async () => { if (!newTagName.trim() || creatingTag) return; setError(null); setCreatingTag(true); try { await api.createTag({ name: newTagName.trim(), color: newTagColor }); setNewTagName(""); await loadTags(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCreatingTag(false); } };
  const handleDeleteTag = async (tagId: string) => { setError(null); try { await api.deleteTagById(tagId); await loadTags(); if (filterTagId === tagId) setFilterTagId(""); if (selectedId) await loadRecordTags(selectedId); await loadRecords(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const handleAddTag = async (tagId: string) => { if (!selectedId) return; setError(null); try { await api.addTagToRecord(selectedId, tagId); await loadRecordTags(selectedId); await loadRecords(); await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const handleRemoveTag = async (tagId: string) => { if (!selectedId) return; setError(null); try { await api.removeTagFromRecord(selectedId, tagId); await loadRecordTags(selectedId); await loadRecords(); await loadHistory(selectedId); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };

  const handleNavigateToRecords = (opts?: { caseId?: string; recordId?: string }) => {
    setView("records");
    if (opts?.caseId) setFilterCaseId(opts.caseId);
    if (opts?.recordId) setSelectedId(opts.recordId);
  };

  const filteredRecords = showArchived ? records : records.filter((r) => r.status !== "ARCHIVED");
  const busy = loading || loadingRecord || saving || archiving || designating;

  return (
    <div className="app">
      <header className="header">
        <div className="header-bar">
          <span className="header-brand">Record App</span>
          <nav className="header-nav">
            <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
            <button className={`nav-btn ${view === "records" ? "active" : ""}`} onClick={() => setView("records")}>Records</button>
          </nav>
          <div className="header-user">
            <span className="header-email">{authUser.email}</span>
            <button className="btn-small" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      {view === "dashboard" && (
        <Dashboard onNavigateToRecords={handleNavigateToRecords} />
      )}

      {view === "records" && <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={`tab-btn ${sidebarTab === "records" ? "active" : ""}`} onClick={() => setSidebarTab("records")}>Records</button>
            <button className={`tab-btn ${sidebarTab === "exhibits" ? "active" : ""}`} onClick={() => setSidebarTab("exhibits")}>Exhibits</button>
          </div>

          {sidebarTab === "records" && (
          <>
            <div className="sidebar-header">
              <h2>Records</h2>
              <button className="btn-small" onClick={() => setShowCreateForm((v) => !v)} disabled={busy}>{showCreateForm ? "Cancel" : "+ New"}</button>
            </div>

            {showCreateForm && (
              <div className="create-form">
                <textarea placeholder="Content text (required)" value={newContentText} onChange={(e) => setNewContentText(e.target.value)} rows={3} disabled={creating} />
                <input type="text" placeholder="Event date (optional)" value={newEventDateText} onChange={(e) => setNewEventDateText(e.target.value)} disabled={creating} />
                <div className="actions">
                  <button onClick={handleCreateRecord} disabled={creating || !newContentText.trim()}>{creating ? "Creating…" : "Create"}</button>
                  <button onClick={() => { setShowCreateForm(false); setNewContentText(""); setNewEventDateText(""); }} disabled={creating}>Cancel</button>
                </div>
              </div>
            )}

            {/* Case filter */}
            <div className="filter-row">
              <select value={filterCaseId} onChange={(e) => setFilterCaseId(e.target.value)} className="filter-select">
                <option value="">All Cases</option>
                <option value="none">Unassigned</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.name}{c.caseNumber ? ` (${c.caseNumber})` : ""}</option>)}
              </select>
              <button className="btn-text btn-manage" onClick={() => setShowCaseManager((v) => !v)}>{showCaseManager ? "Close" : "Manage"}</button>
            </div>

            {showCaseManager && (
              <div className="manager-panel">
                <div className="manager-form">
                  <input placeholder="Case name" value={newCaseName} onChange={(e) => setNewCaseName(e.target.value)} disabled={creatingCase} />
                  <input placeholder="Case # (optional)" value={newCaseNumber} onChange={(e) => setNewCaseNumber(e.target.value)} disabled={creatingCase} />
                  <button className="btn-small" onClick={handleCreateCase} disabled={creatingCase || !newCaseName.trim()}>+ Add</button>
                </div>
                {cases.length > 0 && (
                  <ul className="manager-list">
                    {cases.map((c) => (
                      <li key={c.id}>
                        <span className="manager-name">{c.name}</span>
                        {c.caseNumber && <span className="manager-meta">{c.caseNumber}</span>}
                        <span className="manager-meta">{c._count.records} records</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Tag filter */}
            <div className="filter-row">
              <div className="tag-filter-pills">
                <span className="filter-label">Tags:</span>
                {allTags.length === 0 ? <span className="muted" style={{ fontSize: "0.8rem" }}>none</span> : allTags.map((t) => (
                  <button key={t.id} className={`tag-pill-filter ${filterTagId === t.id ? "active" : ""}`} style={{ "--tag-color": t.color } as React.CSSProperties} onClick={() => setFilterTagId(filterTagId === t.id ? "" : t.id)}>{t.name}</button>
                ))}
              </div>
              <button className="btn-text btn-manage" onClick={() => setShowTagManager((v) => !v)}>{showTagManager ? "Close" : "Manage"}</button>
            </div>

            {showTagManager && (
              <div className="manager-panel">
                <div className="manager-form">
                  <input placeholder="Tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} disabled={creatingTag} />
                  <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="color-input" />
                  <button className="btn-small" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()}>+ Add</button>
                </div>
                {allTags.length > 0 && (
                  <ul className="manager-list">
                    {allTags.map((t) => (
                      <li key={t.id}>
                        <span className="tag-pill-small" style={{ background: t.color }}>{t.name}</span>
                        <span className="manager-meta">{t._count.records} records</span>
                        <button className="btn-small btn-danger" onClick={() => handleDeleteTag(t.id)}>Del</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <label className="toggle-label">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>

            <input type="text" className="search-input" placeholder="Search records…" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />

            {loading ? <p className="muted">Loading…</p> : filteredRecords.length === 0 ? <p className="muted">No records</p> : (
              <ul>
                {filteredRecords.map((r) => {
                  const cv = r.currentVersion;
                  const preview = (cv?.contentText ?? "").slice(0, 60);
                  return (
                    <li key={r.id} className={`${selectedId === r.id ? "selected" : ""} ${r.status === "ARCHIVED" ? "archived" : ""}`} onClick={() => setSelectedId(r.id)}>
                      <span className="id">
                        {r.id}
                        {r.status === "ARCHIVED" && <span className="badge-archived">archived</span>}
                        {r.case && <span className="badge-case">{r.case.name}</span>}
                      </span>
                      {r.tags && r.tags.length > 0 && (
                        <span className="record-tags-row">{r.tags.map((t) => <span key={t.id} className="tag-pill-tiny" style={{ background: t.color }}>{t.name}</span>)}</span>
                      )}
                      <span className="meta">v{cv?.versionNumber ?? "?"} · {preview}{preview.length >= 60 ? "…" : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
          )}

          {sidebarTab === "exhibits" && (
          <>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Exhibits</h2>
            {loadingExhibits ? <p className="muted">Loading…</p> : exhibits.length === 0 ? <p className="muted">No exhibits designated</p> : (
              <ul>
                {exhibits.map((ex) => {
                  const snippet = (ex.record?.currentVersion?.contentText ?? "").slice(0, 50);
                  return (
                    <li key={ex.id} className={selectedId === ex.recordId ? "selected" : ""} onClick={() => { setSelectedId(ex.recordId); setSidebarTab("records"); }}>
                      <span className="exhibit-code">Exhibit {ex.exhibitCode}</span>
                      {ex.label && <span className="exhibit-label">{ex.label}</span>}
                      <span className="meta">{snippet}{snippet.length >= 50 ? "…" : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
          )}
        </aside>

        <main className="main">
          {!selectedId ? <p className="muted">Select a record</p> : loadingRecord ? <p className="muted">Loading record…</p> : record ? (
            <>
              {/* Case Assignment */}
              <div className="section">
                <h3>Case Assignment</h3>
                <div className="case-assign-row">
                  <select value={recordCaseId ?? ""} onChange={(e) => { const v = e.target.value; if (v) handleAssignCase(v); else handleRemoveFromCase(); }} className="filter-select">
                    <option value="">Unassigned</option>
                    {cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {recordCaseId && <button className="btn-small" onClick={handleRemoveFromCase}>Remove</button>}
                </div>
              </div>

              {/* Tags */}
              <div className="section">
                <h3>Tags</h3>
                <div className="record-tags-bar">
                  {loadingRecordTags ? <span className="muted">Loading…</span> : recordTags.length === 0 ? <span className="muted" style={{ fontStyle: "italic", fontSize: "0.85rem" }}>No tags</span> : recordTags.map((t) => (
                    <span key={t.id} className="tag-pill" style={{ background: t.color }}>
                      {t.name}
                      <button className="tag-remove" onClick={() => handleRemoveTag(t.id)}>&times;</button>
                    </span>
                  ))}
                  <select className="tag-add-select" value="" onChange={(e) => { if (e.target.value) handleAddTag(e.target.value); }}>
                    <option value="">+ Add tag</option>
                    {allTags.filter((t) => !recordTags.some((rt) => rt.id === t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Current version */}
              <div className="section">
                <h3>Current version (v{record.currentVersion.versionNumber})</h3>
                <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} disabled={busy} rows={6} />
                <div className="actions">
                  <button onClick={handleSaveVersion} disabled={busy}>{saving ? "Saving…" : "Save New Version"}</button>
                  <button onClick={handleRefresh} disabled={busy}>Refresh</button>
                  {record.status === "ACTIVE" ? <button className="btn-danger" onClick={handleArchive} disabled={busy}>{archiving ? "Archiving…" : "Archive"}</button> : <button onClick={handleUnarchive} disabled={busy}>{archiving ? "Unarchiving…" : "Unarchive"}</button>}
                </div>
              </div>

              {/* Version history */}
              <div className="section">
                <h3>Version history</h3>
                {loadingVersions ? <p className="muted">Loading…</p> : versions.length === 0 ? <p className="muted">No versions</p> : (
                  <table><thead><tr><th>#</th><th>Created</th><th>Snippet</th><th></th></tr></thead><tbody>
                    {versions.map((v) => (<tr key={v.id}><td>{v.versionNumber}</td><td>{new Date(v.createdAt).toLocaleString()}</td><td>{(v.contentText ?? "").slice(0, 50)}{(v.contentText ?? "").length >= 50 ? "…" : ""}</td><td><button onClick={() => handleRestore(v.id)} disabled={!!restoring}>{restoring === v.id ? "…" : "Restore"}</button></td></tr>))}
                  </tbody></table>
                )}
              </div>

              {/* Edit history */}
              <div className="section">
                <h3>Edit history</h3>
                {loadingHistory ? <p className="muted">Loading…</p> : history.length === 0 ? <p className="muted">No history</p> : (
                  <table><thead><tr><th>Time</th><th>Type</th><th>Summary</th><th>Actor</th><th>IP</th><th>User Agent</th></tr></thead><tbody>
                    {history.map((h) => { const isSystem = h.systemGenerated; const isAccess = h.changeSummary.startsWith("VIEW ") || h.changeSummary.startsWith("DOWNLOAD ") || h.changeSummary.startsWith("SHARE_VIEW "); return (
                      <tr key={h.id} className={isSystem ? "system-row" : ""}><td>{new Date(h.createdAt).toLocaleString()}</td><td><span className={`badge-type ${isAccess ? "badge-access" : isSystem ? "badge-system" : "badge-edit"}`}>{h.changeType}</span></td><td>{h.changeSummary}</td><td className="muted">{h.actorUserId ?? "system"}</td><td className="muted">{h.ipAddress ?? "—"}</td><td className="muted" title={h.userAgent ?? ""}>{h.userAgent ? (h.userAgent.length > 40 ? h.userAgent.slice(0, 40) + "…" : h.userAgent) : "—"}</td></tr>
                    ); })}
                  </tbody></table>
                )}
              </div>

              {/* Attachments */}
              <div className="section">
                <h3>Attachments</h3>
                <div className="actions"><input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadAttachment(f); }} disabled={uploading} />{uploading && <span className="muted">Uploading…</span>}</div>
                {loadingAttachments ? <p className="muted">Loading…</p> : attachments.length === 0 ? <p className="muted">No attachments</p> : (
                  <table><thead><tr><th>Type</th><th>Hash</th><th>Uploaded</th><th></th></tr></thead><tbody>
                    {attachments.map((a) => (<tr key={a.id}><td>{a.fileType}</td><td className="muted">{a.fileHash.slice(0, 12)}…</td><td>{new Date(a.uploadedAt).toLocaleString()}</td><td><a href={api.getAttachmentDownloadUrl(a.id)} target="_blank" rel="noreferrer">Download</a>{" "}<button className="btn-small btn-danger" onClick={() => handleDeleteAttachment(a.id)}>Delete</button></td></tr>))}
                  </tbody></table>
                )}
              </div>

              {/* Share links */}
              <div className="section">
                <h3>Share links</h3>
                <div className="actions"><input type="datetime-local" value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)} disabled={creatingShare} /><button onClick={handleCreateShare} disabled={creatingShare}>{creatingShare ? "Creating…" : "Create Share Link"}</button></div>
                {loadingShares ? <p className="muted">Loading…</p> : shareLinks.length === 0 ? <p className="muted">No share links</p> : (
                  <table><thead><tr><th>Token</th><th>Created</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
                    {shareLinks.map((sl) => { const revoked = !!sl.revokedAt; const expired = sl.expiresAt && new Date(sl.expiresAt) < new Date(); return (
                      <tr key={sl.id} className={revoked ? "revoked-row" : ""}><td><code>{sl.token.slice(0, 12)}…</code>{sl.url && <>{" "}<button className="btn-small" onClick={() => navigator.clipboard.writeText(sl.url!)}>Copy</button></>}</td><td>{new Date(sl.createdAt).toLocaleString()}</td><td>{sl.expiresAt ? new Date(sl.expiresAt).toLocaleString() : "Never"}</td><td className={revoked || expired ? "muted" : ""}>{revoked ? "Revoked" : expired ? "Expired" : "Active"}</td><td>{!revoked && <button className="btn-small btn-danger" onClick={() => handleRevokeShare(sl.id)}>Revoke</button>}</td></tr>
                    ); })}
                  </tbody></table>
                )}
              </div>

              {/* Exhibit Designation */}
              <div className="section">
                <h3>Exhibit Designation</h3>
                {loadingExhibit ? <p className="muted">Loading…</p> : recordExhibit ? (
                  <div className="exhibit-info">
                    <span className="exhibit-badge">Exhibit {recordExhibit.exhibitCode}</span>
                    {recordExhibit.label && <span className="exhibit-label-detail">{recordExhibit.label}</span>}
                    <div className="actions">
                      <a href={api.getExhibitPdfUrl(recordExhibit.id)} target="_blank" rel="noreferrer" className="btn-link">Download Exhibit PDF</a>
                      <button className="btn-small btn-danger" onClick={handleRemoveExhibit} disabled={designating}>{designating ? "Removing…" : "Remove Designation"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="exhibit-form">
                    <input type="text" placeholder="Label (optional, e.g. 'Surveillance Photo')" value={exhibitLabel} onChange={(e) => setExhibitLabel(e.target.value)} disabled={designating} />
                    <button onClick={handleDesignateExhibit} disabled={designating}>{designating ? "Designating…" : "Designate as Exhibit"}</button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>}
    </div>
  );
}

export default App;
