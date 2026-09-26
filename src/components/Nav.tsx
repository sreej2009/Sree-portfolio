const links = [
  { href: "#services", label: "Services" },
  { href: "#skills", label: "Skills" },
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  return (
    <header className="nav">
      <a className="nav__mark" href="#intro">
        SREE
      </a>
      <nav className="nav__links">
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
