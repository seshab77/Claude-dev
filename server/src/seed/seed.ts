import type { Vpc } from "@nimbus/shared";
import { store } from "../store/memory.js";
import { buildTargetGroup } from "../domain/targetGroup.js";
import { buildLoadBalancer } from "../domain/loadBalancer.js";
import { buildListener } from "../domain/listener.js";

export function seed(): void {
  // ---- VPCs & subnets ----
  const now = new Date().toISOString();
  const vpc: Vpc = {
    id: "vpc-prod",
    name: "prod",
    cidrBlock: "10.10.0.0/16",
    region: "pvt-cloud-1",
    createdAt: now,
    tags: [{ key: "env", value: "prod" }],
    subnets: [
      { id: "subnet-1a", availabilityZone: "pvt-cloud-1a", cidrBlock: "10.10.1.0/24", vpcId: "vpc-prod", type: "public" },
      { id: "subnet-1b", availabilityZone: "pvt-cloud-1b", cidrBlock: "10.10.2.0/24", vpcId: "vpc-prod", type: "public" },
      { id: "subnet-1c", availabilityZone: "pvt-cloud-1c", cidrBlock: "10.10.3.0/24", vpcId: "vpc-prod", type: "private" },
    ],
  };
  store.putVpc(vpc);

  const stagingVpc: Vpc = {
    id: "vpc-staging",
    name: "staging",
    cidrBlock: "10.20.0.0/16",
    region: "pvt-cloud-1",
    createdAt: now,
    tags: [{ key: "env", value: "staging" }],
    subnets: [
      { id: "subnet-2a", availabilityZone: "pvt-cloud-1a", cidrBlock: "10.20.1.0/24", vpcId: "vpc-staging", type: "public" },
      { id: "subnet-2b", availabilityZone: "pvt-cloud-1b", cidrBlock: "10.20.2.0/24", vpcId: "vpc-staging", type: "private" },
    ],
  };
  store.putVpc(stagingVpc);

  // ---- Target groups ----
  const webTg = buildTargetGroup({
    name: "web-http",
    targetType: "instance",
    protocol: "HTTP",
    port: 8080,
    vpcId: vpc.id,
    healthCheck: { protocol: "HTTP", path: "/healthz", port: "traffic-port" },
  });
  webTg.targets = [
    { id: "i-0aa01", port: 8080, availabilityZone: "pvt-cloud-1a", health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
    { id: "i-0aa02", port: 8080, availabilityZone: "pvt-cloud-1b", health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
    { id: "i-0aa03", port: 8080, availabilityZone: "pvt-cloud-1c", health: { state: "unhealthy", reasonCode: "Target.FailedHealthChecks", description: "Health checks failed with HTTP 502", lastTransitionAt: new Date().toISOString() } },
  ];
  store.putTargetGroup(webTg);

  const apiTg = buildTargetGroup({
    name: "api-http",
    targetType: "ip",
    protocol: "HTTP",
    port: 9000,
    vpcId: vpc.id,
    healthCheck: { protocol: "HTTP", path: "/api/health", port: "traffic-port" },
    stickiness: { enabled: true, type: "lb_cookie", durationSeconds: 3600 },
    loadBalancingAlgorithm: "least_outstanding_requests",
  });
  apiTg.targets = [
    { id: "10.10.1.45", port: 9000, availabilityZone: "pvt-cloud-1a", health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
    { id: "10.10.2.71", port: 9000, availabilityZone: "pvt-cloud-1b", health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
  ];
  store.putTargetGroup(apiTg);

  const tcpTg = buildTargetGroup({
    name: "db-tcp",
    targetType: "ip",
    protocol: "TCP",
    port: 5432,
    vpcId: vpc.id,
    preserveClientIp: true,
    proxyProtocolV2: false,
    healthCheck: { protocol: "TCP", port: 5432 },
  });
  tcpTg.targets = [
    { id: "10.10.1.20", port: 5432, health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
    { id: "10.10.2.20", port: 5432, health: { state: "healthy", lastTransitionAt: new Date().toISOString() } },
  ];
  store.putTargetGroup(tcpTg);

  // ---- A sample application load balancer ----
  const alb = buildLoadBalancer(
    {
      name: "shop-frontend",
      type: "application",
      scheme: "internet-facing",
      ipAddressType: "ipv4",
      vpcId: vpc.id,
      subnetIds: ["subnet-1a", "subnet-1b", "subnet-1c"],
      securityGroupIds: ["sg-web"],
      tags: [
        { key: "env", value: "prod" },
        { key: "team", value: "platform" },
      ],
    },
    vpc,
  );
  alb.state = { code: "active" };
  store.putLoadBalancer(alb);

  const http = buildListener(
    {
      loadBalancerId: alb.id,
      protocol: "HTTP",
      port: 80,
      defaultActions: [
        {
          type: "redirect",
          protocol: "HTTPS",
          port: "443",
          statusCode: "HTTP_301",
        },
      ],
    },
    alb,
  );
  store.putListener(http);

  const https = buildListener(
    {
      loadBalancerId: alb.id,
      protocol: "HTTPS",
      port: 443,
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      certificates: [{ arn: "arn:nimbus:certs:pvt-cloud-1:000000000000:cert/shop-wildcard", isDefault: true }],
      defaultActions: [
        {
          type: "forward",
          targetGroups: [{ targetGroupId: webTg.id, weight: 1 }],
        },
      ],
    },
    alb,
  );
  https.rules = [
    {
      id: "rule-default",
      priority: 0,
      isDefault: true,
      conditions: [],
      actions: https.defaultActions,
    },
    {
      id: "rule-api",
      priority: 10,
      isDefault: false,
      conditions: [
        { field: "host-header", values: ["api.shop.example.com"] },
        { field: "path-pattern", values: ["/v1/*", "/v2/*"] },
      ],
      actions: [
        {
          type: "forward",
          targetGroups: [{ targetGroupId: apiTg.id, weight: 1 }],
          stickiness: { enabled: true, durationSeconds: 3600 },
        },
      ],
    },
    {
      id: "rule-canary",
      priority: 20,
      isDefault: false,
      conditions: [
        { field: "http-header", headerName: "X-Canary", values: ["true"] },
      ],
      actions: [
        {
          type: "forward",
          targetGroups: [
            { targetGroupId: apiTg.id, weight: 9 },
            { targetGroupId: webTg.id, weight: 1 },
          ],
        },
      ],
    },
    {
      id: "rule-healthz",
      priority: 30,
      isDefault: false,
      conditions: [{ field: "path-pattern", values: ["/healthz"] }],
      actions: [
        {
          type: "fixed-response",
          statusCode: "200",
          contentType: "text/plain",
          messageBody: "ok",
        },
      ],
    },
  ];
  store.putListener(https);

  // ---- A sample network load balancer ----
  const nlb = buildLoadBalancer(
    {
      name: "db-proxy",
      type: "network",
      scheme: "internal",
      ipAddressType: "ipv4",
      vpcId: vpc.id,
      subnetIds: ["subnet-1a", "subnet-1b"],
      attributes: { crossZoneLoadBalancingEnabled: true },
    },
    vpc,
  );
  nlb.state = { code: "active" };
  store.putLoadBalancer(nlb);

  const tcpListener = buildListener(
    {
      loadBalancerId: nlb.id,
      protocol: "TCP",
      port: 5432,
      defaultActions: [
        {
          type: "forward",
          targetGroups: [{ targetGroupId: tcpTg.id, weight: 1 }],
        },
      ],
    },
    nlb,
  );
  store.putListener(tcpListener);
}
