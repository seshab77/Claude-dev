import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateVpcRequest } from "@nimbus/shared";
import { api } from "../api/client";

interface InlineSubnet {
  availabilityZone: string;
  cidrBlock: string;
  type: "public" | "private";
}

const DEFAULT_SUBNETS: InlineSubnet[] = [
  { availabilityZone: "pvt-cloud-1a", cidrBlock: "", type: "public" },
  { availabilityZone: "pvt-cloud-1b", cidrBlock: "", type: "public" },
];

export function CreateVpcPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    cidrBlock: string;
    region: string;
  }>({
    name: "",
    cidrBlock: "10.0.0.0/16",
    region: "pvt-cloud-1",
  });
  const [subnets, setSubnets] = useState<InlineSubnet[]>(DEFAULT_SUBNETS);
  const [tags, setTags] = useState<{ key: string; value: string }[]>([]);

  const setSubnet = (i: number, p: Partial<InlineSubnet>) => {
    setSubnets((s) => s.map((sn, idx) => (idx === i ? { ...sn, ...p } : sn)));
  };
  const addSubnet = () =>
    setSubnets((s) => [...s, { availabilityZone: "pvt-cloud-1a", cidrBlock: "", type: "public" }]);
  const removeSubnet = (i: number) =>
    setSubnets((s) => s.filter((_, idx) => idx !== i));

  const setTag = (i: number, key: string, value: string) =>
    setTags((t) => t.map((tg, idx) => (idx === i ? { key, value } : tg)));
  const addTag = () => setTags((t) => [...t, { key: "", value: "" }]);
  const removeTag = (i: number) => setTags((t) => t.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateVpcRequest = {
        name: form.name.trim(),
        cidrBlock: form.cidrBlock.trim(),
        region: form.region.trim() || undefined,
        subnets: subnets
          .filter((s) => s.cidrBlock.trim() && s.availabilityZone.trim())
          .map((s) => ({
            availabilityZone: s.availabilityZone.trim(),
            cidrBlock: s.cidrBlock.trim(),
            type: s.type,
          })),
        tags: tags.filter((t) => t.key.trim()),
      };
      const { vpc } = await api.createVpc(body);
      navigate(`/networking/vpcs/${vpc.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const nameValid = /^[A-Za-z0-9-]+$/.test(form.name) && form.name.length > 0;
  const cidrValid = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(form.cidrBlock);

  return (
    <>
      <div className="nm-breadcrumbs">Networking &rsaquo; VPCs &rsaquo; Create</div>
      <h1 className="nm-h1">Create VPC</h1>
      {error && <div className="nm-error">{error}</div>}

      <div className="nm-panel">
        <h2 className="nm-h2">VPC settings</h2>
        <div className="nm-grid cols-3">
          <div className="nm-form-row">
            <label>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="my-vpc"
            />
            <div className="help">Alphanumeric and hyphens. Must be unique.</div>
          </div>
          <div className="nm-form-row">
            <label>IPv4 CIDR block</label>
            <input
              value={form.cidrBlock}
              onChange={(e) => setForm((f) => ({ ...f, cidrBlock: e.target.value }))}
              placeholder="10.0.0.0/16"
            />
            <div className="help">e.g. 10.0.0.0/16 — gives 65k addresses.</div>
          </div>
          <div className="nm-form-row">
            <label>Region</label>
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="pvt-cloud-1"
            />
          </div>
        </div>
      </div>

      <div className="nm-panel">
        <div className="nm-panel-header">
          <h2 className="nm-h2">Subnets</h2>
          <button className="nm-btn secondary small" onClick={addSubnet}>
            Add subnet
          </button>
        </div>
        <div className="help" style={{ marginBottom: 12 }}>
          Each subnet's CIDR must fit within the VPC CIDR and must not overlap
          any other subnet. Public subnets host internet-facing load balancers;
          private subnets host internal workloads.
        </div>
        {subnets.map((s, i) => (
          <div
            key={i}
            className="nm-grid cols-4"
            style={{ alignItems: "end", marginBottom: 8, gap: 12 }}
          >
            <div className="nm-form-row" style={{ margin: 0 }}>
              <label>Availability zone</label>
              <input
                value={s.availabilityZone}
                onChange={(e) => setSubnet(i, { availabilityZone: e.target.value })}
                placeholder="pvt-cloud-1a"
              />
            </div>
            <div className="nm-form-row" style={{ margin: 0 }}>
              <label>CIDR block</label>
              <input
                value={s.cidrBlock}
                onChange={(e) => setSubnet(i, { cidrBlock: e.target.value })}
                placeholder="10.0.1.0/24"
              />
            </div>
            <div className="nm-form-row" style={{ margin: 0 }}>
              <label>Type</label>
              <select
                value={s.type}
                onChange={(e) =>
                  setSubnet(i, { type: e.target.value as "public" | "private" })
                }
              >
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </div>
            <button
              className="nm-btn secondary small"
              onClick={() => removeSubnet(i)}
              style={{ height: 34 }}
            >
              Remove
            </button>
          </div>
        ))}
        {subnets.length === 0 && (
          <div className="nm-empty">
            No subnets — you can add them later from the VPC details page.
          </div>
        )}
      </div>

      <div className="nm-panel">
        <div className="nm-panel-header">
          <h2 className="nm-h2">Tags</h2>
          <button className="nm-btn secondary small" onClick={addTag}>
            Add tag
          </button>
        </div>
        {tags.length === 0 && <div className="nm-empty">No tags yet.</div>}
        {tags.map((t, i) => (
          <div
            key={i}
            className="nm-grid cols-3"
            style={{ alignItems: "end", marginBottom: 8 }}
          >
            <div className="nm-form-row" style={{ margin: 0 }}>
              <label>Key</label>
              <input value={t.key} onChange={(e) => setTag(i, e.target.value, t.value)} />
            </div>
            <div className="nm-form-row" style={{ margin: 0 }}>
              <label>Value</label>
              <input value={t.value} onChange={(e) => setTag(i, t.key, e.target.value)} />
            </div>
            <button className="nm-btn secondary small" onClick={() => removeTag(i)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="nm-btn"
          onClick={submit}
          disabled={submitting || !nameValid || !cidrValid}
        >
          {submitting ? "Creating..." : "Create VPC"}
        </button>
        <button
          className="nm-btn secondary"
          onClick={() => navigate("/networking/vpcs")}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
