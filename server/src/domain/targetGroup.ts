import type {
  CreateTargetGroupRequest,
  HealthCheckConfig,
  LbAlgorithm,
  StickinessConfig,
  TargetGroup,
  TargetProtocol,
} from "@nimbus/shared";
import { shortId, arnFor } from "../store/ids.js";

function defaultHealthCheck(protocol: TargetProtocol): HealthCheckConfig {
  const httpish = protocol === "HTTP" || protocol === "HTTPS";
  return {
    protocol: httpish ? (protocol as "HTTP" | "HTTPS") : "TCP",
    port: "traffic-port",
    path: httpish ? "/" : undefined,
    intervalSeconds: httpish ? 30 : 30,
    timeoutSeconds: httpish ? 5 : 10,
    healthyThresholdCount: httpish ? 5 : 3,
    unhealthyThresholdCount: 2,
    matcherHttpCodes: httpish ? "200" : undefined,
  };
}

function defaultStickiness(protocol: TargetProtocol): StickinessConfig {
  const httpish = protocol === "HTTP" || protocol === "HTTPS";
  return {
    enabled: false,
    type: httpish ? "lb_cookie" : "source_ip",
    durationSeconds: 86400,
  };
}

function defaultAlgorithm(protocol: TargetProtocol): LbAlgorithm {
  return protocol === "HTTP" || protocol === "HTTPS"
    ? "round_robin"
    : "round_robin";
}

export function buildTargetGroup(req: CreateTargetGroupRequest): TargetGroup {
  const id = shortId("tg");
  return {
    id,
    arn: arnFor("targetgroup", `${req.name}/${id.slice(3)}`),
    name: req.name,
    targetType: req.targetType,
    protocol: req.protocol,
    protocolVersion:
      req.protocol === "HTTP" || req.protocol === "HTTPS"
        ? (req.protocolVersion ?? "HTTP1")
        : undefined,
    port: req.port,
    vpcId: req.vpcId,
    healthCheck: { ...defaultHealthCheck(req.protocol), ...(req.healthCheck ?? {}) },
    stickiness: { ...defaultStickiness(req.protocol), ...(req.stickiness ?? {}) },
    deregistrationDelaySeconds: req.deregistrationDelaySeconds ?? 300,
    slowStartSeconds: req.slowStartSeconds,
    loadBalancingAlgorithm:
      req.loadBalancingAlgorithm ?? defaultAlgorithm(req.protocol),
    preserveClientIp: req.preserveClientIp,
    proxyProtocolV2: req.proxyProtocolV2,
    targets: [],
    tags: req.tags ?? [],
    createdAt: new Date().toISOString(),
  };
}
