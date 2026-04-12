import type {
  CreateListenerRequest,
  CreateRuleRequest,
  ListenerAction,
  Listener,
  ListenerRule,
  LoadBalancer,
} from "@nimbus/shared";
import { arnFor, shortId } from "../store/ids.js";

const L4_PROTOCOLS = new Set(["TCP", "UDP", "TCP_UDP", "TLS"]);
const L7_PROTOCOLS = new Set(["HTTP", "HTTPS"]);

/** Cross-check that the listener protocol is permitted for the LB type. */
export function validateListenerProtocol(
  lb: LoadBalancer,
  protocol: CreateListenerRequest["protocol"],
): void {
  if (lb.type === "network" && !L4_PROTOCOLS.has(protocol)) {
    throw new Error(
      `Network load balancer only supports TCP, UDP, TCP_UDP, TLS (got ${protocol})`,
    );
  }
  if (lb.type === "application" && !L7_PROTOCOLS.has(protocol)) {
    throw new Error(
      `Application load balancer only supports HTTP or HTTPS (got ${protocol})`,
    );
  }
}

/** Actions allowed on NLB listeners are a strict subset. */
export function validateActionsForLb(
  lb: LoadBalancer,
  actions: ListenerAction[],
): void {
  if (lb.type !== "network") return;
  for (const a of actions) {
    if (a.type !== "forward") {
      throw new Error(
        `Network load balancer listeners only support 'forward' actions (got '${a.type}')`,
      );
    }
  }
}

export function buildListener(
  req: CreateListenerRequest,
  lb: LoadBalancer,
): Listener {
  validateListenerProtocol(lb, req.protocol);
  validateActionsForLb(lb, req.defaultActions);

  const id = shortId("lsn");
  return {
    id,
    arn: arnFor("listener", `${lb.name}/${id.slice(4)}`),
    loadBalancerId: lb.id,
    protocol: req.protocol,
    port: req.port,
    sslPolicy:
      req.protocol === "HTTPS" || req.protocol === "TLS"
        ? (req.sslPolicy ?? "ELBSecurityPolicy-TLS13-1-2-2021-06")
        : undefined,
    certificates:
      req.protocol === "HTTPS" || req.protocol === "TLS"
        ? (req.certificates ?? [])
        : undefined,
    alpnPolicy: req.protocol === "TLS" ? (req.alpnPolicy ?? "None") : undefined,
    defaultActions: req.defaultActions,
    rules: [],
    createdAt: new Date().toISOString(),
  };
}

export function buildRule(req: CreateRuleRequest): ListenerRule {
  return {
    id: shortId("rule"),
    priority: req.priority,
    isDefault: false,
    conditions: req.conditions,
    actions: req.actions,
  };
}

export function assertAlbForRules(lb: LoadBalancer): void {
  if (lb.type !== "application") {
    throw new Error("Listener rules are only supported on application load balancers");
  }
}
