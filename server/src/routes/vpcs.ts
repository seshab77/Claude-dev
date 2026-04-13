import { Router } from "express";
import type { CreateSubnetRequest, CreateVpcRequest } from "@nimbus/shared";
import { store } from "../store/memory.js";
import { buildSubnet, buildVpc } from "../domain/vpc.js";
import { validateBody } from "../middleware/validate.js";
import { zCreateSubnet, zCreateVpc } from "./schemas.js";

export const vpcsRouter = Router();

vpcsRouter.get("/", (_req, res) => {
  res.json({ vpcs: store.listVpcs() });
});

vpcsRouter.get("/:id", (req, res) => {
  const v = store.getVpc(req.params.id);
  if (!v) return res.status(404).json({ error: "NotFound" });
  res.json({ vpc: v });
});

vpcsRouter.post("/", validateBody(zCreateVpc), (req, res) => {
  const body = req.body as CreateVpcRequest;
  if (store.listVpcs().some((v) => v.name === body.name)) {
    return res.status(409).json({ error: "NameInUse" });
  }
  try {
    const vpc = buildVpc(body);
    store.putVpc(vpc);
    res.status(201).json({ vpc });
  } catch (err) {
    res.status(400).json({ error: "BadRequest", message: (err as Error).message });
  }
});

vpcsRouter.post(
  "/:id/subnets",
  validateBody(zCreateSubnet),
  (req, res) => {
    const vpc = store.getVpc(req.params.id);
    if (!vpc) return res.status(404).json({ error: "NotFound" });
    try {
      const subnet = buildSubnet(vpc, req.body as CreateSubnetRequest);
      const updated = { ...vpc, subnets: [...vpc.subnets, subnet] };
      store.putVpc(updated);
      res.status(201).json({ subnet, vpc: updated });
    } catch (err) {
      res
        .status(400)
        .json({ error: "BadRequest", message: (err as Error).message });
    }
  },
);

vpcsRouter.delete("/:id/subnets/:subnetId", (req, res) => {
  const vpc = store.getVpc(req.params.id);
  if (!vpc) return res.status(404).json({ error: "NotFound" });

  // Refuse if any LB or target group references this subnet's VPC and the
  // subnet itself; for simplicity here we block on subnet usage by LBs.
  const subnetInUseByLb = store
    .listLoadBalancers()
    .some((lb) =>
      lb.availabilityZones.some((az) => az.subnetId === req.params.subnetId),
    );
  if (subnetInUseByLb) {
    return res
      .status(409)
      .json({ error: "SubnetInUse", message: "subnet is attached to a load balancer" });
  }
  const updated = {
    ...vpc,
    subnets: vpc.subnets.filter((s) => s.id !== req.params.subnetId),
  };
  store.putVpc(updated);
  res.status(204).end();
});

vpcsRouter.delete("/:id", (req, res) => {
  const vpc = store.getVpc(req.params.id);
  if (!vpc) return res.status(404).json({ error: "NotFound" });

  // Guard against orphaning resources.
  const usedByLb = store.listLoadBalancers().some((lb) => lb.vpcId === vpc.id);
  const usedByTg = store.listTargetGroups().some((tg) => tg.vpcId === vpc.id);
  if (usedByLb || usedByTg) {
    return res.status(409).json({
      error: "VpcInUse",
      message: `VPC has ${usedByLb ? "load balancer(s)" : ""}${
        usedByLb && usedByTg ? " and " : ""
      }${usedByTg ? "target group(s)" : ""} attached`,
    });
  }
  store.putVpc({ ...vpc, subnets: [] }); // not strictly needed but tidy
  // remove from store
  // (the store has no deleteVpc — add a no-op via direct map mutation through a helper)
  store.deleteVpc(vpc.id);
  res.status(204).end();
});
