import type { StaffMember } from "../Pages/mock-data";

export default function Avatar({ member, small = false }: { member?: StaffMember; small?: boolean }) {
  return <span className={`avatar ${small ? "small" : ""} ${member?.photo ? "has-photo" : ""}`} style={{ backgroundColor: member?.color ?? "#60706d", backgroundImage: member?.photo ? `url("${member.photo}")` : undefined }}>{member?.photo ? "" : member?.initials ?? "?"}</span>;
}
