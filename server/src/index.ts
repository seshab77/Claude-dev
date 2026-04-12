import express from "express";
import cors from "cors";
import { loadBalancersRouter } from "./routes/loadBalancers.js";
import { targetGroupsRouter } from "./routes/targetGroups.js";
import { listenersRouter } from "./routes/listeners.js";
import { vpcsRouter } from "./routes/vpcs.js";
import { seed } from "./seed/seed.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nimbus-elb", time: new Date().toISOString() });
});

app.use("/api/load-balancers", loadBalancersRouter);
app.use("/api/target-groups", targetGroupsRouter);
app.use("/api/listeners", listenersRouter);
app.use("/api/vpcs", vpcsRouter);

// Generic error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "InternalError", message: err.message });
  },
);

seed();

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[nimbus] api listening on http://localhost:${port}`);
});
