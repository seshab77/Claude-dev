export function ComingSoonPage({ service }: { service: string }) {
  return (
    <>
      <div className="nm-breadcrumbs">{service}</div>
      <h1 className="nm-h1">{service}</h1>
      <div className="nm-panel">
        <div className="nm-empty">
          <p><strong>Coming soon.</strong></p>
          <p>The Nimbus Console will offer {service.toLowerCase()} services here — we're starting with Load Balancers.</p>
        </div>
      </div>
    </>
  );
}
