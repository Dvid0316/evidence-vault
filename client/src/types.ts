export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface RecordVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  contentText: string;
  eventDateText: string | null;
}

export interface CaseInfo {
  id: string;
  name: string;
}

export interface TagInfo {
  id: string;
  name: string;
  color: string;
}

export interface CaseWithCount {
  id: string;
  name: string;
  description: string | null;
  caseNumber: string | null;
  createdAt: string;
  isActive: boolean;
  _count: { records: number };
}

export interface TagWithCount {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  _count: { records: number };
}

export interface RecordWithVersion {
  id: string;
  ownerUserId: string;
  status: string;
  createdAt: string;
  caseId: string | null;
  currentVersionId: string;
  currentVersion: RecordVersion;
  case?: CaseInfo | null;
  tags?: TagInfo[];
}

export interface RecordsResponse {
  ownerUserId: string;
  records: RecordWithVersion[];
}

export interface VersionsResponse {
  recordId: string;
  versions: RecordVersion[];
}

export interface EditHistoryEntry {
  id: string;
  createdAt: string;
  changeType: string;
  changeSummary: string;
  actorUserId: string | null;
  versionId: string | null;
  systemGenerated: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface HistoryResponse {
  recordId: string;
  history: EditHistoryEntry[];
}

export interface Attachment {
  id: string;
  recordId: string;
  fileType: string;
  uploadedAt: string;
  fileHash: string;
  originalName?: string;
  size?: number;
}

export interface Exhibit {
  id: string;
  recordId: string;
  ownerUserId: string;
  exhibitCode: string;
  label: string | null;
  createdAt: string;
  record?: {
    currentVersion?: {
      contentText: string;
      versionNumber: number;
    } | null;
  };
}

export interface ShareLink {
  id: string;
  recordId: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  url?: string;
}
