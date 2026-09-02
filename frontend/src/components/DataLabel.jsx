import "./shared.css";

const KIND = {
  live: { label: "LIVE", className: "datalabel live" },
  simulated: { label: "SIMULATED", className: "datalabel simulated" },
  demo: { label: "DEMO DATA", className: "datalabel demo" },
};

/**
 * DataLabel — the plan rule: any number on screen must clearly say whether it's
 * real, simulated, or demo data. Wrap every dynamic figure with this.
 */
export default function DataLabel({ kind = "simulated", children, title }) {
  const info = KIND[kind] || KIND.simulated;
  return (
    <span className={`data-wrap ${KIND[kind] ? "" : "simulated"}`} title={title}>
      {children}
      <span className={info.className}>{info.label}</span>
    </span>
  );
}