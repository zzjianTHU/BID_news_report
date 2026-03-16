import Link from "next/link";

type StickySwitcherProps = {
  items: Array<{
    label: string;
    href: string;
    active?: boolean;
  }>;
  sticky?: boolean;
};

export function StickySwitcher({ items, sticky = false }: StickySwitcherProps) {
  return (
    <div className={`sticky-switcher ${sticky ? "is-sticky" : ""}`}>
      {items.map((item) => (
        <Link className={`switcher-link ${item.active ? "is-active" : ""}`} href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
