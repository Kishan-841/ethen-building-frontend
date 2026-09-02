import {
  IconMap,
  IconLayers,
  IconPin,
  IconNavigate,
  IconBuildings,
  IconUser,
  IconLogs,
} from '@/components/ui/icons'

/**
 * Admin/manage destinations — one source of truth for the dashboard's Manage
 * grid and the desktop sidebar. `adminOnly` rows hide from managers.
 */
export const MANAGE_LINKS = [
  { href: '/admin/cities', label: 'Cities', sub: 'Operator groups', icon: IconMap, adminOnly: true },
  { href: '/admin/operators', label: 'Operators', sub: 'Zone groups', icon: IconLayers },
  { href: '/admin/zones', label: 'Zones', sub: 'Coverage areas', icon: IconPin },
  { href: '/admin/fiber', label: 'Fiber routes', sub: 'Network lines', icon: IconNavigate },
  { href: '/admin/building-types', label: 'Building types', sub: 'Form options', icon: IconBuildings },
  { href: '/admin/users', label: 'Users', sub: 'Team & roles', icon: IconUser, adminOnly: true },
  { href: '/admin/system-logs', label: 'System logs', sub: 'Audit trail', icon: IconLogs, adminOnly: true },
]
