import type {
  CreateLoadBalancerRequest,
  LoadBalancer,
  LoadBalancerAttributes,
  Vpc,
} from "@nimbus/shared";
import { shortId, arnFor } from "../store/ids.js";

const DEFAULT_ATTRS_ALB: LoadBalancerAttributes = {
  deletionProtectionEnabled: false,
  accessLogsEnabled: false,
  idleTimeoutSeconds: 60,
  http2Enabled: true,
  dropInvalidHeaderFieldsEnabled: false,
  desyncMitigationMode: "defensive",
  xffHeaderProcessingMode: "append",
  xffClientPortEnabled: false,
  xAmznTlsVersionAndCipherSuiteHeaderEnabled: false,
  crossZoneLoadBalancingEnabled: true,
  wafFailOpenEnabled: false,
};

const DEFAULT_ATTRS_NLB: LoadBalancerAttributes = {
  deletionProtectionEnabled: false,
  accessLogsEnabled: false,
  crossZoneLoadBalancingEnabled: false,
  connectionTerminationOnDeregistration: false,
  preserveClientIpEnabled: true,
};

/** Build a fresh load balancer object from a create request. */
export function buildLoadBalancer(
  req: CreateLoadBalancerRequest,
  vpc: Vpc,
): LoadBalancer {
  const id = shortId("lb");
  const azs = req.subnetIds.map((subnetId) => {
    const subnet = vpc.subnets.find((s) => s.id === subnetId);
    if (!subnet) throw new Error(`unknown subnet: ${subnetId}`);
    return {
      zoneName: subnet.availabilityZone,
      subnetId: subnet.id,
      // NLB gets a synthetic static IP per AZ
      staticIp:
        req.type === "network"
          ? `10.200.${100 + Math.floor(Math.random() * 100)}.${10 +
              Math.floor(Math.random() * 240)}`
          : undefined,
    };
  });

  const baseAttrs =
    req.type === "application" ? DEFAULT_ATTRS_ALB : DEFAULT_ATTRS_NLB;

  const lb: LoadBalancer = {
    id,
    arn: arnFor("loadbalancer", `${req.type}/${req.name}/${id.slice(3)}`),
    name: req.name,
    type: req.type,
    scheme: req.scheme,
    ipAddressType: req.ipAddressType,
    vpcId: req.vpcId,
    availabilityZones: azs,
    securityGroupIds: req.securityGroupIds ?? [],
    dnsName: `${req.name}-${id.slice(3, 11)}.${req.type === "application" ? "app" : "net"}.${vpc.region}.nimbus.internal`,
    canonicalHostedZoneId: "NZ" + id.slice(3, 13).toUpperCase(),
    state: { code: "provisioning" },
    attributes: { ...baseAttrs, ...(req.attributes ?? {}) },
    tags: req.tags ?? [],
    createdAt: new Date().toISOString(),
  };
  return lb;
}

/** Simulate the async provisioning lifecycle. */
export function markActive(lb: LoadBalancer): LoadBalancer {
  return { ...lb, state: { code: "active" } };
}
