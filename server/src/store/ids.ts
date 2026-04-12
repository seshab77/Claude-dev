import { randomBytes } from "node:crypto";

export function shortId(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

export function arnFor(
  resource: "loadbalancer" | "listener" | "targetgroup" | "rule",
  name: string,
): string {
  // Nimbus ARN format — mirrors AWS style but uses our vendor namespace.
  //   arn:nimbus:elb:<region>:<account>:<resource>/<name>
  const region = process.env.NIMBUS_REGION ?? "pvt-cloud-1";
  const account = process.env.NIMBUS_ACCOUNT ?? "000000000000";
  return `arn:nimbus:elb:${region}:${account}:${resource}/${name}`;
}
