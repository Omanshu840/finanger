import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import AppShell from '@/components/layout/AppShell'
import AuthGuard from '@/components/auth/AuthGuard'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import OfflineFallback from '@/pages/OfflineFallback'
import { registerSWUpdatePrompt } from '@/lib/sw-update'
import { Toaster } from '@/components/ui/sonner'
import SplitwiseCallback from '@/components/integrations/SplitwiseCallback'
import InvestmentsAsset from '@/pages/InvestmentsAsset'
import ImportHoldings from './components/investments/ImportHoldings'

// Lazy-loaded routes
const Auth = lazy(() => import('@/pages/Auth'))
const AuthCallback = lazy(() => import('@/pages/AuthCallback'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Investments = lazy(() => import('@/pages/Investments'))
const Settings = lazy(() => import('@/pages/Settings'))
const Profile = lazy(() => import('@/pages/Settings/Profile'))

// Register service worker update handler
registerSWUpdatePrompt()

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
)

const basename = '/finanger'

const router = createBrowserRouter([
  {
    path: '/auth',
    element: (
      <AuthGuard requireAuth={false}>
        <Suspense fallback={<LoadingFallback />}>
          <Auth />
        </Suspense>
      </AuthGuard>
    )
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AuthCallback />
      </Suspense>
    )
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        )
      },
      {
        path: 'expenses',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Expenses />
          </Suspense>
        )
      },
      {
        path: 'investments',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Investments />
          </Suspense>
        )
      },
      {
        path: 'investments/asset/:assetId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <InvestmentsAsset />
          </Suspense>
        )
      },
      {
        path: 'investments/import',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ImportHoldings />
          </Suspense>
        )
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Settings />
          </Suspense>
        )
      },
      {
        path: 'settings/profile',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Profile />
          </Suspense>
        )
      },
      {
        path: 'integrations/splitwise/callback',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <SplitwiseCallback />
          </Suspense>
        )
      },
      {
        path: 'offline',
        element: <OfflineFallback />
      }
    ],
  }
], { basename })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="finance-app-theme">
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
