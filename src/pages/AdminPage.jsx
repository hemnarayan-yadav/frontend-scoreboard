import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading } from "../components/layout/SiteLayout.jsx";
import { DashboardShell } from "../components/admin/DashboardShell.jsx";
import OperatorDashboard from "./admin/OperatorDashboard.jsx";
import SuperAdminDashboard from "./admin/SuperAdminDashboard.jsx";
import "../styles/admin.css";

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <Loading>Checking admin access…</Loading>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardShell user={user} onSignOut={() => logout().then(() => navigate("/"))}>
      {user.role === "super_admin" ? <SuperAdminDashboard /> : <OperatorDashboard />}
    </DashboardShell>
  );
}
