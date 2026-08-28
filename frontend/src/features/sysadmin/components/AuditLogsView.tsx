import { useEffect, useState } from "react";
import { sysAdminApi, type OperatorAuditLog } from "../api/sysadmin.api";
import { getApiErrorMessage } from "../../../lib/api/errors";

export default function AuditLogsView() {
  const [logs, setLogs] = useState<OperatorAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadLogs = () => {
    setLoading(true);
    sysAdminApi.getAuditLogs({ search })
      .then(setLogs)
      .catch((error: unknown) => setError(getApiErrorMessage(error, "Failed to load audit logs")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, [search]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by operator, action, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-sm text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none"
          />
          <span className="absolute left-3.5 top-2.5 text-[var(--t3)]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
        </div>
        <button
          onClick={loadLogs}
          className="px-3.5 py-2 border border-[var(--b)] bg-[var(--s2)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t1)] transition"
        >
          Refresh
        </button>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)]" />
          </div>
        ) : error ? (
          <div className="p-4 text-[var(--red)]">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)] text-sm">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] uppercase text-[10px] tracking-wider font-semibold">
                  <th className="px-5 py-4">Timestamp</th>
                  <th className="px-5 py-4">Operator</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Target Org</th>
                  <th className="px-5 py-4">Payload/Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b)] font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--s2)]/40 transition">
                    <td className="px-5 py-3.5 text-[var(--t3)] text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--t1)]">
                      @{log.operator_username}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-semibold bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/10 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--t2)] text-xs">
                      {log.organization_name || "Platform Global"}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <details className="cursor-pointer group text-xs text-[var(--t2)]">
                          <summary className="hover:text-[var(--brand)] transition outline-none font-semibold">
                            View details
                          </summary>
                          <pre className="mt-2 p-2.5 bg-[var(--s2)] border border-[var(--b)] rounded-lg font-mono text-[10px] text-[var(--t2)] overflow-x-auto whitespace-pre-wrap max-h-40">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-[var(--t3)] text-xs italic">No metadata</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
