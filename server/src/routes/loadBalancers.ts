import { Router } from "express";
import type {
  CreateLoadBalancerRequest,
  LoadBalancerAttributes,
} from "@nimbus/shared";
import { store } from "../store/memory.js";
import { buildLoadBalancer, markActive } from "../domain/loadBalancer.js";
import { validateBody } from "../middleware/validate.js";
import { zCreateLoadBalancer } from "./schemas.js";

export const loadBalancersRouter = Router();

loadBalancersRouter.get("/", (_req, res) => {
  res.json({ loadBalancers: store.listLoadBalancers() });
});

loadBalancersRouter.get("/:id", (req, res) => {
  const lb = store.getLoadBalancer(req.params.id);
  if (!lb) return res.status(404).json({ error: "NotFound" });
  const listeners = store.listListeners(lb.id);
  res.json({ loadBalancer: lb, listeners });
});

loadBalancersRouter.post(
  "/",
  validateBody(zCreateLoadBalancer),
  (req, res) => {
    const body = req.body as CreateLoadBalancerRequest;

    if (store.listLoadBalancers().some((l) => l.name === body.name)) {
      return res.status(409).json({ error: "NameInUse" });
    }
    const vpc = store.getVpc(body.vpcId);
    if (!vpc) return res.status(400).json({ error: "VpcNotFound" });

    try {
      const lb = buildLoadBalancer(body, vpc);
      store.putLoadBalancer(lb);
      // Simulate async provisioning — flip to active shortly.
      setTimeout(() => {
        const current = store.getLoadBalancer(lb.id);
        if (current) store.putLoadBalancer(markActive(current));
      }, 1500);
      res.status(201).json({ loadBalancer: lb });
    } catch (err) {
      res
        .status(400)
        .json({ error: "BadRequest", message: (err as Error).message });
    }
  },
);

loadBalancersRouter.patch("/:id/attributes", (req, res) => {
  const lb = store.getLoadBalancer(req.params.id);
  if (!lb) return res.status(404).json({ error: "NotFound" });
  const patch = req.body as Partial<LoadBalancerAttributes>;
  const updated = {
    ...lb,
    attributes: { ...lb.attributes, ...patch },
  };
  store.putLoadBalancer(updated);
  res.json({ loadBalancer: updated });
});

loadBalancersRouter.delete("/:id", (req, res) => {
  const lb = store.getLoadBalancer(req.params.id);
  if (!lb) return res.status(404).json({ error: "NotFound" });
  if (lb.attributes.deletionProtectionEnabled) {
    return res
      .status(409)
      .json({ error: "DeletionProtectionEnabled" });
  }
  store.deleteLoadBalancer(req.params.id);
  res.status(204).end();
});
