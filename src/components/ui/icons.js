// Lucide icons per Design.md — consistent stroke, no filled icons.
// Re-exported under stable local names so consumers never import lucide directly.
export {
  LayoutDashboard as IconDashboard,
  Map as IconMap,
  Building2 as IconBuildings,
  User as IconUser,
  CircleCheck as IconOkCircle,
  Clock as IconClock,
  House as IconHome,
  Plus as IconPlus,
  Search as IconSearch,
  Crosshair as IconCrosshair,
  ArrowLeft as IconArrowLeft,
  TriangleAlert as IconWarn,
  LogOut as IconLogout,
  FileText as IconDoc,
  Camera as IconCamera,
  MapPin as IconPin,
  SlidersHorizontal as IconFilters,
  Navigation as IconNavigate,
  LayoutDashboard as IconAdmin,
  Pencil as IconEdit,
  Trash2 as IconTrash,
  Sun as IconSun,
  Moon as IconMoon,
  PanelLeftClose as IconCollapse,
  PanelLeftOpen as IconExpand,
  Layers as IconLayers,
  X as IconClose,
  Palette as IconPalette,
  ScrollText as IconLogs,
  Upload as IconUpload,
  Download as IconDownload,
  Eye as IconEye,
} from 'lucide-react'

/** Brand glyph: three network nodes joined by fiber links. */
export function NodeMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6.5 17.5 12 7l5.5 9.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 17.5h11" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="6.5" r="2.6" fill="var(--color-pulse)" />
      <circle cx="6" cy="17.5" r="2.6" fill="currentColor" />
      <circle cx="18.5" cy="17.5" r="2.6" fill="currentColor" />
    </svg>
  )
}
