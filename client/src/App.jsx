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
import FacultyLogin from './pages/auth/FacultyLogin';
import SuperAdminLogin from './pages/auth/SuperAdminLogin';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentComplaints from './pages/student/StudentComplaints';
import RaiseComplaint from './pages/student/RaiseComplaint';
import ComplaintDetail from './pages/student/ComplaintDetail';
import StudentProfile from './pages/student/StudentProfile';
import StudentSettings from './pages/student/StudentSettings';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail';
import AdminStudents from './pages/admin/AdminStudents';
import AdminFaculty from './pages/admin/AdminFaculty';
import AdminCaseAllocation from './pages/admin/AdminCaseAllocation';

// Faculty Pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyComplaints from './pages/faculty/FacultyComplaints';
import FacultyRaiseComplaint from './pages/faculty/FacultyRaiseComplaint';
import FacultyStudents from './pages/faculty/FacultyStudents';
import FacultyProfile from './pages/faculty/FacultyProfile';

// Super Admin Pages
import SuperAdminDashboard from './pages/superAdmin/SuperAdminDashboard';
import SuperAdminAdmins from './pages/superAdmin/SuperAdminAdmins';
import SuperAdminAuditLogs from './pages/superAdmin/SuperAdminAuditLogs';
import SuperAdminSettings from './pages/superAdmin/SuperAdminSettings';
import SuperAdminWorkload from './pages/superAdmin/SuperAdminWorkload';
import SuperAdminAnnouncements from './pages/superAdmin/SuperAdminAnnouncements';

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
              <Route path="/faculty/login" element={<FacultyLogin />} />
              <Route path="/super-admin/login" element={<SuperAdminLogin />} />

              {/* Student Protected Routes (RBAC) */}
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/complaints" element={<ProtectedRoute allowedRoles={['student']}><StudentComplaints /></ProtectedRoute>} />
              <Route path="/student/complaints/new" element={<ProtectedRoute allowedRoles={['student']}><RaiseComplaint /></ProtectedRoute>} />
              <Route path="/student/complaints/:id" element={<ProtectedRoute allowedRoles={['student']}><ComplaintDetail /></ProtectedRoute>} />
              <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
              <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><StudentSettings /></ProtectedRoute>} />

              {/* Admin Protected Routes (RBAC) */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/complaints" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaints /></ProtectedRoute>} />
              <Route path="/admin/complaints/:id" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaintDetail /></ProtectedRoute>} />
              <Route path="/admin/case-allocation" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminCaseAllocation /></ProtectedRoute>} />
              <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/admin/faculty" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminFaculty /></ProtectedRoute>} />
              <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />

              {/* Faculty Protected Routes (RBAC) */}
              <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/faculty/complaints" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyComplaints /></ProtectedRoute>} />
              <Route path="/faculty/complaints/new" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyRaiseComplaint /></ProtectedRoute>} />
              <Route path="/faculty/complaints/:id" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyComplaints /></ProtectedRoute>} />
              <Route path="/faculty/students" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyStudents /></ProtectedRoute>} />
              <Route path="/faculty/profile" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyProfile /></ProtectedRoute>} />

              {/* Super Admin Protected Routes (RBAC) */}
              <Route path="/super-admin/dashboard" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
              <Route path="/super-admin/workload" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminWorkload /></ProtectedRoute>} />
              <Route path="/super-admin/admins" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAdmins /></ProtectedRoute>} />
              <Route path="/super-admin/complaints" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminComplaints /></ProtectedRoute>} />
              <Route path="/super-admin/students" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAuditLogs /></ProtectedRoute>} />
              <Route path="/super-admin/announcements" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAnnouncements /></ProtectedRoute>} />
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
