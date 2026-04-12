import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { TargetGroup } from "@nimbus/shared";

export function TargetGroupsPage() {
  const [tgs, setTgs] = useState<TargetGroup[]>([]);

  useEffect(() => {
    const load = () => api.listTargetGroups().then((r) => setTgs(r.targetGroups));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="nm-breadcrumbs">Elastic Load Balancing &rsaquo; Target groups</div>
      <h1 className="nm-h1">Target groups</h1>

      <div className="nm-toolbar">
        <div />
        <Link className="nm-btn" to="/elb/target-groups/new">Create target group</Link>
      </div>

      <div className="nm-panel" style={{ padding: 0 }}>
        <table className="nm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target type</th>
              <th>Protocol : port</th>
              <th>VPC</th>
              <th>Health (healthy / total)</th>
              <th>Algorithm</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tgs.map((t) => {
              const healthy = t.targets.filter((x) => x.health.state === "healthy").length;
              return (
                <tr key={t.id}>
                  <td><Link to={`/elb/target-groups/${t.id}`}>{t.name}</Link></td>
                  <td>{t.targetType}</td>
                  <td>{t.protocol}:{t.port}</td>
                  <td>{t.vpcId}</td>
                  <td>{healthy} / {t.targets.length}</td>
                  <td>{t.loadBalancingAlgorithm}</td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
            {tgs.length === 0 && (
              <tr><td colSpan={7}><div className="nm-empty">No target groups.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
