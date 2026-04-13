import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  CreateLoadBalancerRequest,
  LoadBalancerAttributes,
  LoadBalancerType,
  Vpc,
} from "@nimbus/shared";
import { api } from "../api/client";

// -----------------------------------------------------------------------
// Create Load Balancer wizard.
//
// Exposes the full intersection of ALB + NLB options:
//   1. Type + scheme
//   2. VPC + subnets + (for ALB) security groups
//   3. IP address type
//   4. Attributes (deletion protection, cross-zone LB, access logs,
//      HTTP/2, idle timeout, desync mode, XFF handling, client IP
//      preservation, connection termination on deregistration, etc.)
//   5. Tags
//   6. Review & create
// -----------------------------------------------------------------------

const STEPS = [
  "Basic",
  "Network",
  "Attributes",
  "Tags",
  "Review",
] as const;
type Step = (typeof STEPS)[number];

const DEFAULT_ALB_ATTRS: LoadBalancerAttributes = {
  deletionProtectionEnabled: false,
  accessLogsEnabled: false,
  idleTimeoutSeconds: 60,
  http2Enabled: true,
  dropInvalidHeaderFieldsEnabled: false,
  desyncMitigationMode: "defensive",
  xffHeaderProcessingMode: "append",
  xffClientPortEnabled: false,
  xAmznTlsVersionAndCipherSuiteHeaderEnabled: false,
  crossZoneLoadBalancingEnabled: true,
  wafFailOpenEnabled: false,
};

const DEFAULT_NLB_ATTRS: LoadBalancerAttributes = {
  deletionProtectionEnabled: false,
  accessLogsEnabled: false,
  crossZoneLoadBalancingEnabled: false,
  connectionTerminationOnDeregistration: false,
  preserveClientIpEnabled: true,
};

export function CreateLoadBalancerPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("Basic");
  const [vpcs, setVpcs] = useState<Vpc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateLoadBalancerRequest>({
    name: "",
    type: "application",
    scheme: "internet-facing",
    ipAddressType: "ipv4",
    vpcId: "",
    subnetIds: [],
    securityGroupIds: [],
    attributes: { ...DEFAULT_ALB_ATTRS },
    tags: [],
  });

  useEffect(() => {
    api.listVpcs().then((r) => {
      setVpcs(r.vpcs);
      if (r.vpcs[0]) {
        setForm((f) => ({ ...f, vpcId: r.vpcs[0].id }));
      }
    });
  }, []);

  const vpc = useMemo(() => vpcs.find((v) => v.id === form.vpcId), [vpcs, form.vpcId]);

  const patch = (p: Partial<CreateLoadBalancerRequest>) =>
    setForm((f) => ({ ...f, ...p }));
  const patchAttrs = (p: Partial<LoadBalancerAttributes>) =>
    setForm((f) => ({ ...f, attributes: { ...(f.attributes ?? {}), ...p } }));

  const onTypeChange = (type: LoadBalancerType) => {
    patch({
      type,
      attributes: type === "application" ? { ...DEFAULT_ALB_ATTRS } : { ...DEFAULT_NLB_ATTRS },
      securityGroupIds: type === "application" ? form.securityGroupIds ?? [] : [],
    });
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case "Basic":
        return form.name.trim().length > 0 && /^[A-Za-z0-9-]+$/.test(form.name);
      case "Network":
        return (
          !!form.vpcId &&
          form.subnetIds.length >= (form.type === "application" ? 2 : 1)
        );
      default:
        return true;
    }
  };

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { loadBalancer } = await api.createLoadBalancer(form);
      navigate(`/elb/load-balancers/${loadBalancer.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="nm-breadcrumbs">Elastic Load Balancing &rsaquo; Create load balancer</div>
      <h1 className="nm-h1">Create load balancer</h1>

      <div className="nm-steps">
        {STEPS.map((s, idx) => (
          <div key={s} className={`nm-step ${step === s ? "active" : ""}`}>
            <span className="num">{idx + 1}</span> {s}
          </div>
        ))}
      </div>

      {error && <div className="nm-error">{error}</div>}

      {step === "Basic" && <BasicStep form={form} patch={patch} onTypeChange={onTypeChange} />}
      {step === "Network" && !vpc && (
        <div className="nm-panel">
          <h2 className="nm-h2">Network mapping</h2>
          <div className="nm-empty">
            You don&rsquo;t have any VPCs yet. A load balancer must live inside a
            VPC.{" "}
            <Link to="/networking/vpcs/new">Create a VPC</Link> first, then come
            back to finish this wizard.
          </div>
        </div>
      )}
      {step === "Network" && vpc && <NetworkStep form={form} patch={patch} vpc={vpc} vpcs={vpcs} />}
      {step === "Attributes" && <AttributesStep form={form} patchAttrs={patchAttrs} />}
      {step === "Tags" && <TagsStep form={form} patch={patch} />}
      {step === "Review" && <ReviewStep form={form} vpc={vpc} />}

      <div className="nm-wizard-footer">
        <button className="nm-btn secondary" onClick={goBack} disabled={step === "Basic" || submitting}>
          Back
        </button>
        {step === "Review" ? (
          <button className="nm-btn" onClick={submit} disabled={submitting}>
            {submitting ? "Creating..." : "Create load balancer"}
          </button>
        ) : (
          <button className="nm-btn" onClick={goNext} disabled={!canAdvance()}>
            Next
          </button>
        )}
      </div>
    </>
  );
}

// ------- Step 1 -------
function BasicStep({
  form,
  patch,
  onTypeChange,
}: {
  form: CreateLoadBalancerRequest;
  patch: (p: Partial<CreateLoadBalancerRequest>) => void;
  onTypeChange: (t: LoadBalancerType) => void;
}) {
  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Basic configuration</h2>
      <div className="nm-form-row">
        <label>Name</label>
        <input
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="my-app-lb"
        />
        <div className="help">Alphanumeric and hyphens; max 32 characters.</div>
      </div>

      <div className="nm-form-row">
        <label>Load balancer type</label>
        <div className="nm-grid cols-2" style={{ gap: 10 }}>
          <TypeCard
            selected={form.type === "application"}
            onSelect={() => onTypeChange("application")}
            title="Application"
            sub="Layer 7 · HTTP/HTTPS · host/path/header/query/method/IP routing, redirects, fixed responses, OIDC auth, WebSocket, HTTP/2"
          />
          <TypeCard
            selected={form.type === "network"}
            onSelect={() => onTypeChange("network")}
            title="Network"
            sub="Layer 4 · TCP/UDP/TLS · static IPs per AZ, client-IP preservation, proxy protocol v2, ultra-low latency"
          />
        </div>
      </div>

      <div className="nm-form-row">
        <label>Scheme</label>
        <div className="nm-grid cols-2">
          <label className="nm-radio-card">
            <input type="radio" checked={form.scheme === "internet-facing"}
              onChange={() => patch({ scheme: "internet-facing" })} />
            <div><strong>Internet-facing</strong><small>Publicly routable from the Internet.</small></div>
          </label>
          <label className="nm-radio-card">
            <input type="radio" checked={form.scheme === "internal"}
              onChange={() => patch({ scheme: "internal" })} />
            <div><strong>Internal</strong><small>Only reachable from inside the VPC.</small></div>
          </label>
        </div>
      </div>

      <div className="nm-form-row">
        <label>IP address type</label>
        <select
          value={form.ipAddressType}
          onChange={(e) => patch({ ipAddressType: e.target.value as "ipv4" | "dualstack" })}
        >
          <option value="ipv4">IPv4</option>
          <option value="dualstack">Dual-stack (IPv4 + IPv6)</option>
        </select>
      </div>
    </div>
  );
}

function TypeCard({
  selected,
  onSelect,
  title,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
}) {
  return (
    <div className={`nm-radio-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <input type="radio" checked={selected} onChange={() => {}} />
      <div><strong>{title}</strong><small>{sub}</small></div>
    </div>
  );
}

// ------- Step 2 -------
function NetworkStep({
  form,
  patch,
  vpc,
  vpcs,
}: {
  form: CreateLoadBalancerRequest;
  patch: (p: Partial<CreateLoadBalancerRequest>) => void;
  vpc: Vpc;
  vpcs: Vpc[];
}) {
  const toggleSubnet = (id: string) => {
    const next = form.subnetIds.includes(id)
      ? form.subnetIds.filter((s) => s !== id)
      : [...form.subnetIds, id];
    patch({ subnetIds: next });
  };
  const minSubnets = form.type === "application" ? 2 : 1;

  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Network mapping</h2>

      <div className="nm-form-row">
        <label>VPC</label>
        <select value={form.vpcId} onChange={(e) => patch({ vpcId: e.target.value, subnetIds: [] })}>
          {vpcs.map((v) => (
            <option key={v.id} value={v.id}>{v.name} ({v.id} · {v.cidrBlock})</option>
          ))}
        </select>
      </div>

      <div className="nm-form-row">
        <label>Mappings ({form.type === "application" ? "select at least two AZs" : "select at least one AZ"})</label>
        <div className="nm-grid cols-2">
          {vpc.subnets.map((s) => {
            const on = form.subnetIds.includes(s.id);
            return (
              <div
                key={s.id}
                className={`nm-radio-card ${on ? "selected" : ""}`}
                onClick={() => toggleSubnet(s.id)}
              >
                <input type="checkbox" checked={on} onChange={() => {}} />
                <div>
                  <strong>{s.availabilityZone}</strong>
                  <small>
                    {s.id} · {s.cidrBlock}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
        <div className="help">Selected: {form.subnetIds.length} (minimum {minSubnets}).</div>
      </div>

      {form.type === "application" && (
        <div className="nm-form-row">
          <label>Security groups (comma-separated)</label>
          <input
            value={form.securityGroupIds?.join(",") ?? ""}
            onChange={(e) =>
              patch({ securityGroupIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="sg-web,sg-public-http"
          />
        </div>
      )}
    </div>
  );
}

// ------- Step 3 -------
function AttributesStep({
  form,
  patchAttrs,
}: {
  form: CreateLoadBalancerRequest;
  patchAttrs: (p: Partial<LoadBalancerAttributes>) => void;
}) {
  const a = form.attributes!;
  const isAlb = form.type === "application";

  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Attributes</h2>

      <div className="nm-grid cols-2">
        <div>
          <h4 style={{ margin: "8px 0", fontSize: 13, color: "var(--nm-text-dim)" }}>General</h4>
          <label className="nm-check">
            <input type="checkbox" checked={!!a.deletionProtectionEnabled}
              onChange={(e) => patchAttrs({ deletionProtectionEnabled: e.target.checked })} />
            Deletion protection
          </label>
          <label className="nm-check">
            <input type="checkbox" checked={!!a.crossZoneLoadBalancingEnabled}
              onChange={(e) => patchAttrs({ crossZoneLoadBalancingEnabled: e.target.checked })} />
            Cross-zone load balancing
          </label>
          <label className="nm-check">
            <input type="checkbox" checked={!!a.accessLogsEnabled}
              onChange={(e) => patchAttrs({ accessLogsEnabled: e.target.checked })} />
            Access logs
          </label>
          {a.accessLogsEnabled && (
            <>
              <div className="nm-form-row">
                <label>S3 bucket</label>
                <input value={a.accessLogsBucket ?? ""}
                  onChange={(e) => patchAttrs({ accessLogsBucket: e.target.value })}
                  placeholder="my-logs-bucket" />
              </div>
              <div className="nm-form-row">
                <label>Prefix</label>
                <input value={a.accessLogsPrefix ?? ""}
                  onChange={(e) => patchAttrs({ accessLogsPrefix: e.target.value })}
                  placeholder="elb/" />
              </div>
            </>
          )}
        </div>

        <div>
          {isAlb ? (
            <>
              <h4 style={{ margin: "8px 0", fontSize: 13, color: "var(--nm-text-dim)" }}>Application (L7)</h4>
              <div className="nm-form-row">
                <label>Idle timeout (seconds)</label>
                <input type="number" min={1} max={4000} value={a.idleTimeoutSeconds ?? 60}
                  onChange={(e) => patchAttrs({ idleTimeoutSeconds: Number(e.target.value) })} />
              </div>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.http2Enabled}
                  onChange={(e) => patchAttrs({ http2Enabled: e.target.checked })} />
                HTTP/2 enabled
              </label>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.dropInvalidHeaderFieldsEnabled}
                  onChange={(e) => patchAttrs({ dropInvalidHeaderFieldsEnabled: e.target.checked })} />
                Drop invalid header fields
              </label>
              <div className="nm-form-row">
                <label>Desync mitigation mode</label>
                <select value={a.desyncMitigationMode ?? "defensive"}
                  onChange={(e) => patchAttrs({ desyncMitigationMode: e.target.value as "monitor" | "defensive" | "strictest" })}>
                  <option value="monitor">monitor</option>
                  <option value="defensive">defensive</option>
                  <option value="strictest">strictest</option>
                </select>
              </div>
              <div className="nm-form-row">
                <label>XFF header processing</label>
                <select value={a.xffHeaderProcessingMode ?? "append"}
                  onChange={(e) => patchAttrs({ xffHeaderProcessingMode: e.target.value as "append" | "preserve" | "remove" })}>
                  <option value="append">append</option>
                  <option value="preserve">preserve</option>
                  <option value="remove">remove</option>
                </select>
              </div>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.xffClientPortEnabled}
                  onChange={(e) => patchAttrs({ xffClientPortEnabled: e.target.checked })} />
                Include X-Forwarded-For client port
              </label>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.wafFailOpenEnabled}
                  onChange={(e) => patchAttrs({ wafFailOpenEnabled: e.target.checked })} />
                WAF fail-open
              </label>
            </>
          ) : (
            <>
              <h4 style={{ margin: "8px 0", fontSize: 13, color: "var(--nm-text-dim)" }}>Network (L4)</h4>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.preserveClientIpEnabled}
                  onChange={(e) => patchAttrs({ preserveClientIpEnabled: e.target.checked })} />
                Preserve client IP
              </label>
              <label className="nm-check">
                <input type="checkbox" checked={!!a.connectionTerminationOnDeregistration}
                  onChange={(e) => patchAttrs({ connectionTerminationOnDeregistration: e.target.checked })} />
                Terminate connections on deregistration
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ------- Step 4 -------
function TagsStep({
  form,
  patch,
}: {
  form: CreateLoadBalancerRequest;
  patch: (p: Partial<CreateLoadBalancerRequest>) => void;
}) {
  const tags = form.tags ?? [];
  const setTag = (idx: number, key: string, value: string) => {
    const next = [...tags];
    next[idx] = { key, value };
    patch({ tags: next });
  };
  const addTag = () => patch({ tags: [...tags, { key: "", value: "" }] });
  const removeTag = (idx: number) => patch({ tags: tags.filter((_, i) => i !== idx) });

  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Tags</h2>
      {tags.length === 0 && <div className="nm-empty">No tags yet.</div>}
      {tags.map((t, i) => (
        <div key={i} className="nm-grid cols-3" style={{ alignItems: "end", marginBottom: 8 }}>
          <div className="nm-form-row" style={{ margin: 0 }}>
            <label>Key</label>
            <input value={t.key} onChange={(e) => setTag(i, e.target.value, t.value)} />
          </div>
          <div className="nm-form-row" style={{ margin: 0 }}>
            <label>Value</label>
            <input value={t.value} onChange={(e) => setTag(i, t.key, e.target.value)} />
          </div>
          <button className="nm-btn secondary small" onClick={() => removeTag(i)}>Remove</button>
        </div>
      ))}
      <button className="nm-btn secondary" onClick={addTag}>Add tag</button>
    </div>
  );
}

// ------- Step 5 -------
function ReviewStep({ form, vpc }: { form: CreateLoadBalancerRequest; vpc?: Vpc }) {
  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Review</h2>
      <dl className="nm-kv">
        <dt>Name</dt><dd>{form.name}</dd>
        <dt>Type</dt><dd>{form.type}</dd>
        <dt>Scheme</dt><dd>{form.scheme}</dd>
        <dt>IP address type</dt><dd>{form.ipAddressType}</dd>
        <dt>VPC</dt><dd>{vpc?.name} ({vpc?.id})</dd>
        <dt>Subnets</dt><dd>{form.subnetIds.join(", ")}</dd>
        {form.type === "application" && (
          <><dt>Security groups</dt><dd>{form.securityGroupIds?.join(", ") || "—"}</dd></>
        )}
        <dt>Tags</dt><dd>{form.tags?.length ? form.tags.map((t) => `${t.key}=${t.value}`).join(", ") : "—"}</dd>
      </dl>

      <h3 style={{ fontSize: 13, marginTop: 16 }}>Attributes</h3>
      <pre className="nm-code" style={{ whiteSpace: "pre-wrap", padding: 12, display: "block" }}>
        {JSON.stringify(form.attributes, null, 2)}
      </pre>

      <p className="help" style={{ marginTop: 12 }}>
        After creation, add listeners and listener rules on the load balancer details page.
      </p>
    </div>
  );
}
