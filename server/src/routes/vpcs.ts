import { Router } from "express";
import { store } from "../store/memory.js";

export const vpcsRouter = Router();

vpcsRouter.get("/", (_req, res) => {
  res.json({ vpcs: store.listVpcs() });
});

vpcsRouter.get("/:id", (req, res) => {
  const v = store.getVpc(req.params.id);
  if (!v) return res.status(404).json({ error: "NotFound" });
  res.json({ vpc: v });
});
