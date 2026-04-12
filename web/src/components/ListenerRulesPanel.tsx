import { useState } from "react";
import type {
  Listener,
  ListenerAction,
  ListenerRule,
  RuleCondition,
  TargetGroup,
} from "@nimbus/shared";
import { api } from "../api/client";
import { describeActions } from "../pages/LoadBalancerDetailsPage";

// ---------------------------------------------------------------------------
// ALB Listener rules editor.
//
// Supports every ALB condition type (host-header, path-pattern, http-header,
// http-request-method, query-string, source-ip) and every action type
// (forward multi-TG with weights, redirect, fixed-response, authenticate-oidc).
// ---------------------------------------------------------------------------

export function ListenerRulesPanel({
  listener,
  tgs,
  reload,
}: {
  listener: Listener;
  tgs: TargetGroup[];
  reload: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    await api.deleteRule(listener.id, ruleId);
    reload();
  };

  const sorted = [...listener.rules].sort((a, b) => a.priority - b.priority);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="nm-panel-header">
        <h2 className="nm-h2" style={{ fontSize: 14 }}>Listener rules</h2>
        <button className="nm-btn small" onClick={() => setAdding(true)}>Add rule</button>
      </div>

      {adding && (
        <AddRuleForm
          listener={listener}
          tgs={tgs}
          onCancel={() => setAdding(false)}
          onCreated={() => { setAdding(false); reload(); }}
        />
      )}

      <table className="nm-table">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Priority</th>
            <th>Conditions</th>
            <th>Actions</th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td>{r.isDefault ? <em>default</em> : r.priority}</td>
              <td>{describeConditions(r.conditions)}</td>
              <td>{describeActions(r.actions, tgs)}</td>
              <td>
                {!r.isDefault && (
                  <button className="nm-btn secondary small" onClick={() => deleteRule(r.id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={4}><div className="nm-empty">No rules.</div></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function describeConditions(cs: ListenerRule["conditions"]): string {
  if (cs.length === 0) return "(default)";
  return cs
    .map((c) => {
      switch (c.field) {
        case "host-header": return `host ∈ {${c.values.join(",")}}`;
        case "path-pattern": return `path ∈ {${c.values.join(",")}}`;
        case "http-header": return `header[${c.headerName}] ∈ {${c.values.join(",")}}`;
        case "http-request-method": return `method ∈ {${c.values.join(",")}}`;
        case "query-string": return `query ∈ {${c.values.map((v) => v.key ? `${v.key}=${v.value}` : v.value).join(",")}}`;
        case "source-ip": return `srcIp ∈ {${c.values.join(",")}}`;
      }
    })
    .join(" AND ");
}

type AddRuleFormProps = {
  listener: Listener;
  tgs: TargetGroup[];
  onCancel: () => void;
  onCreated: () => void;
};

function AddRuleForm({ listener, tgs, onCancel, onCreated }: AddRuleFormProps) {
  const [priority, setPriority] = useState<number>(
    nextPriority(listener.rules),
  );
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: "path-pattern", values: ["/api/*"] },
  ]);
  const [action, setAction] = useState<ListenerAction>({
    type: "forward",
    targetGroups: tgs[0] ? [{ targetGroupId: tgs[0].id, weight: 1 }] : [],
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await api.createRule(listener.id, { priority, conditions, actions: [action] });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="nm-panel" style={{ background: "var(--nm-panel-2)" }}>
      <h2 className="nm-h2" style={{ fontSize: 14 }}>New rule</h2>
      {error && <div className="nm-error">{error}</div>}

      <div className="nm-form-row" style={{ maxWidth: 160 }}>
        <label>Priority</label>
        <input type="number" min={1} max={50000} value={priority}
          onChange={(e) => setPriority(Number(e.target.value))} />
      </div>

      <h4 style={{ fontSize: 12, color: "var(--nm-text-dim)" }}>Conditions (AND)</h4>
      {conditions.map((c, i) => (
        <ConditionEditor
          key={i}
          condition={c}
          onChange={(next) => setConditions(conditions.map((x, j) => j === i ? next : x))}
          onRemove={() => setConditions(conditions.filter((_, j) => j !== i))}
        />
      ))}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["host-header", "path-pattern", "http-header", "http-request-method", "query-string", "source-ip"] as const).map((f) => (
          <button key={f} className="nm-btn secondary small"
            onClick={() => setConditions([...conditions, freshCondition(f)])}>
            + {f}
          </button>
        ))}
      </div>

      <h4 style={{ fontSize: 12, color: "var(--nm-text-dim)" }}>Action</h4>
      <ActionEditor action={action} tgs={tgs} onChange={setAction} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="nm-btn" onClick={submit}>Create rule</button>
        <button className="nm-btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function nextPriority(rules: ListenerRule[]): number {
  const nonDefault = rules.filter((r) => !r.isDefault).map((r) => r.priority);
  return (nonDefault.length === 0 ? 0 : Math.max(...nonDefault)) + 10;
}

function freshCondition(field: RuleCondition["field"]): RuleCondition {
  switch (field) {
    case "host-header": return { field, values: [""] };
    case "path-pattern": return { field, values: [""] };
    case "http-header": return { field, headerName: "", values: [""] };
    case "http-request-method": return { field, values: ["GET"] };
    case "query-string": return { field, values: [{ value: "" }] };
    case "source-ip": return { field, values: [""] };
  }
}

function ConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="nm-panel" style={{ margin: "8px 0", padding: 10, background: "var(--nm-panel)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ fontSize: 12 }}>{condition.field}</strong>
        <button className="nm-btn secondary small" onClick={onRemove}>Remove</button>
      </div>
      {condition.field === "http-header" && (
        <div className="nm-form-row">
          <label>Header name</label>
          <input value={condition.headerName}
            onChange={(e) => onChange({ ...condition, headerName: e.target.value })} />
        </div>
      )}
      {condition.field === "query-string" ? (
        <div className="nm-form-row">
          <label>Values (key=value pairs, one per line; key optional)</label>
          <textarea rows={3}
            value={condition.values.map((v) => v.key ? `${v.key}=${v.value}` : v.value).join("\n")}
            onChange={(e) => onChange({
              ...condition,
              values: e.target.value.split("\n").filter(Boolean).map((s) => {
                const [k, ...rest] = s.split("=");
                return rest.length ? { key: k, value: rest.join("=") } : { value: k };
              }),
            })} />
        </div>
      ) : (
        <div className="nm-form-row">
          <label>Values (one per line)</label>
          <textarea rows={3} value={(condition as { values: string[] }).values.join("\n")}
            onChange={(e) => onChange({ ...condition, values: e.target.value.split("\n").filter(Boolean) } as RuleCondition)} />
        </div>
      )}
    </div>
  );
}

function ActionEditor({
  action,
  tgs,
  onChange,
}: {
  action: ListenerAction;
  tgs: TargetGroup[];
  onChange: (a: ListenerAction) => void;
}) {
  return (
    <div>
      <div className="nm-form-row" style={{ maxWidth: 240 }}>
        <label>Type</label>
        <select
          value={action.type}
          onChange={(e) => {
            const t = e.target.value as ListenerAction["type"];
            if (t === "forward")
              onChange({ type: "forward", targetGroups: tgs[0] ? [{ targetGroupId: tgs[0].id, weight: 1 }] : [] });
            else if (t === "redirect")
              onChange({ type: "redirect", protocol: "HTTPS", port: "443", statusCode: "HTTP_301" });
            else if (t === "fixed-response")
              onChange({ type: "fixed-response", statusCode: "200", contentType: "text/plain", messageBody: "ok" });
            else
              onChange({
                type: "authenticate-oidc",
                issuer: "",
                authorizationEndpoint: "",
                tokenEndpoint: "",
                userInfoEndpoint: "",
                clientId: "",
              });
          }}
        >
          <option value="forward">forward</option>
          <option value="redirect">redirect</option>
          <option value="fixed-response">fixed-response</option>
          <option value="authenticate-oidc">authenticate-oidc</option>
        </select>
      </div>

      {action.type === "forward" && (
        <div>
          {action.targetGroups.map((tgt, i) => (
            <div key={i} className="nm-grid cols-3" style={{ marginBottom: 6 }}>
              <div className="nm-form-row">
                <label>Target group</label>
                <select value={tgt.targetGroupId}
                  onChange={(e) => {
                    const next = [...action.targetGroups];
                    next[i] = { ...tgt, targetGroupId: e.target.value };
                    onChange({ ...action, targetGroups: next });
                  }}>
                  {tgs.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div className="nm-form-row">
                <label>Weight</label>
                <input type="number" min={0} max={999} value={tgt.weight}
                  onChange={(e) => {
                    const next = [...action.targetGroups];
                    next[i] = { ...tgt, weight: Number(e.target.value) };
                    onChange({ ...action, targetGroups: next });
                  }} />
              </div>
              <button className="nm-btn secondary small" style={{ alignSelf: "end", height: 34 }}
                onClick={() => onChange({ ...action, targetGroups: action.targetGroups.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
          <button className="nm-btn secondary small"
            onClick={() => onChange({ ...action, targetGroups: [...action.targetGroups, { targetGroupId: tgs[0]?.id ?? "", weight: 1 }] })}>
            Add target group
          </button>
        </div>
      )}

      {action.type === "redirect" && (
        <div className="nm-grid cols-3">
          <div className="nm-form-row"><label>Protocol</label>
            <select value={action.protocol ?? "HTTPS"}
              onChange={(e) => onChange({ ...action, protocol: e.target.value as "HTTP" | "HTTPS" })}>
              <option>HTTPS</option><option>HTTP</option>
            </select></div>
          <div className="nm-form-row"><label>Port</label>
            <input value={action.port ?? ""}
              onChange={(e) => onChange({ ...action, port: e.target.value })} /></div>
          <div className="nm-form-row"><label>Status</label>
            <select value={action.statusCode}
              onChange={(e) => onChange({ ...action, statusCode: e.target.value as "HTTP_301" | "HTTP_302" })}>
              <option>HTTP_301</option><option>HTTP_302</option>
            </select></div>
          <div className="nm-form-row"><label>Host (optional)</label>
            <input value={action.host ?? ""} onChange={(e) => onChange({ ...action, host: e.target.value })} /></div>
          <div className="nm-form-row"><label>Path (optional)</label>
            <input value={action.path ?? ""} onChange={(e) => onChange({ ...action, path: e.target.value })} /></div>
          <div className="nm-form-row"><label>Query (optional)</label>
            <input value={action.query ?? ""} onChange={(e) => onChange({ ...action, query: e.target.value })} /></div>
        </div>
      )}

      {action.type === "fixed-response" && (
        <div className="nm-grid cols-3">
          <div className="nm-form-row"><label>Status</label>
            <input value={action.statusCode}
              onChange={(e) => onChange({ ...action, statusCode: e.target.value })} /></div>
          <div className="nm-form-row"><label>Content type</label>
            <select value={action.contentType ?? "text/plain"}
              onChange={(e) => onChange({ ...action, contentType: e.target.value as "text/plain" | "text/html" | "application/json" })}>
              <option>text/plain</option><option>text/html</option><option>application/json</option>
            </select></div>
          <div className="nm-form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Body</label>
            <textarea rows={3} value={action.messageBody ?? ""}
              onChange={(e) => onChange({ ...action, messageBody: e.target.value })} />
          </div>
        </div>
      )}

      {action.type === "authenticate-oidc" && (
        <div className="nm-grid cols-2">
          <div className="nm-form-row"><label>Issuer</label>
            <input value={action.issuer} onChange={(e) => onChange({ ...action, issuer: e.target.value })} /></div>
          <div className="nm-form-row"><label>Authorization endpoint</label>
            <input value={action.authorizationEndpoint}
              onChange={(e) => onChange({ ...action, authorizationEndpoint: e.target.value })} /></div>
          <div className="nm-form-row"><label>Token endpoint</label>
            <input value={action.tokenEndpoint}
              onChange={(e) => onChange({ ...action, tokenEndpoint: e.target.value })} /></div>
          <div className="nm-form-row"><label>UserInfo endpoint</label>
            <input value={action.userInfoEndpoint}
              onChange={(e) => onChange({ ...action, userInfoEndpoint: e.target.value })} /></div>
          <div className="nm-form-row"><label>Client ID</label>
            <input value={action.clientId}
              onChange={(e) => onChange({ ...action, clientId: e.target.value })} /></div>
          <div className="nm-form-row"><label>Client secret</label>
            <input type="password" value={action.clientSecret ?? ""}
              onChange={(e) => onChange({ ...action, clientSecret: e.target.value })} /></div>
        </div>
      )}
    </div>
  );
}
