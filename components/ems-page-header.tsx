type Props = { active?: string };

const links = [
  { href: "/", label: "Home", key: "home" },
  { href: "/stock-control", label: "Stock & movements", key: "stock" },
  { href: "/operations", label: "Magazine tasks", key: "operations" },
  { href: "/compliance", label: "Safety & incidents", key: "safety" },
  { href: "/reports", label: "Reports", key: "reports" },
];

export default function EmsPageHeader({ active = "" }: Props) {
  return (
    <header className="ems-pagebar no-print">
      <a className="ems-pagebrand" href="/" aria-label="Crocodile River Mine EMS home">
        <img src="/crm-logo.svg" alt="" />
        <span><strong>Crocodile River Mine</strong><small>Explosives Management System</small></span>
      </a>
      <nav className="ems-page-links" aria-label="Main navigation">
        {links.map(link => (
          <a key={link.key} href={link.href} className={active === link.key ? "current" : ""} aria-current={active === link.key ? "page" : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
      <a className="ems-page-home" href="/">Dashboard</a>
    </header>
  );
}
