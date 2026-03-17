import { notFound } from "next/navigation";

export default function AdminDisabledLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  void children;
  notFound();
}
