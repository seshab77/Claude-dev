import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { RegisteredTarget, TargetGroup } from "@nimbus/shared";

export function TargetGroupDetailsPage() {
  const { id = "" } = useParams();
  const [tg, setTg] = useState<TargetGroup | null>(null);
  const [newId, setNewId] = useState("");
  const [newPort, setNewPort] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api.getTargetGroup(id).then((r) => setTg(r.targetGroup)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!tg) return <div className="nm-empty">Loading...</div>;

  const register = async () => {
    if (!newId) return;
    try {
      await api.registerTargets(tg.id, {
        targets: [{ id: newId, port: newPort === "" ? undefined : Number(newPort) }],
      });
      setNewId("");
      setNewPort("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deregister = async (t: RegisteredTarget) => {
    await api.deregisterTargets(tg.id, [t.id]);
    load();
  };

  return (
    <>
      <div className="nm-breadcrumbs">
        <Link to="/elb/target-groups">Target groups</Link> &rsaquo; {tg.name}
      </div>
      <h1 className="nm-h1">{tg.name}</h1>

      {error && <div className="nm-error">{error}</div>}

      <div className="nm-panel">
        <h2 className="nm-h2">Details</h2>
        <dl className="nm-kv">
          <dt>ARN</dt><dd className="nm-code">{tg.arn}</dd>
          <dt>Target type</dt><dd>{tg.targetType}</dd>
          <dt>Protocol</dt><dd>{tg.protocol} {tg.protocolVersion && `(${tg.protocolVersion})`}</dd>
          <dt>Port</dt><dd>{tg.port}</dd>
          <dt>VPC</dt><dd>{tg.vpcId}</dd>
          <dt>Algorithm</dt><dd>{tg.loadBalancingAlgorithm}</dd>
          <dt>Stickiness</dt>
          <dd>
            {tg.stickiness.enabled
              ? `${tg.stickiness.type} (${tg.stickiness.durationSeconds ?? "-"}s)`
              : "Disabled"}
          </dd>
          <dt>Deregistration delay</dt><dd>{tg.deregistrationDelaySeconds}s</dd>
          {tg.slowStartSeconds && (<><dt>Slow start</dt><dd>{tg.slowStartSeconds}s</dd></>)}
          {tg.preserveClientIp !== undefined && (<><dt>Preserve client IP</dt><dd>{String(tg.preserveClientIp)}</dd></>)}
          {tg.proxyProtocolV2 !== undefined && (<><dt>Proxy protocol v2</dt><dd>{String(tg.proxyProtocolV2)}</dd></>)}
        </dl>
      </div>

      <div className="nm-panel">
        <h2 className="nm-h2">Health check</h2>
        <pre className="nm-code" style={{ padding: 12, display: "block", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(tg.healthCheck, null, 2)}
        </pre>
      </div>

      <div className="nm-panel">
        <div className="nm-panel-header">
          <h2 className="nm-h2">Registered targets</h2>
        </div>

        <div className="nm-grid cols-3" style={{ marginBottom: 10 }}>
          <div className="nm-form-row">
            <label>Target id ({tg.targetType})</label>
            <input value={newId} onChange={(e) => setNewId(e.target.value)}
              placeholder={tg.targetType === "instance" ? "i-0abc..." : tg.targetType === "ip" ? "10.10.1.50" : "arn:..."} />
          </div>
          <div className="nm-form-row">
            <label>Port (optional)</label>
            <input type="number" value={newPort}
              onChange={(e) => setNewPort(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <button className="nm-btn" style={{ alignSelf: "end", height: 34 }} onClick={register}>Register</button>
        </div>

        <table className="nm-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Port</th>
              <th>AZ</th>
              <th>Health</th>
              <th>Reason</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tg.targets.map((t) => (
              <tr key={t.id + t.port}>
                <td className="nm-code">{t.id}</td>
                <td>{t.port ?? "-"}</td>
                <td>{t.availabilityZone ?? "-"}</td>
                <td><span className={`nm-badge ${t.health.state}`}>{t.health.state}</span></td>
                <td style={{ color: "var(--nm-text-dim)", fontSize: 12 }}>
                  {t.health.description ?? t.health.reasonCode ?? "-"}
                </td>
                <td>
                  {t.health.state !== "draining" && (
                    <button className="nm-btn secondary small" onClick={() => deregister(t)}>
                      Deregister
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tg.targets.length === 0 && (
              <tr><td colSpan={6}><div className="nm-empty">No targets registered.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
