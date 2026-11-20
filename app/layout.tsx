import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crocodile River Mine | Explosives Management System",
  description: "Controlled explosives inventory, accountable movements and traceable approvals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}