import type {
  CreateSubnetRequest,
  CreateVpcRequest,
  Subnet,
  Vpc,
} from "@nimbus/shared";
import { shortId } from "../store/ids.js";
import { cidrContains, cidrsOverlap, parseCidr } from "./cidr.js";

export function buildVpc(req: CreateVpcRequest): Vpc {
  const vpcCidr = parseCidr(req.cidrBlock);
  const id = shortId("vpc");
  const region = req.region ?? process.env.NIMBUS_REGION ?? "pvt-cloud-1";

  // Validate inline subnets (if any) up-front so the VPC isn't half-created.
  const subnets: Subnet[] = [];
  for (const s of req.subnets ?? []) {
    const sCidr = parseCidr(s.cidrBlock);
    if (!cidrContains(vpcCidr, sCidr)) {
      throw new Error(
        `subnet ${s.cidrBlock} is not contained within VPC ${req.cidrBlock}`,
      );
    }
    for (const existing of subnets) {
      if (cidrsOverlap(parseCidr(existing.cidrBlock), sCidr)) {
        throw new Error(
          `subnet ${s.cidrBlock} overlaps existing subnet ${existing.cidrBlock}`,
        );
      }
    }
    subnets.push({
      id: shortId("subnet"),
      vpcId: id,
      availabilityZone: s.availabilityZone,
      cidrBlock: s.cidrBlock,
      type: s.type,
    });
  }

  return {
    id,
    name: req.name,
    cidrBlock: req.cidrBlock,
    region,
    subnets,
    tags: req.tags ?? [],
    createdAt: new Date().toISOString(),
  };
}

export function buildSubnet(vpc: Vpc, req: CreateSubnetRequest): Subnet {
  const vpcCidr = parseCidr(vpc.cidrBlock);
  const sCidr = parseCidr(req.cidrBlock);
  if (!cidrContains(vpcCidr, sCidr)) {
    throw new Error(
      `subnet ${req.cidrBlock} is not contained within VPC ${vpc.cidrBlock}`,
    );
  }
  for (const existing of vpc.subnets) {
    if (cidrsOverlap(parseCidr(existing.cidrBlock), sCidr)) {
      throw new Error(
        `subnet ${req.cidrBlock} overlaps existing subnet ${existing.cidrBlock} (${existing.id})`,
      );
    }
  }
  return {
    id: shortId("subnet"),
    vpcId: vpc.id,
    availabilityZone: req.availabilityZone,
    cidrBlock: req.cidrBlock,
    type: req.type,
  };
}
