import type {
  LoadBalancer,
  Listener,
  TargetGroup,
  Vpc,
  CreateLoadBalancerRequest,
  CreateListenerRequest,
  CreateTargetGroupRequest,
  CreateRuleRequest,
  RegisterTargetsRequest,
  ListenerRule,
} from "@nimbus/shared";

// When deployed, the web is served from Vercel and the API from Render
// (different origins), so all fetches are prefixed with VITE_API_URL.
// In local dev the var is empty and Vite's proxy forwards /api → :4000.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  // vpcs
  listVpcs: () => req<{ vpcs: Vpc[] }>("/api/vpcs"),

  // load balancers
  listLoadBalancers: () =>
    req<{ loadBalancers: LoadBalancer[] }>("/api/load-balancers"),
  getLoadBalancer: (id: string) =>
    req<{ loadBalancer: LoadBalancer; listeners: Listener[] }>(
      `/api/load-balancers/${id}`,
    ),
  createLoadBalancer: (body: CreateLoadBalancerRequest) =>
    req<{ loadBalancer: LoadBalancer }>("/api/load-balancers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteLoadBalancer: (id: string) =>
    req<void>(`/api/load-balancers/${id}`, { method: "DELETE" }),

  // target groups
  listTargetGroups: () =>
    req<{ targetGroups: TargetGroup[] }>("/api/target-groups"),
  getTargetGroup: (id: string) =>
    req<{ targetGroup: TargetGroup }>(`/api/target-groups/${id}`),
  createTargetGroup: (body: CreateTargetGroupRequest) =>
    req<{ targetGroup: TargetGroup }>("/api/target-groups", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  registerTargets: (id: string, body: RegisterTargetsRequest) =>
    req<{ targetGroup: TargetGroup }>(`/api/target-groups/${id}/targets`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deregisterTargets: (id: string, targetIds: string[]) =>
    req<{ targetGroup: TargetGroup }>(`/api/target-groups/${id}/targets`, {
      method: "DELETE",
      body: JSON.stringify({ targetIds }),
    }),

  // listeners
  createListener: (body: CreateListenerRequest) =>
    req<{ listener: Listener }>("/api/listeners", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteListener: (id: string) =>
    req<void>(`/api/listeners/${id}`, { method: "DELETE" }),
  createRule: (listenerId: string, body: CreateRuleRequest) =>
    req<{ rule: ListenerRule; listener: Listener }>(
      `/api/listeners/${listenerId}/rules`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  deleteRule: (listenerId: string, ruleId: string) =>
    req<void>(`/api/listeners/${listenerId}/rules/${ruleId}`, {
      method: "DELETE",
    }),
};
