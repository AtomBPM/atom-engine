import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard/Dashboard'

// Lazy load pages
import { lazy, Suspense } from 'react'
import { Spin } from 'antd'

const StoragePage = lazy(() => import('./pages/Storage/StoragePage'))
const BpmnPage = lazy(() => import('./pages/Bpmn/BpmnPage'))
const BpmnDiagramPage = lazy(() => import('./pages/Bpmn/BpmnDiagramPage'))
const ProcessesPage = lazy(() => import('./pages/Processes/ProcessesPage'))
const ProcessDiagramPage = lazy(() => import('./pages/Processes/ProcessDiagramPage'))
const TokensPage = lazy(() => import('./pages/Tokens/TokensPage'))
const TimersPage = lazy(() => import('./pages/Timers/TimersPage'))
const JobsPage = lazy(() => import('./pages/Jobs/JobsPage'))
const MessagesPage = lazy(() => import('./pages/Messages/MessagesPage'))
const ExpressionsPage = lazy(() => import('./pages/Expressions/ExpressionsPage'))
const IncidentsPage = lazy(() => import('./pages/Incidents/IncidentsPage'))
const SystemPage = lazy(() => import('./pages/System/SystemPage'))

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
)

export const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/bpmn" element={<BpmnPage />} />
        <Route path="/bpmn/diagram/:processKey" element={<BpmnDiagramPage />} />
        <Route path="/processes" element={<ProcessesPage />} />
        <Route path="/processes/diagram/:instanceId" element={<ProcessDiagramPage />} />
        <Route path="/tokens" element={<TokensPage />} />
        <Route path="/timers" element={<TimersPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/expressions" element={<ExpressionsPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
