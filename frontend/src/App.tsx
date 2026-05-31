import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import MembersPage from "./pages/MembersPage";
import MemberDetailPage from "./pages/MemberDetailPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import ImportPage from "./pages/ImportPage";
import RankingsPage from "./pages/RankingsPage";
import PointsPage from "./pages/PointsPage";
import HonorsPage from "./pages/HonorsPage";
import HonorDetailPage from "./pages/HonorDetailPage";
import StudentHome from "./pages/StudentHome";
import { ForbiddenPage, NotFoundPage } from "./pages/StatusPages";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "STUDENT" ? "/student" : "/admin"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
          </Route>
          <Route element={<ProtectedRoute roles={["SECRETARY", "ASSISTANT"]} />}>
            <Route path="/admin" element={<AppLayout mode="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:id" element={<MemberDetailPage />} />
              <Route path="activities" element={<ActivitiesPage />} />
              <Route path="activities/:id" element={<ActivityDetailPage />} />
              <Route path="import/activity" element={<ImportPage type="activity" />} />
              <Route path="import/history" element={<ImportPage type="history" />} />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="points" element={<PointsPage />} />
              <Route path="honors" element={<HonorsPage />} />
              <Route path="honors/:id" element={<HonorDetailPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute roles={["STUDENT", "SECRETARY", "ASSISTANT"]} />}>
            <Route path="/student" element={<AppLayout mode="student" />}>
              <Route index element={<StudentHome />} />
              <Route path="activities" element={<ActivitiesPage readonly />} />
              <Route path="activities/:id" element={<ActivityDetailPage readonly />} />
              <Route path="rankings" element={<RankingsPage student />} />
              <Route path="points" element={<PointsPage mine />} />
              <Route path="honors" element={<HonorsPage readonly />} />
              <Route path="honors/:id" element={<HonorDetailPage readonly />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
