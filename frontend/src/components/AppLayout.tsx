import { Avatar, Button, Drawer, Layout, Menu } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Crown,
  FileSpreadsheet,
  Home,
  LogOut,
  Menu as MenuIcon,
  Trophy,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { warmApiCache } from "../api/client";
import { roleLabels } from "../api/types";
import { useAuth } from "./AuthContext";

const { Header, Sider, Content } = Layout;

const adminItems = [
  { key: "/admin", icon: <BarChart3 size={18} />, label: <Link to="/admin">数据看板</Link> },
  { key: "/admin/members", icon: <Users size={18} />, label: <Link to="/admin/members">成员管理</Link> },
  { key: "/admin/activities", icon: <CalendarDays size={18} />, label: <Link to="/admin/activities">活动管理</Link> },
  { key: "/admin/import/activity", icon: <FileSpreadsheet size={18} />, label: <Link to="/admin/import/activity">名单导入</Link> },
  { key: "/admin/import/history", icon: <FileSpreadsheet size={18} />, label: <Link to="/admin/import/history">历史导入</Link> },
  { key: "/admin/rankings", icon: <Trophy size={18} />, label: <Link to="/admin/rankings">积分排行</Link> },
  { key: "/admin/points", icon: <BarChart3 size={18} />, label: <Link to="/admin/points">积分流水</Link> },
  { key: "/admin/honors", icon: <Crown size={18} />, label: <Link to="/admin/honors">荣誉管理</Link> }
];

const studentItems = [
  { key: "/student", icon: <Home size={18} />, label: <Link to="/student">首页</Link> },
  { key: "/student/activities", icon: <CalendarDays size={18} />, label: <Link to="/student/activities">活动中心</Link> },
  { key: "/student/rankings", icon: <Trophy size={18} />, label: <Link to="/student/rankings">我的排名</Link> },
  { key: "/student/points", icon: <BarChart3 size={18} />, label: <Link to="/student/points">我的积分</Link> },
  { key: "/student/honors", icon: <Crown size={18} />, label: <Link to="/student/honors">荣誉展示</Link> }
];

export function AppLayout({ mode }: { mode: "admin" | "student" }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = mode === "admin" ? adminItems : studentItems;

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setTimeout(() => {
      if (mode === "admin") {
        warmApiCache(["/dashboard/admin", "/users?sortByPoints=true", "/activities", "/rankings"]);
      } else {
        warmApiCache(["/dashboard/student", "/activities", "/rankings?scope=myBatch", "/points/my"]);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [mode, user?.id]);

  const nav = <Menu mode="inline" selectedKeys={[location.pathname]} items={items} className="side-menu" />;

  return (
    <Layout className="app-shell">
      <Sider width={236} className="desktop-sider">
        <div className="brand">青锋党建云</div>
        {nav}
      </Sider>
      <Layout>
        <Header className="app-header">
          <Button className="mobile-only" type="text" icon={<MenuIcon size={20} />} onClick={() => setOpen(true)} />
          <div className="header-title">{mode === "admin" ? "支部管理工作台" : "学生服务中心"}</div>
          <div className="header-user">
            <Avatar style={{ background: "#b42318" }}>{user?.name?.slice(0, 1)}</Avatar>
            <span>{user?.name}</span>
            <span className="muted">{user ? roleLabels[user.role] : ""}</span>
            <Button
              type="text"
              icon={<LogOut size={17} />}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            />
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
      <Drawer title="青锋党建云" placement="left" open={open} onClose={() => setOpen(false)} width={260}>
        {nav}
      </Drawer>
    </Layout>
  );
}
