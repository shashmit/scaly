const kpis = [
  { label: "Outstanding", value: "$24,520", trend: "+12%" },
  { label: "Overdue", value: "$3,120", trend: "-8%" },
  { label: "Paid This Month", value: "$41,900", trend: "+18%" },
];

const invoices = [
  { id: "INV-2025-021", customer: "Northstar Labs", amount: "$2,400", status: "Sent" },
  { id: "INV-2025-022", customer: "Cedar & Co", amount: "$7,850", status: "Overdue" },
  { id: "INV-2025-023", customer: "Pixel Forge", amount: "$1,990", status: "Draft" },
];

export function App() {
  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Scaly Invoicing</h1>
          <p>AI-first invoicing workspace powered by Convex.</p>
        </div>
        <button className="primaryButton">New Invoice</button>
      </header>

      <section className="kpis">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card">
            <p className="label">{kpi.label}</p>
            <h2>{kpi.value}</h2>
            <span>{kpi.trend} vs last month</span>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="tableHeader">
          <h3>Recent invoices</h3>
          <button className="ghostButton">Open all</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.id}</td>
                <td>{invoice.customer}</td>
                <td>{invoice.amount}</td>
                <td>
                  <span className={`badge badge-${invoice.status.toLowerCase()}`}>{invoice.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
