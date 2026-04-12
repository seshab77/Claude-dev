import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  Listener,
  ListenerAction,
  ListenerProtocol,
  LoadBalancer,
  TargetGroup,
} from "@nimbus/shared";
import { api } from "../api/client";
import { ListenerRulesPanel } from "../components/ListenerRulesPanel";

type Tab = "description" | "listeners" | "attributes" | "tags";

export function LoadBalancerDetailsPage() {
  const { id = "" } = useParams();
  const [lb, setLb] = useState<LoadBalancer | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [tgs, setTgs] = useState<TargetGroup[]>([]);
  const [tab, setTab] = useState<Tab>("description");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .getLoadBalancer(id)
      .then((r) => {
        setLb(r.loadBalancer);
        setListeners(r.listeners);
      })
      .catch((e) => setError(e.message));
    api.listTargetGroups().then((r) => setTgs(r.targetGroups));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="nm-error">{error}</div>;
  if (!lb) return <div className="nm-empty">Loading...</div>;

  return (
    <>
      <div className="nm-breadcrumbs">
        <Link to="/elb/load-balancers">Load balancers</Link> &rsaquo; {lb.name}
      </div>
      <h1 className="nm-h1">
        {lb.name}{" "}
        <span className={`nm-badge ${lb.state.code}`} style={{ marginLeft: 8 }}>
          {lb.state.code.replace("_", " ")}
        </span>
        <span className="nm-badge type" style={{ marginLeft: 6 }}>{lb.type}</span>
      </h1>

      <div className="nm-tabs">
        <button className={`nm-tab ${tab === "description" ? "active" : ""}`} onClick={() => setTab("description")}>Description</button>
        <button className={`nm-tab ${tab === "listeners" ? "active" : ""}`} onClick={() => setTab("listeners")}>Listeners &amp; rules</button>
        <button className={`nm-tab ${tab === "attributes" ? "active" : ""}`} onClick={() => setTab("attributes")}>Attributes</button>
        <button className={`nm-tab ${tab === "tags" ? "active" : ""}`} onClick={() => setTab("tags")}>Tags</button>
      </div>

      {tab === "description" && <DescriptionPanel lb={lb} />}
      {tab === "listeners" && (
        <ListenersPanel lb={lb} listeners={listeners} tgs={tgs} reload={load} />
      )}
      {tab === "attributes" && <AttributesPanel lb={lb} />}
      {tab === "tags" && <TagsPanel lb={lb} />}
    </>
  );
}

// --- Description ---
function DescriptionPanel({ lb }: { lb: LoadBalancer }) {
  return (
    <div className="nm-panel">
      <dl className="nm-kv">
        <dt>ID</dt><dd className="nm-code">{lb.id}</dd>
        <dt>ARN</dt><dd className="nm-code">{lb.arn}</dd>
        <dt>DNS name</dt><dd className="nm-code">{lb.dnsName}</dd>
        <dt>Hosted zone</dt><dd className="nm-code">{lb.canonicalHostedZoneId}</dd>
        <dt>Scheme</dt><dd>{lb.scheme}</dd>
        <dt>IP address type</dt><dd>{lb.ipAddressType}</dd>
        <dt>VPC</dt><dd>{lb.vpcId}</dd>
        <dt>Availability zones</dt>
        <dd>
          {lb.availabilityZones.map((az) => (
            <div key={az.subnetId}>
              {az.zoneName} · {az.subnetId}
              {az.staticIp && <> · <span className="nm-code">{az.staticIp}</span></>}
            </div>
          ))}
        </dd>
        <dt>Security groups</dt><dd>{lb.securityGroupIds.length ? lb.securityGroupIds.join(", ") : "—"}</dd>
        <dt>Created</dt><dd>{new Date(lb.createdAt).toLocaleString()}</dd>
      </dl>
    </div>
  );
}

// --- Listeners ---
function ListenersPanel({
  lb,
  listeners,
  tgs,
  reload,
}: {
  lb: LoadBalancer;
  listeners: Listener[];
  tgs: TargetGroup[];
  reload: () => void;
}) {
  const [creating, setCreating] = useState(false);

  const deleteListener = async (lid: string) => {
    if (!confirm("Delete listener?")) return;
    await api.deleteListener(lid);
    reload();
  };

  return (
    <>
      <div className="nm-toolbar">
        <div />
        <button className="nm-btn" onClick={() => setCreating(true)}>Add listener</button>
      </div>

      {creating && (
        <CreateListenerForm
          lb={lb}
          tgs={tgs.filter((t) => t.vpcId === lb.vpcId)}
          onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      {listeners.length === 0 && !creating && (
        <div className="nm-panel"><div className="nm-empty">No listeners yet.</div></div>
      )}

      {listeners.map((l) => (
        <div key={l.id} className="nm-panel">
          <div className="nm-panel-header">
            <h2 className="nm-h2">
              {l.protocol}:{l.port}
              <span className="nm-code" style={{ marginLeft: 10, fontSize: 11 }}>{l.id}</span>
            </h2>
            <button className="nm-btn secondary small" onClick={() => deleteListener(l.id)}>Delete</button>
          </div>
          <dl className="nm-kv">
            {l.sslPolicy && (<><dt>SSL policy</dt><dd>{l.sslPolicy}</dd></>)}
            {l.certificates && l.certificates.length > 0 && (
              <><dt>Certificates</dt><dd>{l.certificates.map((c) => c.arn).join(", ")}</dd></>
            )}
            {l.alpnPolicy && (<><dt>ALPN</dt><dd>{l.alpnPolicy}</dd></>)}
            <dt>Default action</dt>
            <dd>{describeActions(l.defaultActions, tgs)}</dd>
          </dl>
          {lb.type === "application" && (
            <ListenerRulesPanel listener={l} tgs={tgs} reload={reload} />
          )}
        </div>
      ))}
    </>
  );
}

export function describeActions(actions: ListenerAction[], tgs: TargetGroup[]): string {
  return actions
    .map((a) => {
      switch (a.type) {
        case "forward":
          return `forward → ${a.targetGroups
            .map((t) => {
              const tg = tgs.find((x) => x.id === t.targetGroupId);
              return `${tg ? tg.name : t.targetGroupId} (${t.weight})`;
            })
            .join(", ")}`;
        case "redirect":
          return `redirect → ${a.protocol ?? "#{protocol}"}://${a.host ?? "#{host}"}:${a.port ?? "#{port}"}${a.path ?? ""} [${a.statusCode}]`;
        case "fixed-response":
          return `fixed-response ${a.statusCode}`;
        case "authenticate-oidc":
          return `authenticate-oidc (${a.issuer})`;
      }
    })
    .join(" · ");
}

function CreateListenerForm({
  lb,
  tgs,
  onCancel,
  onCreated,
}: {
  lb: LoadBalancer;
  tgs: TargetGroup[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const isAlb = lb.type === "application";
  const [protocol, setProtocol] = useState<ListenerProtocol>(isAlb ? "HTTPS" : "TCP");
  const [port, setPort] = useState<number>(isAlb ? 443 : 80);
  const [actionKind, setActionKind] = useState<"forward" | "redirect" | "fixed-response">("forward");
  const [targetGroupId, setTargetGroupId] = useState<string>(tgs[0]?.id ?? "");
  const [redirectPort, setRedirectPort] = useState("443");
  const [redirectProto, setRedirectProto] = useState<"HTTP" | "HTTPS">("HTTPS");
  const [fixedStatus, setFixedStatus] = useState("200");
  const [fixedBody, setFixedBody] = useState("ok");
  const [certArn, setCertArn] = useState("arn:nimbus:certs:pvt-cloud-1:000000000000:cert/default");
  const [error, setError] = useState<string | null>(null);

  const albProtos: ListenerProtocol[] = ["HTTP", "HTTPS"];
  const nlbProtos: ListenerProtocol[] = ["TCP", "UDP", "TCP_UDP", "TLS"];
  const protos = isAlb ? albProtos : nlbProtos;

  const submit = async () => {
    setError(null);
    try {
      let action: ListenerAction;
      if (actionKind === "forward") {
        if (!targetGroupId) throw new Error("Choose a target group");
        action = { type: "forward", targetGroups: [{ targetGroupId, weight: 1 }] };
      } else if (actionKind === "redirect") {
        action = { type: "redirect", protocol: redirectProto, port: redirectPort, statusCode: "HTTP_301" };
      } else {
        action = { type: "fixed-response", statusCode: fixedStatus, contentType: "text/plain", messageBody: fixedBody };
      }

      await api.createListener({
        loadBalancerId: lb.id,
        protocol,
        port,
        certificates:
          protocol === "HTTPS" || protocol === "TLS"
            ? [{ arn: certArn, isDefault: true }]
            : undefined,
        sslPolicy:
          protocol === "HTTPS" || protocol === "TLS"
            ? "ELBSecurityPolicy-TLS13-1-2-2021-06"
            : undefined,
        defaultActions: [action],
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Add listener</h2>
      {error && <div className="nm-error">{error}</div>}

      <div className="nm-grid cols-3">
        <div className="nm-form-row">
          <label>Protocol</label>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value as ListenerProtocol)}>
            {protos.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="nm-form-row">
          <label>Port</label>
          <input type="number" value={port} min={1} max={65535} onChange={(e) => setPort(Number(e.target.value))} />
        </div>
        <div className="nm-form-row">
          <label>Default action</label>
          <select value={actionKind} onChange={(e) => setActionKind(e.target.value as typeof actionKind)}>
            <option value="forward">Forward to target group</option>
            {isAlb && <option value="redirect">Redirect</option>}
            {isAlb && <option value="fixed-response">Fixed response</option>}
          </select>
        </div>
      </div>

      {(protocol === "HTTPS" || protocol === "TLS") && (
        <div className="nm-form-row">
          <label>Certificate ARN</label>
          <input value={certArn} onChange={(e) => setCertArn(e.target.value)} />
        </div>
      )}

      {actionKind === "forward" && (
        <div className="nm-form-row">
          <label>Target group</label>
          <select value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
            {tgs.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.protocol}:{t.port})</option>
            ))}
          </select>
          {tgs.length === 0 && (
            <div className="help">No target groups in this VPC. <Link to="/elb/target-groups/new">Create one</Link> first.</div>
          )}
        </div>
      )}

      {actionKind === "redirect" && (
        <div className="nm-grid cols-2">
          <div className="nm-form-row">
            <label>To protocol</label>
            <select value={redirectProto} onChange={(e) => setRedirectProto(e.target.value as "HTTP" | "HTTPS")}>
              <option>HTTPS</option>
              <option>HTTP</option>
            </select>
          </div>
          <div className="nm-form-row">
            <label>To port</label>
            <input value={redirectPort} onChange={(e) => setRedirectPort(e.target.value)} />
          </div>
        </div>
      )}

      {actionKind === "fixed-response" && (
        <div className="nm-grid cols-2">
          <div className="nm-form-row">
            <label>Status code</label>
            <input value={fixedStatus} onChange={(e) => setFixedStatus(e.target.value)} />
          </div>
          <div className="nm-form-row">
            <label>Body</label>
            <input value={fixedBody} onChange={(e) => setFixedBody(e.target.value)} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="nm-btn" onClick={submit}>Add listener</button>
        <button className="nm-btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function AttributesPanel({ lb }: { lb: LoadBalancer }) {
  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Attributes</h2>
      <pre className="nm-code" style={{ padding: 12, display: "block", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(lb.attributes, null, 2)}
      </pre>
    </div>
  );
}

function TagsPanel({ lb }: { lb: LoadBalancer }) {
  return (
    <div className="nm-panel">
      <h2 className="nm-h2">Tags</h2>
      {lb.tags.length === 0 ? (
        <div className="nm-empty">No tags.</div>
      ) : (
        <table className="nm-table">
          <thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody>
            {lb.tags.map((t) => (
              <tr key={t.key}><td>{t.key}</td><td>{t.value}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
