import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CreateSubnetRequest, Vpc } from "@nimbus/shared";
import { api } from "../api/client";

export function VpcDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [vpc, setVpc] = useState<Vpc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subnetForm, setSubnetForm] = useState<CreateSubnetRequest>({
    availabilityZone: "pvt-cloud-1a",
    cidrBlock: "",
    type: "public",
  });
  const [adding, setAdding] = useState(false);

  const load = () =>
    api
      .getVpc(id)
      .then((r) => setVpc(r.vpc))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!vpc) return <div className="nm-empty">Loading...</div>;

  const addSubnet = async () => {
    setError(null);
    setAdding(true);
    try {
      const { vpc: updated } = await api.createSubnet(vpc.id, subnetForm);
      setVpc(updated);
      setSubnetForm({ ...subnetForm, cidrBlock: "" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const removeSubnet = async (subnetId: string) => {
    if (!confirm(`Remove subnet ${subnetId}?`)) return;
    try {
      await api.deleteSubnet(vpc.id, subnetId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeVpc = async () => {
    if (
      !confirm(
        `Delete VPC "${vpc.name}"? Refused if any load balancer or target group is still attached.`,
      )
    )
      return;
    try {
      await api.deleteVpc(vpc.id);
      navigate("/networking/vpcs");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="nm-breadcrumbs">
        <Link to="/networking/vpcs">VPCs</Link> &rsaquo; {vpc.name}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 className="nm-h1">{vpc.name}</h1>
        <button className="nm-btn secondary" onClick={removeVpc}>
          Delete VPC
        </button>
      </div>

      {error && <div className="nm-error">{error}</div>}

      <div className="nm-panel">
        <h2 className="nm-h2">Details</h2>
        <dl className="nm-kv">
          <dt>VPC ID</dt>
          <dd className="nm-code">{vpc.id}</dd>
          <dt>CIDR block</dt>
          <dd className="nm-code">{vpc.cidrBlock}</dd>
          <dt>Region</dt>
          <dd>{vpc.region}</dd>
          <dt>Created</dt>
          <dd>{vpc.createdAt ? new Date(vpc.createdAt).toLocaleString() : "—"}</dd>
          <dt>Tags</dt>
          <dd>
            {vpc.tags && vpc.tags.length > 0
              ? vpc.tags.map((t) => `${t.key}=${t.value}`).join(", ")
              : "—"}
          </dd>
        </dl>
      </div>

      <div className="nm-panel">
        <div className="nm-panel-header">
          <h2 className="nm-h2">Subnets</h2>
          <span style={{ color: "var(--nm-text-dim)", fontSize: 12 }}>
            {vpc.subnets.length} total
          </span>
        </div>

        <div
          className="nm-grid cols-4"
          style={{ alignItems: "end", marginBottom: 12, gap: 12 }}
        >
          <div className="nm-form-row" style={{ margin: 0 }}>
            <label>Availability zone</label>
            <input
              value={subnetForm.availabilityZone}
              onChange={(e) =>
                setSubnetForm({ ...subnetForm, availabilityZone: e.target.value })
              }
              placeholder="pvt-cloud-1a"
            />
          </div>
          <div className="nm-form-row" style={{ margin: 0 }}>
            <label>CIDR block</label>
            <input
              value={subnetForm.cidrBlock}
              onChange={(e) =>
                setSubnetForm({ ...subnetForm, cidrBlock: e.target.value })
              }
              placeholder="10.0.10.0/24"
            />
          </div>
          <div className="nm-form-row" style={{ margin: 0 }}>
            <label>Type</label>
            <select
              value={subnetForm.type}
              onChange={(e) =>
                setSubnetForm({
                  ...subnetForm,
                  type: e.target.value as "public" | "private",
                })
              }
            >
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </div>
          <button
            className="nm-btn"
            style={{ height: 34 }}
            onClick={addSubnet}
            disabled={adding || !subnetForm.cidrBlock || !subnetForm.availabilityZone}
          >
            {adding ? "Adding..." : "Add subnet"}
          </button>
        </div>

        <table className="nm-table">
          <thead>
            <tr>
              <th>Subnet ID</th>
              <th>Availability zone</th>
              <th>CIDR</th>
              <th>Type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vpc.subnets.map((s) => (
              <tr key={s.id}>
                <td className="nm-code">{s.id}</td>
                <td>{s.availabilityZone}</td>
                <td className="nm-code">{s.cidrBlock}</td>
                <td>
                  <span className="nm-badge type">{s.type ?? "—"}</span>
                </td>
                <td>
                  <button
                    className="nm-btn secondary small"
                    onClick={() => removeSubnet(s.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {vpc.subnets.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="nm-empty">
                    No subnets in this VPC. Add one above before launching a load
                    balancer.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="nm-panel">
        <h2 className="nm-h2">Use this VPC</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="nm-btn" to="/elb/load-balancers/new">
            Create load balancer
          </Link>
          <Link className="nm-btn secondary" to="/elb/target-groups/new">
            Create target group
          </Link>
        </div>
      </div>
    </>
  );
}
