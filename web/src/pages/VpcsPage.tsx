import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Vpc } from "@nimbus/shared";
import { api } from "../api/client";

export function VpcsPage() {
  const [vpcs, setVpcs] = useState<Vpc[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .listVpcs()
      .then((r) => setVpcs(r.vpcs))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const visible = vpcs.filter(
    (v) =>
      v.name.toLowerCase().includes(filter.toLowerCase()) ||
      v.id.toLowerCase().includes(filter.toLowerCase()) ||
      v.cidrBlock.includes(filter),
  );

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete VPC "${name}"? Subnets are removed too. Refused if any load balancer or target group is still attached.`,
      )
    )
      return;
    try {
      await api.deleteVpc(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="nm-breadcrumbs">Networking &rsaquo; Virtual Private Clouds</div>
      <h1 className="nm-h1">VPCs</h1>
      <div className="nm-subtitle">
        Each VPC is an isolated virtual network. Create subnets across availability
        zones, then place load balancers and target groups inside it.
      </div>

      {error && <div className="nm-error">{error}</div>}

      <div className="nm-toolbar">
        <input
          type="search"
          placeholder="Filter by name, id, or CIDR"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Link className="nm-btn" to="/networking/vpcs/new">
          Create VPC
        </Link>
      </div>

      <div className="nm-panel" style={{ padding: 0 }}>
        <table className="nm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>VPC ID</th>
              <th>CIDR</th>
              <th>Region</th>
              <th>Subnets</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link to={`/networking/vpcs/${v.id}`}>{v.name}</Link>
                </td>
                <td className="nm-code">{v.id}</td>
                <td className="nm-code">{v.cidrBlock}</td>
                <td>{v.region}</td>
                <td>
                  {v.subnets.length}
                  <span style={{ color: "var(--nm-text-muted)", fontSize: 11, marginLeft: 6 }}>
                    ({v.subnets.filter((s) => s.type === "public").length} public ·{" "}
                    {v.subnets.filter((s) => s.type === "private").length} private)
                  </span>
                </td>
                <td>{v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"}</td>
                <td>
                  <button
                    className="nm-btn secondary small"
                    onClick={() => handleDelete(v.id, v.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="nm-empty">
                    No VPCs yet.{" "}
                    <Link to="/networking/vpcs/new">Create your first VPC</Link> so
                    you can launch load balancers and target groups inside it.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
