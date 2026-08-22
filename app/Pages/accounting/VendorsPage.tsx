"use client";

import { Building2, Mail, Phone, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import Modal from "../../Components/Modal";
import TablePagination, { useTablePagination } from "../../Components/TablePagination";
import useDemoState from "../../Components/useDemoState";
import "../../Style/AccountingVendors.css";

type Vendor = { name: string; category: string; contact: string; phone: string; email: string; balance: string; currency: string };

const initialVendors: Vendor[] = [
  { name: "Dental Mill Supply", category: "Zirconia & milling", contact: "Nabil Kareem", phone: "+963 11 555 0214", email: "orders@dentalmill.example", balance: "$420.00", currency: "USD" },
  { name: "OralTech Services", category: "Resin & printing", contact: "Rana Saad", phone: "+963 11 555 0322", email: "sales@oraltech.example", balance: "$340.00", currency: "USD" },
  { name: "CeramicWorks", category: "Glazing & ceramics", contact: "Samer Daher", phone: "+963 11 555 0458", email: "support@ceramicworks.example", balance: "$0.00", currency: "USD" },
];

export default function VendorsPage() {
  const [vendors, setVendors] = useDemoState<Vendor[]>(initialVendors);
  const [addingVendor, setAddingVendor] = useState(false);
  const vendorPagination = useTablePagination(vendors, vendors.length);

  function addVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    setVendors((current) => [...current, { name, category: String(form.get("category")).trim() || "General supplier", contact: String(form.get("contact")).trim() || "Not recorded", phone: String(form.get("phone")).trim() || "Not recorded", email: String(form.get("email")).trim() || "Not recorded", balance: "$0.00", currency: String(form.get("currency")) || "USD" }]);
    setAddingVendor(false);
  }

  return <div className="vendors-page">
    <header className="vendors-heading"><div><span>Purchases</span><h2>Vendors</h2><p>Suppliers used for dental materials, lab services, and operating costs.</p></div><button className="primary-button" type="button" onClick={() => setAddingVendor(true)}><Plus size={16} />Add new</button></header>
    <section className="vendors-card"><div className="vendors-card-header"><div><h3>All vendors</h3><p>{vendors.length} active suppliers</p></div></div><div className="finance-table-scroll"><table className="finance-table vendors-table"><thead><tr><th>Company name</th><th>Category</th><th>Primary contact</th><th>Phone</th><th>Email</th><th>Currency</th><th>Open balance</th></tr></thead><tbody>{vendorPagination.pageItems.map((vendor) => <tr key={vendor.name}><td><span className="vendor-name"><span><Building2 size={16} /></span><strong>{vendor.name}</strong></span></td><td>{vendor.category}</td><td>{vendor.contact}</td><td><span className="vendor-contact"><Phone size={13} />{vendor.phone}</span></td><td><span className="vendor-contact"><Mail size={13} />{vendor.email}</span></td><td><span className="vendor-currency">{vendor.currency}</span></td><td className="vendor-balance">{vendor.balance}</td></tr>)}</tbody></table></div><TablePagination {...vendorPagination} /></section>
    {addingVendor && <Modal title="Add new vendor" subtitle="Create a supplier record for purchases and bills." onClose={() => setAddingVendor(false)}><form className="vendors-form" onSubmit={addVendor}><label className="field"><span>Company name</span><input name="name" required /></label><label className="field"><span>Category</span><input name="category" placeholder="e.g. Zirconia & milling" /></label><label className="field"><span>Primary contact</span><input name="contact" /></label><label className="field"><span>Currency</span><select name="currency" defaultValue="USD"><option>USD</option><option>SYP</option><option>EUR</option></select></label><label className="field"><span>Phone</span><input name="phone" type="tel" /></label><label className="field"><span>Email</span><input name="email" type="email" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setAddingVendor(false)}>Cancel</button><button className="primary-button" type="submit">Add vendor</button></div></form></Modal>}
  </div>;
}
