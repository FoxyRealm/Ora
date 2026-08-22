import type { Metadata } from "next";
import "./Style/global.css";
import "./Style/Shared.css";
import "./Style/Authentication.css";
import "./Style/Dashboard.css";
import "./Style/Cases.css";
import "./Style/Schedule.css";
import "./Style/Delivery.css";
import "./Style/Doctors.css";
import "./Style/DoctorPortal.css";
import "./Style/Accounting.css";
import "./Style/Inventory.css";
import "./Style/Team.css";
import "./Style/Log.css";
import "./Style/Settings.css";
import AppRootLayout from "./Layouts/RootLayout";

export const metadata: Metadata = {
  title: "Ora Dental Lab",
  description: "Internal case, production, accounting, scheduling and inventory workspace for Ora Dental Lab.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppRootLayout>{children}</AppRootLayout>;
}
