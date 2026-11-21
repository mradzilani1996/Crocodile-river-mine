import type { Metadata } from "next";
import "./globals.css";
import "./magazine-ux.css";
import TaskNotificationBar from "@/components/task-notification-bar";

export const metadata: Metadata = {
  title: "Crocodile River Mine | Explosives Management System",
  description: "Controlled explosives inventory, accountable movements and traceable approvals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><TaskNotificationBar />{children}</body></html>;
}