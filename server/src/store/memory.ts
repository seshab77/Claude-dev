import type {
  LoadBalancer,
  TargetGroup,
  Listener,
  Vpc,
} from "@nimbus/shared";

// ---------------------------------------------------------------------------
// Simple in-memory store. A single process-local source of truth for the
// initial Load Balancer service. The indirection via `Store` makes it easy
// to swap to Postgres/Redis later without touching the route layer.
// ---------------------------------------------------------------------------

interface State {
  loadBalancers: Map<string, LoadBalancer>;
  targetGroups: Map<string, TargetGroup>;
  listeners: Map<string, Listener>;
  vpcs: Map<string, Vpc>;
}

const state: State = {
  loadBalancers: new Map(),
  targetGroups: new Map(),
  listeners: new Map(),
  vpcs: new Map(),
};

export const store = {
  // ----- load balancers -----
  listLoadBalancers(): LoadBalancer[] {
    return [...state.loadBalancers.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  },
  getLoadBalancer(id: string): LoadBalancer | undefined {
    return state.loadBalancers.get(id);
  },
  putLoadBalancer(lb: LoadBalancer): LoadBalancer {
    state.loadBalancers.set(lb.id, lb);
    return lb;
  },
  deleteLoadBalancer(id: string): boolean {
    // cascade listeners
    for (const l of state.listeners.values()) {
      if (l.loadBalancerId === id) state.listeners.delete(l.id);
    }
    return state.loadBalancers.delete(id);
  },

  // ----- target groups -----
  listTargetGroups(): TargetGroup[] {
    return [...state.targetGroups.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  },
  getTargetGroup(id: string): TargetGroup | undefined {
    return state.targetGroups.get(id);
  },
  putTargetGroup(tg: TargetGroup): TargetGroup {
    state.targetGroups.set(tg.id, tg);
    return tg;
  },
  deleteTargetGroup(id: string): boolean {
    return state.targetGroups.delete(id);
  },

  // ----- listeners -----
  listListeners(loadBalancerId?: string): Listener[] {
    const all = [...state.listeners.values()];
    return loadBalancerId
      ? all.filter((l) => l.loadBalancerId === loadBalancerId)
      : all;
  },
  getListener(id: string): Listener | undefined {
    return state.listeners.get(id);
  },
  putListener(l: Listener): Listener {
    state.listeners.set(l.id, l);
    return l;
  },
  deleteListener(id: string): boolean {
    return state.listeners.delete(id);
  },

  // ----- vpcs -----
  listVpcs(): Vpc[] {
    return [...state.vpcs.values()].sort((a, b) =>
      (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1,
    );
  },
  getVpc(id: string): Vpc | undefined {
    return state.vpcs.get(id);
  },
  putVpc(v: Vpc): Vpc {
    state.vpcs.set(v.id, v);
    return v;
  },
  deleteVpc(id: string): boolean {
    return state.vpcs.delete(id);
  },
};

export type Store = typeof store;
