import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin } from "antd";
import type { RoleCode } from "../api/types";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ roles }: { roles?: RoleCode[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
