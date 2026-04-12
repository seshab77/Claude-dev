import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { DashboardPage } from "./pages/DashboardPage";
import { LoadBalancersPage } from "./pages/LoadBalancersPage";
import { LoadBalancerDetailsPage } from "./pages/LoadBalancerDetailsPage";
import { CreateLoadBalancerPage } from "./pages/CreateLoadBalancerPage";
import { TargetGroupsPage } from "./pages/TargetGroupsPage";
import { TargetGroupDetailsPage } from "./pages/TargetGroupDetailsPage";
import { CreateTargetGroupPage } from "./pages/CreateTargetGroupPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/elb/load-balancers" element={<LoadBalancersPage />} />
        <Route path="/elb/load-balancers/new" element={<CreateLoadBalancerPage />} />
        <Route path="/elb/load-balancers/:id" element={<LoadBalancerDetailsPage />} />
        <Route path="/elb/target-groups" element={<TargetGroupsPage />} />
        <Route path="/elb/target-groups/new" element={<CreateTargetGroupPage />} />
        <Route path="/elb/target-groups/:id" element={<TargetGroupDetailsPage />} />
        <Route path="/vm" element={<ComingSoonPage service="Compute" />} />
        <Route path="/storage" element={<ComingSoonPage service="Storage" />} />
        <Route path="/networking" element={<ComingSoonPage service="Networking" />} />
        <Route path="/security" element={<ComingSoonPage service="Security" />} />
      </Routes>
    </Shell>
  );
}
