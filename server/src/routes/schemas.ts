import { z } from "zod";

// --- shared primitives ---
export const zTag = z.object({ key: z.string(), value: z.string() });

// --- VPC ---
const cidrRe = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
const zCidr = z.string().regex(cidrRe, "expected CIDR like 10.0.0.0/16");

export const zCreateSubnet = z.object({
  availabilityZone: z.string().min(1),
  cidrBlock: zCidr,
  type: z.enum(["public", "private"]).optional(),
});

export const zCreateVpc = z.object({
  name: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
  cidrBlock: zCidr,
  region: z.string().optional(),
  subnets: z.array(zCreateSubnet).optional(),
  tags: z.array(zTag).optional(),
});

// --- load balancer ---
export const zCreateLoadBalancer = z.object({
  name: z.string().min(1).max(32).regex(/^[A-Za-z0-9-]+$/),
  type: z.enum(["network", "application"]),
  scheme: z.enum(["internet-facing", "internal"]),
  ipAddressType: z.enum(["ipv4", "dualstack"]),
  vpcId: z.string(),
  subnetIds: z.array(z.string()).min(1),
  securityGroupIds: z.array(z.string()).optional(),
  attributes: z.record(z.any()).optional(),
  tags: z.array(zTag).optional(),
});

// --- target group ---
export const zHealthCheck = z.object({
  protocol: z.enum(["HTTP", "HTTPS", "TCP"]).optional(),
  port: z.union([z.number().int().positive(), z.literal("traffic-port")]).optional(),
  path: z.string().optional(),
  intervalSeconds: z.number().int().min(5).max(300).optional(),
  timeoutSeconds: z.number().int().min(2).max(120).optional(),
  healthyThresholdCount: z.number().int().min(2).max(10).optional(),
  unhealthyThresholdCount: z.number().int().min(2).max(10).optional(),
  matcherHttpCodes: z.string().optional(),
});

export const zStickiness = z.object({
  enabled: z.boolean().optional(),
  type: z.enum(["lb_cookie", "app_cookie", "source_ip", "source_ip_dest_ip"]).optional(),
  durationSeconds: z.number().int().min(1).max(604800).optional(),
  cookieName: z.string().optional(),
});

export const zCreateTargetGroup = z.object({
  name: z.string().min(1).max(32).regex(/^[A-Za-z0-9-]+$/),
  targetType: z.enum(["instance", "ip", "lambda", "alb"]),
  protocol: z.enum(["HTTP", "HTTPS", "TCP", "UDP", "TCP_UDP", "TLS", "GENEVE"]),
  protocolVersion: z.enum(["HTTP1", "HTTP2", "GRPC"]).optional(),
  port: z.number().int().min(1).max(65535),
  vpcId: z.string(),
  healthCheck: zHealthCheck.optional(),
  stickiness: zStickiness.optional(),
  deregistrationDelaySeconds: z.number().int().min(0).max(3600).optional(),
  slowStartSeconds: z.number().int().min(30).max(900).optional(),
  loadBalancingAlgorithm: z
    .enum(["round_robin", "least_outstanding_requests", "weighted_random"])
    .optional(),
  preserveClientIp: z.boolean().optional(),
  proxyProtocolV2: z.boolean().optional(),
  tags: z.array(zTag).optional(),
});

export const zRegisterTargets = z.object({
  targets: z
    .array(
      z.object({
        id: z.string(),
        port: z.number().int().min(1).max(65535).optional(),
        availabilityZone: z.string().optional(),
      }),
    )
    .min(1),
});

// --- listener actions ---
const zForwardTuple = z.object({
  targetGroupId: z.string(),
  weight: z.number().int().min(0).max(999),
});

export const zAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("forward"),
    targetGroups: z.array(zForwardTuple).min(1),
    stickiness: z
      .object({
        enabled: z.boolean(),
        durationSeconds: z.number().int().positive().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("redirect"),
    protocol: z.enum(["HTTP", "HTTPS", "#{protocol}"]).optional(),
    port: z.string().optional(),
    host: z.string().optional(),
    path: z.string().optional(),
    query: z.string().optional(),
    statusCode: z.enum(["HTTP_301", "HTTP_302"]),
  }),
  z.object({
    type: z.literal("fixed-response"),
    statusCode: z.string(),
    contentType: z.enum(["text/plain", "text/html", "application/json"]).optional(),
    messageBody: z.string().optional(),
  }),
  z.object({
    type: z.literal("authenticate-oidc"),
    issuer: z.string(),
    authorizationEndpoint: z.string(),
    tokenEndpoint: z.string(),
    userInfoEndpoint: z.string(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    sessionCookieName: z.string().optional(),
    scope: z.string().optional(),
    sessionTimeoutSeconds: z.number().int().positive().optional(),
    onUnauthenticatedRequest: z.enum(["deny", "allow", "authenticate"]).optional(),
  }),
]);

export const zCreateListener = z.object({
  loadBalancerId: z.string(),
  protocol: z.enum(["HTTP", "HTTPS", "TCP", "UDP", "TCP_UDP", "TLS"]),
  port: z.number().int().min(1).max(65535),
  sslPolicy: z.string().optional(),
  certificates: z
    .array(z.object({ arn: z.string(), isDefault: z.boolean().optional() }))
    .optional(),
  alpnPolicy: z.enum(["HTTP1Only", "HTTP2Only", "HTTP2Optional", "HTTP2Preferred", "None"]).optional(),
  defaultActions: z.array(zAction).min(1),
});

// --- listener rule ---
export const zCondition = z.discriminatedUnion("field", [
  z.object({ field: z.literal("host-header"), values: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("path-pattern"), values: z.array(z.string()).min(1) }),
  z.object({
    field: z.literal("http-header"),
    headerName: z.string(),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    field: z.literal("http-request-method"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    field: z.literal("query-string"),
    values: z
      .array(z.object({ key: z.string().optional(), value: z.string() }))
      .min(1),
  }),
  z.object({ field: z.literal("source-ip"), values: z.array(z.string()).min(1) }),
]);

export const zCreateRule = z.object({
  priority: z.number().int().min(1).max(50000),
  conditions: z.array(zCondition).min(1),
  actions: z.array(zAction).min(1),
});
