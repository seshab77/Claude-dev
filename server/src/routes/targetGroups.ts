import { Router } from "express";
import type {
  CreateTargetGroupRequest,
  RegisteredTarget,
} from "@nimbus/shared";
import { store } from "../store/memory.js";
import { buildTargetGroup } from "../domain/targetGroup.js";
import { validateBody } from "../middleware/validate.js";
import { zCreateTargetGroup, zRegisterTargets } from "./schemas.js";

export const targetGroupsRouter = Router();

targetGroupsRouter.get("/", (_req, res) => {
  res.json({ targetGroups: store.listTargetGroups() });
});

targetGroupsRouter.get("/:id", (req, res) => {
  const tg = store.getTargetGroup(req.params.id);
  if (!tg) return res.status(404).json({ error: "NotFound" });
  res.json({ targetGroup: tg });
});

targetGroupsRouter.post(
  "/",
  validateBody(zCreateTargetGroup),
  (req, res) => {
    const body = req.body as CreateTargetGroupRequest;
    if (store.listTargetGroups().some((t) => t.name === body.name)) {
      return res.status(409).json({ error: "NameInUse" });
    }
    const tg = buildTargetGroup(body);
    store.putTargetGroup(tg);
    res.status(201).json({ targetGroup: tg });
  },
);

targetGroupsRouter.post(
  "/:id/targets",
  validateBody(zRegisterTargets),
  (req, res) => {
    const tg = store.getTargetGroup(req.params.id);
    if (!tg) return res.status(404).json({ error: "NotFound" });
    const now = new Date().toISOString();
    const newTargets: RegisteredTarget[] = req.body.targets.map(
      (t: { id: string; port?: number; availabilityZone?: string }) => ({
        id: t.id,
        port: t.port ?? tg.port,
        availabilityZone: t.availabilityZone,
        health: { state: "initial", lastTransitionAt: now },
      }),
    );
    const updated = {
      ...tg,
      targets: [...tg.targets, ...newTargets],
    };
    store.putTargetGroup(updated);
    // simulate healthcheck convergence
    setTimeout(() => {
      const current = store.getTargetGroup(tg.id);
      if (!current) return;
      store.putTargetGroup({
        ...current,
        targets: current.targets.map((t) =>
          newTargets.find((n) => n.id === t.id && n.port === t.port)
            ? {
                ...t,
                health: {
                  state: "healthy",
                  lastTransitionAt: new Date().toISOString(),
                },
              }
            : t,
        ),
      });
    }, 2000);
    res.status(201).json({ targetGroup: updated });
  },
);

targetGroupsRouter.delete("/:id/targets", (req, res) => {
  const tg = store.getTargetGroup(req.params.id);
  if (!tg) return res.status(404).json({ error: "NotFound" });
  const ids: string[] = req.body?.targetIds ?? [];
  const updated = {
    ...tg,
    targets: tg.targets.map((t) =>
      ids.includes(t.id)
        ? {
            ...t,
            health: {
              state: "draining" as const,
              lastTransitionAt: new Date().toISOString(),
            },
          }
        : t,
    ),
  };
  store.putTargetGroup(updated);
  res.json({ targetGroup: updated });
});

targetGroupsRouter.delete("/:id", (req, res) => {
  const tg = store.getTargetGroup(req.params.id);
  if (!tg) return res.status(404).json({ error: "NotFound" });
  store.deleteTargetGroup(req.params.id);
  res.status(204).end();
});
