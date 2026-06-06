import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/protected-route';
import { RealtimeProvider } from '@/components/realtime-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { ConexaoPage } from '@/pages/conexao-page';
import { ContaPage } from '@/pages/conta-page';
import { DeteccoesPage } from '@/pages/deteccoes-page';
import { GruposPage } from '@/pages/grupos-page';
import { LoginPage } from '@/pages/login-page';

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/conexao"
              element={
                <ProtectedRoute>
                  <ConexaoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/grupos"
              element={
                <ProtectedRoute>
                  <GruposPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deteccoes"
              element={
                <ProtectedRoute>
                  <DeteccoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conta"
              element={
                <ProtectedRoute>
                  <ContaPage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/conexao" replace />} />
            <Route path="*" element={<Navigate to="/conexao" replace />} />
          </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
