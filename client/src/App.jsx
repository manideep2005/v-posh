import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Landing from './pages/Landing';
import Awareness from './pages/Awareness';

// Auth Pages
import StudentLogin from './pages/auth/StudentLogin';
import StudentSignup from './pages/auth/StudentSignup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AdminLogin from './pages/auth/AdminLogin';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentComplaints from './pages/student/StudentComplaints';
import RaiseComplaint from './pages/student/RaiseComplaint';
import ComplaintDetail from './pages/student/ComplaintDetail';
import StudentProfile from './pages/student/StudentProfile';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail';
import AdminStudents from './pages/admin/AdminStudents';

// Super Admin Pages
import SuperAdminDashboard from './pages/superAdmin/SuperAdminDashboard';
import SuperAdminAdmins from './pages/superAdmin/SuperAdminAdmins';
import SuperAdminAuditLogs from './pages/superAdmin/SuperAdminAuditLogs';
import SuperAdminSettings from './pages/superAdmin/SuperAdminSettings';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Header />
          <main style={{ flex: '1 0 auto' }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/awareness" element={<Awareness />} />

              {/* Auth Routes */}
              <Route path="/auth/student/login" element={<StudentLogin />} />
              <Route path="/auth/student/signup" element={<StudentSignup />} />
              <Route path="/auth/student/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* Student Protected Routes (RBAC) */}
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/complaints" element={<ProtectedRoute allowedRoles={['student']}><StudentComplaints /></ProtectedRoute>} />
              <Route path="/student/complaints/new" element={<ProtectedRoute allowedRoles={['student']}><RaiseComplaint /></ProtectedRoute>} />
              <Route path="/student/complaints/:id" element={<ProtectedRoute allowedRoles={['student']}><ComplaintDetail /></ProtectedRoute>} />
              <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
              <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />

              {/* Admin Protected Routes (RBAC) */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/complaints" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaints /></ProtectedRoute>} />
              <Route path="/admin/complaints/:id" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaintDetail /></ProtectedRoute>} />
              <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />

              {/* Super Admin Protected Routes (RBAC) */}
              <Route path="/super-admin/dashboard" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
              <Route path="/super-admin/admins" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAdmins /></ProtectedRoute>} />
              <Route path="/super-admin/complaints" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminComplaints /></ProtectedRoute>} />
              <Route path="/super-admin/students" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAuditLogs /></ProtectedRoute>} />
              <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSettings /></ProtectedRoute>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
