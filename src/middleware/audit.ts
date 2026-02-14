import { Request, Response, NextFunction } from "express";

export interface AuditInfo {
  ipAddress?: string;
  userAgent?: string;
}

export function auditContext(req: Request, _res: Response, next: NextFunction) {
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const ua = req.headers["user-agent"] || "unknown";

  (req as any).auditIp = ip;
  (req as any).auditUserAgent = ua;

  next();
}

/** Helper to extract AuditInfo from a request */
export function getAuditInfo(req: Request): AuditInfo {
  return {
    ipAddress: (req as any).auditIp,
    userAgent: (req as any).auditUserAgent,
  };
}
