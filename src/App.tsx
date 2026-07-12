import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { PipelineProvider } from './state/PipelineContext'
import { canAccess, NAV } from './app/nav'
import { AppShell } from './app/AppShell'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { MonitoringPage } from './pages/MonitoringPage'
import { GraphPage } from './pages/GraphPage'
import { GeoPage } from './pages/GeoPage'
import { InvestigationsPage } from './pages/InvestigationsPage'
import { CopilotPage } from './pages/CopilotPage'
import { ModelOpsPage } from './pages/ModelOpsPage'
import { RulesPage } from './pages/RulesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CompliancePage } from './pages/CompliancePage'
import { AdminPage } from './pages/AdminPage'
import type { JSX } from 'react'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function Guard({ id, children }: { id: string; children: JSX.Element }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const item = NAV.find((n) => n.id === id)!
  return canAccess(item, user.role) ? children : <Navigate to="/overview" replace />
}

function LoginGate() {
  const { user } = useAuth()
  return user ? <Navigate to="/overview" replace /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <PipelineProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/monitoring" element={<Guard id="monitoring"><MonitoringPage /></Guard>} />
              <Route path="/graph" element={<Guard id="graph"><GraphPage /></Guard>} />
              <Route path="/geo" element={<GeoPage />} />
              <Route path="/investigations" element={<Guard id="investigations"><InvestigationsPage /></Guard>} />
              <Route path="/copilot" element={<Guard id="copilot"><CopilotPage /></Guard>} />
              <Route path="/modelops" element={<Guard id="modelops"><ModelOpsPage /></Guard>} />
              <Route path="/rules" element={<Guard id="rules"><RulesPage /></Guard>} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/compliance" element={<Guard id="compliance"><CompliancePage /></Guard>} />
              <Route path="/admin" element={<Guard id="admin"><AdminPage /></Guard>} />
            </Route>
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </HashRouter>
      </PipelineProvider>
    </AuthProvider>
  )
}
