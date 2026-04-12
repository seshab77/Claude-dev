import { Router } from "express";
import type { CreateListenerRequest, CreateRuleRequest } from "@nimbus/shared";
import { store } from "../store/memory.js";
import {
  buildListener,
  buildRule,
  assertAlbForRules,
  validateActionsForLb,
} from "../domain/listener.js";
import { validateBody } from "../middleware/validate.js";
import { zCreateListener, zCreateRule } from "./schemas.js";

export const listenersRouter = Router();

listenersRouter.get("/", (req, res) => {
  const lbId = req.query.loadBalancerId as string | undefined;
  res.json({ listeners: store.listListeners(lbId) });
});

listenersRouter.get("/:id", (req, res) => {
  const l = store.getListener(req.params.id);
  if (!l) return res.status(404).json({ error: "NotFound" });
  res.json({ listener: l });
});

listenersRouter.post(
  "/",
  validateBody(zCreateListener),
  (req, res) => {
    const body = req.body as CreateListenerRequest;
    const lb = store.getLoadBalancer(body.loadBalancerId);
    if (!lb) return res.status(400).json({ error: "LoadBalancerNotFound" });
    try {
      const listener = buildListener(body, lb);
      store.putListener(listener);
      res.status(201).json({ listener });
    } catch (err) {
      res
        .status(400)
        .json({ error: "BadRequest", message: (err as Error).message });
    }
  },
);

listenersRouter.post(
  "/:id/rules",
  validateBody(zCreateRule),
  (req, res) => {
    const listener = store.getListener(req.params.id);
    if (!listener) return res.status(404).json({ error: "NotFound" });
    const lb = store.getLoadBalancer(listener.loadBalancerId);
    if (!lb) return res.status(500).json({ error: "DanglingListener" });
    try {
      assertAlbForRules(lb);
      const body = req.body as CreateRuleRequest;
      validateActionsForLb(lb, body.actions);
      if (listener.rules.some((r) => r.priority === body.priority)) {
        return res.status(409).json({ error: "PriorityInUse" });
      }
      const rule = buildRule(body);
      const updated = {
        ...listener,
        rules: [...listener.rules, rule].sort(
          (a, b) => a.priority - b.priority,
        ),
      };
      store.putListener(updated);
      res.status(201).json({ rule, listener: updated });
    } catch (err) {
      res
        .status(400)
        .json({ error: "BadRequest", message: (err as Error).message });
    }
  },
);

listenersRouter.delete("/:id/rules/:ruleId", (req, res) => {
  const listener = store.getListener(req.params.id);
  if (!listener) return res.status(404).json({ error: "NotFound" });
  const updated = {
    ...listener,
    rules: listener.rules.filter((r) => r.id !== req.params.ruleId),
  };
  store.putListener(updated);
  res.status(204).end();
});

listenersRouter.delete("/:id", (req, res) => {
  const l = store.getListener(req.params.id);
  if (!l) return res.status(404).json({ error: "NotFound" });
  store.deleteListener(req.params.id);
  res.status(204).end();
});
