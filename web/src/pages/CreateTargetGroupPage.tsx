import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type {
  CreateTargetGroupRequest,
  TargetProtocol,
  TargetType,
  Vpc,
} from "@nimbus/shared";

export function CreateTargetGroupPage() {
  const navigate = useNavigate();
  const [vpcs, setVpcs] = useState<Vpc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateTargetGroupRequest>({
    name: "",
    targetType: "instance",
    protocol: "HTTP",
    port: 80,
    vpcId: "",
    protocolVersion: "HTTP1",
    healthCheck: {
      protocol: "HTTP",
      port: "traffic-port",
      path: "/",
      intervalSeconds: 30,
      timeoutSeconds: 5,
      healthyThresholdCount: 5,
      unhealthyThresholdCount: 2,
      matcherHttpCodes: "200",
    },
    stickiness: { enabled: false, type: "lb_cookie", durationSeconds: 86400 },
    deregistrationDelaySeconds: 300,
    loadBalancingAlgorithm: "round_robin",
  });

  useEffect(() => {
    api.listVpcs().then((r) => {
      setVpcs(r.vpcs);
      if (r.vpcs[0]) setForm((f) => ({ ...f, vpcId: r.vpcs[0].id }));
    });
  }, []);

  const patch = (p: Partial<CreateTargetGroupRequest>) => setForm((f) => ({ ...f, ...p }));
  const isHttpish = form.protocol === "HTTP" || form.protocol === "HTTPS";

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { targetGroup } = await api.createTargetGroup(form);
      navigate(`/elb/target-groups/${targetGroup.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="nm-breadcrumbs">Target groups &rsaquo; Create</div>
      <h1 className="nm-h1">Create target group</h1>
      {error && <div className="nm-error">{error}</div>}

      <div className="nm-panel">
        <h2 className="nm-h2">Basic configuration</h2>
        <div className="nm-grid cols-2">
          <div className="nm-form-row">
            <label>Name</label>
            <input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div className="nm-form-row">
            <label>VPC</label>
            <select value={form.vpcId} onChange={(e) => patch({ vpcId: e.target.value })}>
              {vpcs.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
          </div>
          <div className="nm-form-row">
            <label>Target type</label>
            <select value={form.targetType} onChange={(e) => patch({ targetType: e.target.value as TargetType })}>
              <option value="instance">Instance</option>
              <option value="ip">IP address</option>
              <option value="lambda">Lambda function</option>
              <option value="alb">Application load balancer</option>
            </select>
          </div>
          <div className="nm-form-row">
            <label>Protocol</label>
            <select value={form.protocol} onChange={(e) => patch({ protocol: e.target.value as TargetProtocol })}>
              <option>HTTP</option><option>HTTPS</option>
              <option>TCP</option><option>UDP</option><option>TCP_UDP</option><option>TLS</option><option>GENEVE</option>
            </select>
          </div>
          <div className="nm-form-row">
            <label>Port</label>
            <input type="number" min={1} max={65535} value={form.port}
              onChange={(e) => patch({ port: Number(e.target.value) })} />
          </div>
          {isHttpish && (
            <div className="nm-form-row">
              <label>Protocol version</label>
              <select value={form.protocolVersion}
                onChange={(e) => patch({ protocolVersion: e.target.value as "HTTP1" | "HTTP2" | "GRPC" })}>
                <option>HTTP1</option><option>HTTP2</option><option>GRPC</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="nm-panel">
        <h2 className="nm-h2">Health checks</h2>
        <div className="nm-grid cols-3">
          <div className="nm-form-row">
            <label>Protocol</label>
            <select value={form.healthCheck?.protocol ?? "HTTP"}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, protocol: e.target.value as "HTTP" | "HTTPS" | "TCP" } })}>
              <option>HTTP</option><option>HTTPS</option><option>TCP</option>
            </select>
          </div>
          <div className="nm-form-row">
            <label>Port</label>
            <input value={String(form.healthCheck?.port ?? "traffic-port")}
              onChange={(e) => patch({
                healthCheck: {
                  ...form.healthCheck,
                  port: e.target.value === "traffic-port" ? "traffic-port" : Number(e.target.value),
                },
              })} />
          </div>
          <div className="nm-form-row">
            <label>Path (HTTP/HTTPS)</label>
            <input value={form.healthCheck?.path ?? ""}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, path: e.target.value } })} />
          </div>
          <div className="nm-form-row">
            <label>Interval (s)</label>
            <input type="number" min={5} max={300} value={form.healthCheck?.intervalSeconds ?? 30}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, intervalSeconds: Number(e.target.value) } })} />
          </div>
          <div className="nm-form-row">
            <label>Timeout (s)</label>
            <input type="number" min={2} max={120} value={form.healthCheck?.timeoutSeconds ?? 5}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, timeoutSeconds: Number(e.target.value) } })} />
          </div>
          <div className="nm-form-row">
            <label>Healthy threshold</label>
            <input type="number" min={2} max={10} value={form.healthCheck?.healthyThresholdCount ?? 5}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, healthyThresholdCount: Number(e.target.value) } })} />
          </div>
          <div className="nm-form-row">
            <label>Unhealthy threshold</label>
            <input type="number" min={2} max={10} value={form.healthCheck?.unhealthyThresholdCount ?? 2}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, unhealthyThresholdCount: Number(e.target.value) } })} />
          </div>
          <div className="nm-form-row">
            <label>HTTP matcher codes</label>
            <input value={form.healthCheck?.matcherHttpCodes ?? ""}
              onChange={(e) => patch({ healthCheck: { ...form.healthCheck, matcherHttpCodes: e.target.value } })} />
          </div>
        </div>
      </div>

      <div className="nm-panel">
        <h2 className="nm-h2">Attributes</h2>
        <div className="nm-grid cols-2">
          <div>
            <label className="nm-check">
              <input type="checkbox" checked={!!form.stickiness?.enabled}
                onChange={(e) => patch({ stickiness: { ...form.stickiness, enabled: e.target.checked } })} />
              Stickiness
            </label>
            {form.stickiness?.enabled && (
              <>
                <div className="nm-form-row">
                  <label>Type</label>
                  <select value={form.stickiness.type ?? "lb_cookie"}
                    onChange={(e) => patch({ stickiness: { ...form.stickiness, type: e.target.value as "lb_cookie" | "app_cookie" | "source_ip" | "source_ip_dest_ip" } })}>
                    <option value="lb_cookie">lb_cookie (ALB)</option>
                    <option value="app_cookie">app_cookie (ALB)</option>
                    <option value="source_ip">source_ip (NLB)</option>
                    <option value="source_ip_dest_ip">source_ip_dest_ip (NLB TLS)</option>
                  </select>
                </div>
                <div className="nm-form-row">
                  <label>Duration (s)</label>
                  <input type="number" value={form.stickiness.durationSeconds ?? 86400}
                    onChange={(e) => patch({ stickiness: { ...form.stickiness, durationSeconds: Number(e.target.value) } })} />
                </div>
              </>
            )}
          </div>
          <div>
            <div className="nm-form-row">
              <label>Load balancing algorithm</label>
              <select value={form.loadBalancingAlgorithm ?? "round_robin"}
                onChange={(e) => patch({ loadBalancingAlgorithm: e.target.value as "round_robin" | "least_outstanding_requests" | "weighted_random" })}>
                <option value="round_robin">round_robin</option>
                <option value="least_outstanding_requests">least_outstanding_requests (ALB)</option>
                <option value="weighted_random">weighted_random (ALB)</option>
              </select>
            </div>
            <div className="nm-form-row">
              <label>Deregistration delay (s)</label>
              <input type="number" min={0} max={3600} value={form.deregistrationDelaySeconds ?? 300}
                onChange={(e) => patch({ deregistrationDelaySeconds: Number(e.target.value) })} />
            </div>
            {isHttpish && (
              <div className="nm-form-row">
                <label>Slow start (s)</label>
                <input type="number" min={30} max={900} value={form.slowStartSeconds ?? ""}
                  onChange={(e) => patch({ slowStartSeconds: Number(e.target.value) || undefined })} />
              </div>
            )}
            {!isHttpish && (
              <>
                <label className="nm-check">
                  <input type="checkbox" checked={!!form.preserveClientIp}
                    onChange={(e) => patch({ preserveClientIp: e.target.checked })} />
                  Preserve client IP (NLB)
                </label>
                <label className="nm-check">
                  <input type="checkbox" checked={!!form.proxyProtocolV2}
                    onChange={(e) => patch({ proxyProtocolV2: e.target.checked })} />
                  Proxy protocol v2 (NLB)
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="nm-btn" onClick={submit} disabled={submitting || !form.name || !form.vpcId}>
          {submitting ? "Creating..." : "Create target group"}
        </button>
        <button className="nm-btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </>
  );
}
