import { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

export function Shell({ children }: PropsWithChildren) {
  return (
    <div className="nm-app">
      <header className="nm-topbar">
        <div className="nm-brand">
          <span className="cloud">&#9729;</span>
          Nimbus Console
        </div>
        <nav style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--nm-text-dim)" }}>
          <span>Region: <strong style={{ color: "var(--nm-text)" }}>pvt-cloud-1</strong></span>
          <span>Account: <strong style={{ color: "var(--nm-text)" }}>000000000000</strong></span>
        </nav>
        <div className="nm-topbar-right">
          <span>Welcome, cloud-admin</span>
        </div>
      </header>
      <div className="nm-shell">
        <aside className="nm-sidebar">
          <h5>Core</h5>
          <div className="nm-nav">
            <NavLink to="/" end>
              <span className="dot" /> Dashboard
            </NavLink>
          </div>

          <h5>Compute</h5>
          <div className="nm-nav">
            <NavLink to="/vm"><span className="dot" /> Virtual Machines</NavLink>
          </div>

          <h5>Storage</h5>
          <div className="nm-nav">
            <NavLink to="/storage"><span className="dot" /> Object Storage</NavLink>
          </div>

          <h5>Networking</h5>
          <div className="nm-nav">
            <NavLink to="/networking"><span className="dot" /> VPC</NavLink>
            <NavLink to="/elb/load-balancers">
              <span className="dot" style={{ background: "var(--nm-accent)" }} /> Load Balancers
            </NavLink>
            <NavLink to="/elb/target-groups"><span className="dot" /> Target Groups</NavLink>
          </div>

          <h5>Security</h5>
          <div className="nm-nav">
            <NavLink to="/security"><span className="dot" /> IAM &amp; Policies</NavLink>
          </div>
        </aside>
        <main className="nm-main">{children}</main>
      </div>
    </div>
  );
}
