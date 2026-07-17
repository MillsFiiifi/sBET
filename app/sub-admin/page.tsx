import { redirect } from 'next/navigation'

// Visiting /sub-admin (no subpath) sends partners to their login.
export default function SubAdminIndex() {
  redirect('/sub-admin/login')
}
