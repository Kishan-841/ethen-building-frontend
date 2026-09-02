import { redirect } from 'next/navigation'

// The admin dashboard merged into the home dashboard (/dashboard) —
// stats, permission cost, and the Manage section live there, role-gated.
// The /admin/* child pages (zones, building-types, users) remain.
export default function AdminIndexPage() {
  redirect('/dashboard')
}
