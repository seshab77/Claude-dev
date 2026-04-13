// ---------------------------------------------------------------------------
// Nimbus Cloud — shared domain model
//
// The Load Balancer domain unifies the feature sets of AWS NLB (Layer 4) and
// AWS ALB (Layer 7) into a single abstraction. A load balancer has a `type`
// of either `network` or `application`; the supported listener protocols and
// rule capabilities depend on the type, matching AWS semantics.
// ---------------------------------------------------------------------------

// ------- Common primitives -------
export type ID = string;
export type Timestamp = string; // ISO-8601

export type IpAddressType = "ipv4" | "dualstack";
export type LoadBalancerType = "network" | "application";
export type LoadBalancerScheme = "internet-facing" | "internal";
export type LoadBalancerState =
  | "provisioning"
  | "active"
  | "active_impaired"
  | "failed";

// ------- Networking -------
export interface AvailabilityZone {
  zoneName: string;       // e.g. "pvt-cloud-1a"
  subnetId: ID;           // e.g. "subnet-xxxx"
  staticIp?: string;      // NLB: static IP per AZ
  allocationId?: string;  // Reserved elastic IP allocation (NLB)
}

export interface SecurityGroupRef {
  id: ID;                 // "sg-xxxx"
  name: string;
}

// ------- Target Groups -------
export type TargetType = "instance" | "ip" | "lambda" | "alb";
export type TargetProtocol =
  | "HTTP"
  | "HTTPS"
  | "TCP"
  | "UDP"
  | "TCP_UDP"
  | "TLS"
  | "GENEVE";

export type LbAlgorithm =
  | "round_robin"
  | "least_outstanding_requests"
  | "weighted_random"; // ALB
export type StickinessType =
  | "lb_cookie"        // ALB
  | "app_cookie"       // ALB
  | "source_ip"        // NLB
  | "source_ip_dest_ip"; // NLB TLS

export type TargetHealthState =
  | "initial"
  | "healthy"
  | "unhealthy"
  | "unused"
  | "draining"
  | "unavailable";

export interface HealthCheckConfig {
  protocol: "HTTP" | "HTTPS" | "TCP";
  port: number | "traffic-port";
  path?: string;                 // HTTP(S) only
  intervalSeconds: number;       // 5–300
  timeoutSeconds: number;        // 2–120
  healthyThresholdCount: number; // 2–10
  unhealthyThresholdCount: number;
  matcherHttpCodes?: string;     // e.g. "200" or "200-299,301"
}

export interface StickinessConfig {
  enabled: boolean;
  type: StickinessType;
  durationSeconds?: number; // lb_cookie / source_ip
  cookieName?: string;      // app_cookie
}

export interface RegisteredTarget {
  id: ID;          // instance-id, IP, lambda ARN, or nested LB ARN
  port?: number;
  availabilityZone?: string;
  health: {
    state: TargetHealthState;
    reasonCode?: string;
    description?: string;
    lastTransitionAt: Timestamp;
  };
}

export interface TargetGroup {
  id: ID;                   // "tg-xxxx"
  arn: string;
  name: string;
  targetType: TargetType;
  protocol: TargetProtocol;
  protocolVersion?: "HTTP1" | "HTTP2" | "GRPC"; // ALB HTTP/HTTPS
  port: number;
  vpcId: ID;
  healthCheck: HealthCheckConfig;
  stickiness: StickinessConfig;
  deregistrationDelaySeconds: number;    // 0–3600
  slowStartSeconds?: number;             // ALB only, 30–900
  loadBalancingAlgorithm: LbAlgorithm;
  preserveClientIp?: boolean;            // NLB (IP targets)
  proxyProtocolV2?: boolean;             // NLB
  targets: RegisteredTarget[];
  tags: Tag[];
  createdAt: Timestamp;
}

// ------- Listeners -------
export type ListenerProtocol =
  | "HTTP"
  | "HTTPS"
  | "TCP"
  | "UDP"
  | "TCP_UDP"
  | "TLS";

export type SslPolicy =
  | "ELBSecurityPolicy-TLS13-1-2-2021-06"
  | "ELBSecurityPolicy-TLS13-1-3-2021-06"
  | "ELBSecurityPolicy-FS-1-2-Res-2020-10"
  | "ELBSecurityPolicy-2016-08";

export type AlpnPolicy =
  | "HTTP1Only"
  | "HTTP2Only"
  | "HTTP2Optional"
  | "HTTP2Preferred"
  | "None";

export interface CertificateRef {
  arn: string;
  isDefault?: boolean;
}

// ----- Listener rule conditions (ALB) -----
export type RuleConditionField =
  | "host-header"
  | "path-pattern"
  | "http-header"
  | "http-request-method"
  | "query-string"
  | "source-ip";

export interface HostHeaderCondition {
  field: "host-header";
  values: string[]; // e.g. ["api.example.com", "*.example.com"]
}
export interface PathPatternCondition {
  field: "path-pattern";
  values: string[]; // e.g. ["/api/*"]
}
export interface HttpHeaderCondition {
  field: "http-header";
  headerName: string;
  values: string[];
}
export interface HttpMethodCondition {
  field: "http-request-method";
  values: string[]; // GET, POST, ...
}
export interface QueryStringKV { key?: string; value: string; }
export interface QueryStringCondition {
  field: "query-string";
  values: QueryStringKV[];
}
export interface SourceIpCondition {
  field: "source-ip";
  values: string[]; // CIDRs
}
export type RuleCondition =
  | HostHeaderCondition
  | PathPatternCondition
  | HttpHeaderCondition
  | HttpMethodCondition
  | QueryStringCondition
  | SourceIpCondition;

// ----- Listener/rule actions -----
export interface ForwardTargetGroupTuple {
  targetGroupId: ID;
  weight: number; // 0–999
}
export interface ForwardAction {
  type: "forward";
  targetGroups: ForwardTargetGroupTuple[];
  stickiness?: { enabled: boolean; durationSeconds?: number };
}
export interface RedirectAction {
  type: "redirect";
  protocol?: "HTTP" | "HTTPS" | "#{protocol}";
  port?: string; // "#{port}" allowed
  host?: string; // "#{host}" allowed
  path?: string; // "/#{path}"
  query?: string;
  statusCode: "HTTP_301" | "HTTP_302";
}
export interface FixedResponseAction {
  type: "fixed-response";
  statusCode: string; // "2XX" | "4XX" | "5XX"
  contentType?: "text/plain" | "text/html" | "application/json";
  messageBody?: string;
}
export interface AuthenticateOidcAction {
  type: "authenticate-oidc";
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  clientId: string;
  clientSecret?: string;
  sessionCookieName?: string;
  scope?: string;
  sessionTimeoutSeconds?: number;
  onUnauthenticatedRequest?: "deny" | "allow" | "authenticate";
}
export type ListenerAction =
  | ForwardAction
  | RedirectAction
  | FixedResponseAction
  | AuthenticateOidcAction;

// ----- Listener rule -----
export interface ListenerRule {
  id: ID;
  priority: number;      // 1–50000; "default" rule has priority 0
  isDefault: boolean;
  conditions: RuleCondition[];
  actions: ListenerAction[];
}

// ----- Listener -----
export interface Listener {
  id: ID;
  arn: string;
  loadBalancerId: ID;
  protocol: ListenerProtocol;
  port: number;
  sslPolicy?: SslPolicy;       // HTTPS / TLS
  certificates?: CertificateRef[];
  alpnPolicy?: AlpnPolicy;     // NLB TLS
  defaultActions: ListenerAction[];
  rules: ListenerRule[];       // ALB — empty for NLB
  createdAt: Timestamp;
}

// ------- Load balancer attributes (AWS "attributes" bag) -------
export interface LoadBalancerAttributes {
  deletionProtectionEnabled: boolean;
  accessLogsEnabled: boolean;
  accessLogsBucket?: string;
  accessLogsPrefix?: string;
  idleTimeoutSeconds?: number;                 // ALB, default 60
  http2Enabled?: boolean;                      // ALB
  dropInvalidHeaderFieldsEnabled?: boolean;    // ALB
  desyncMitigationMode?: "monitor" | "defensive" | "strictest"; // ALB
  xAmznTlsVersionAndCipherSuiteHeaderEnabled?: boolean;         // ALB
  xffClientPortEnabled?: boolean;              // ALB
  xffHeaderProcessingMode?: "append" | "preserve" | "remove";   // ALB
  crossZoneLoadBalancingEnabled: boolean;      // both, default true for ALB
  connectionTerminationOnDeregistration?: boolean; // NLB
  preserveClientIpEnabled?: boolean;           // NLB
  wafFailOpenEnabled?: boolean;                // ALB
}

// ------- Tags -------
export interface Tag { key: string; value: string; }

// ------- Load Balancer -------
export interface LoadBalancer {
  id: ID;                    // "lb-xxxx"
  arn: string;
  name: string;
  type: LoadBalancerType;
  scheme: LoadBalancerScheme;
  ipAddressType: IpAddressType;
  vpcId: ID;
  availabilityZones: AvailabilityZone[];
  securityGroupIds: ID[];    // ALB; NLB may use SGs too in new regions
  dnsName: string;
  canonicalHostedZoneId: string;
  state: { code: LoadBalancerState; reason?: string };
  attributes: LoadBalancerAttributes;
  tags: Tag[];
  createdAt: Timestamp;
}

// ------- VPC catalog (minimal, needed to build a wizard) -------
export interface Subnet {
  id: ID;
  availabilityZone: string;
  cidrBlock: string;
  vpcId: ID;
  type?: "public" | "private";
}
export interface Vpc {
  id: ID;
  name: string;
  cidrBlock: string;
  region: string;
  subnets: Subnet[];
  tags?: Tag[];
  createdAt?: Timestamp;
}

// ------- API request shapes -------
export interface CreateVpcRequest {
  name: string;
  cidrBlock: string;
  region?: string;
  // Inline subnets created with the VPC, optional.
  subnets?: Array<{
    availabilityZone: string;
    cidrBlock: string;
    type?: "public" | "private";
  }>;
  tags?: Tag[];
}

export interface CreateSubnetRequest {
  availabilityZone: string;
  cidrBlock: string;
  type?: "public" | "private";
}

export interface CreateLoadBalancerRequest {
  name: string;
  type: LoadBalancerType;
  scheme: LoadBalancerScheme;
  ipAddressType: IpAddressType;
  vpcId: ID;
  subnetIds: ID[];
  securityGroupIds?: ID[];
  attributes?: Partial<LoadBalancerAttributes>;
  tags?: Tag[];
}

export interface CreateTargetGroupRequest {
  name: string;
  targetType: TargetType;
  protocol: TargetProtocol;
  protocolVersion?: "HTTP1" | "HTTP2" | "GRPC";
  port: number;
  vpcId: ID;
  healthCheck?: Partial<HealthCheckConfig>;
  stickiness?: Partial<StickinessConfig>;
  deregistrationDelaySeconds?: number;
  slowStartSeconds?: number;
  loadBalancingAlgorithm?: LbAlgorithm;
  preserveClientIp?: boolean;
  proxyProtocolV2?: boolean;
  tags?: Tag[];
}

export interface RegisterTargetsRequest {
  targets: Array<{ id: ID; port?: number; availabilityZone?: string }>;
}

export interface CreateListenerRequest {
  loadBalancerId: ID;
  protocol: ListenerProtocol;
  port: number;
  sslPolicy?: SslPolicy;
  certificates?: CertificateRef[];
  alpnPolicy?: AlpnPolicy;
  defaultActions: ListenerAction[];
}

export interface CreateRuleRequest {
  priority: number;
  conditions: RuleCondition[];
  actions: ListenerAction[];
}
