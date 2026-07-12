import type { Role } from '../auth/auth'
import {
  Grid, Activity, Network, Folder, Bot, Cpu, Sliders, BarChart, FileCheck, Settings, MapPin,
} from '../components/icons'

export interface NavItem {
  id: string
  path: string
  label: string
  group: string
  icon: typeof Grid
  roles: Role[] | 'all'
}

export const NAV: NavItem[] = [
  { id: 'overview', path: '/overview', label: 'Executive Overview', group: 'Monitor', icon: Grid, roles: 'all' },
  { id: 'monitoring', path: '/monitoring', label: 'Live Monitoring', group: 'Monitor', icon: Activity, roles: ['admin', 'analyst', 'ml_engineer'] },
  { id: 'graph', path: '/graph', label: 'Graph Intelligence', group: 'Monitor', icon: Network, roles: ['admin', 'analyst', 'ml_engineer'] },
  { id: 'geo', path: '/geo', label: 'Geographic Map', group: 'Monitor', icon: MapPin, roles: 'all' },
  { id: 'investigations', path: '/investigations', label: 'Investigations', group: 'Operate', icon: Folder, roles: ['admin', 'analyst', 'compliance'] },
  { id: 'copilot', path: '/copilot', label: 'AI Copilot', group: 'Operate', icon: Bot, roles: ['admin', 'analyst', 'compliance'] },
  { id: 'modelops', path: '/modelops', label: 'Model Ops', group: 'Operate', icon: Cpu, roles: ['admin', 'ml_engineer'] },
  { id: 'rules', path: '/rules', label: 'Rules Engine', group: 'Configure', icon: Sliders, roles: ['admin', 'ml_engineer', 'analyst'] },
  { id: 'analytics', path: '/analytics', label: 'Analytics & Reports', group: 'Configure', icon: BarChart, roles: 'all' },
  { id: 'compliance', path: '/compliance', label: 'Compliance & Audit', group: 'Configure', icon: FileCheck, roles: ['admin', 'compliance', 'analyst'] },
  { id: 'admin', path: '/admin', label: 'Administration', group: 'Configure', icon: Settings, roles: ['admin'] },
]

export function canAccess(item: NavItem, role: Role): boolean {
  return item.roles === 'all' || item.roles.includes(role)
}

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((n) => canAccess(n, role))
}

// Each role lands on the workspace most relevant to their job.
export function roleHome(role: Role): string {
  switch (role) {
    case 'ml_engineer': return '/modelops'
    case 'compliance': return '/compliance'
    default: return '/overview'
  }
}
