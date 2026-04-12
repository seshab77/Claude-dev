import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { LoadBalancer } from "@nimbus/shared";

export function LoadBalancersPage() {
  const [lbs, setLbs] = useState<LoadBalancer[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .listLoadBalancers()
      .then((r) => setLbs(r.loadBalancers))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const visible = lbs.filter(
    (l) =>
      l.name.toLowerCase().includes(filter.toLowerCase()) ||
      l.dnsName.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete load balancer "${name}"? This also removes its listeners.`)) return;
    try {
      await api.deleteLoadBalancer(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="nm-breadcrumbs">Elastic Load Balancing &rsaquo; Load balancers</div>
      <h1 className="nm-h1">Load balancers</h1>

      {error && <div className="nm-error">{error}</div>}

      <div className="nm-toolbar">
        <input
          type="search"
          placeholder="Filter load balancers"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Link className="nm-btn" to="/elb/load-balancers/new">
          Create load balancer
        </Link>
      </div>

      <div className="nm-panel" style={{ padding: 0 }}>
        <table className="nm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Scheme</th>
              <th>DNS name</th>
              <th>VPC</th>
              <th>State</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((lb) => (
              <tr key={lb.id}>
                <td>
                  <Link to={`/elb/load-balancers/${lb.id}`}>{lb.name}</Link>
                  <div style={{ color: "var(--nm-text-muted)", fontSize: 11 }}>
                    {lb.id}
                  </div>
                </td>
                <td><span className="nm-badge type">{lb.type}</span></td>
                <td>{lb.scheme}</td>
                <td className="nm-code">{lb.dnsName}</td>
                <td>{lb.vpcId}</td>
                <td>
                  <span className={`nm-badge ${lb.state.code}`}>
                    {lb.state.code === "provisioning" && <span className="nm-spinner" style={{ marginRight: 6 }} />}
                    {lb.state.code.replace("_", " ")}
                  </span>
                </td>
                <td>{new Date(lb.createdAt).toLocaleString()}</td>
                <td>
                  <button
                    className="nm-btn secondary small"
                    onClick={() => handleDelete(lb.id, lb.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8}><div className="nm-empty">No load balancers match your filter.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
