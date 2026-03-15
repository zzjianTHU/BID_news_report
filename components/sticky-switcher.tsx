import Link from "next/link";

type StickySwitcherProps = {
  items: Array<{
    label: string;
    href: string;
    active?: boolean;
  }>;
};

export function StickySwitcher({ items }: StickySwitcherProps) {
  return (
    <div className="sticky-switcher">
      {items.map((item) => (
        <Link className={`switcher-link ${item.active ? "is-active" : ""}`} href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
