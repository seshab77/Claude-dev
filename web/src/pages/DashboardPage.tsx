import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { LoadBalancer, TargetGroup } from "@nimbus/shared";

export function DashboardPage() {
  const [lbs, setLbs] = useState<LoadBalancer[]>([]);
  const [tgs, setTgs] = useState<TargetGroup[]>([]);

  useEffect(() => {
    api.listLoadBalancers().then((r) => setLbs(r.loadBalancers));
    api.listTargetGroups().then((r) => setTgs(r.targetGroups));
  }, []);

  const albs = lbs.filter((l) => l.type === "application").length;
  const nlbs = lbs.filter((l) => l.type === "network").length;
  const healthyTargets = tgs.reduce(
    (n, t) => n + t.targets.filter((x) => x.health.state === "healthy").length,
    0,
  );
  const totalTargets = tgs.reduce((n, t) => n + t.targets.length, 0);

  return (
    <>
      <div className="nm-breadcrumbs">Console home</div>
      <h1 className="nm-h1">Welcome to Nimbus</h1>
      <p className="nm-subtitle">
        Consume compute, storage, networking, load-balancing and security services
        from your private cloud.
      </p>

      <div className="nm-grid cols-4" style={{ marginBottom: 24 }}>
        <StatCard label="Application LBs" value={albs} />
        <StatCard label="Network LBs" value={nlbs} />
        <StatCard label="Target Groups" value={tgs.length} />
        <StatCard
          label="Healthy Targets"
          value={`${healthyTargets} / ${totalTargets}`}
        />
      </div>

      <div className="nm-grid cols-2">
        <div className="nm-panel">
          <div className="nm-panel-header">
            <h2 className="nm-h2">Load Balancers</h2>
            <Link className="nm-btn small" to="/elb/load-balancers/new">Create</Link>
          </div>
          {lbs.length === 0 ? (
            <div className="nm-empty">No load balancers yet.</div>
          ) : (
            <table className="nm-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>State</th></tr>
              </thead>
              <tbody>
                {lbs.slice(0, 5).map((lb) => (
                  <tr key={lb.id}>
                    <td><Link to={`/elb/load-balancers/${lb.id}`}>{lb.name}</Link></td>
                    <td><span className="nm-badge type">{lb.type}</span></td>
                    <td><span className={`nm-badge ${lb.state.code}`}>{lb.state.code.replace("_", " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="nm-panel">
          <div className="nm-panel-header">
            <h2 className="nm-h2">Quick links</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li><Link to="/elb/load-balancers">Manage load balancers</Link></li>
            <li><Link to="/elb/load-balancers/new">Create a new load balancer</Link></li>
            <li><Link to="/elb/target-groups">Manage target groups</Link></li>
            <li><Link to="/elb/target-groups/new">Create a new target group</Link></li>
          </ul>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="nm-panel" style={{ marginBottom: 0 }}>
      <div style={{ color: "var(--nm-text-dim)", fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
