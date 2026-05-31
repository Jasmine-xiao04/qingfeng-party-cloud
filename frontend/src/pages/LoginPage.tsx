import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../components/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <div className="login-copy">
        <div className="login-mark">
          <ShieldCheck size={28} />
        </div>
        <Typography.Title>青锋党建云</Typography.Title>
        <Typography.Paragraph>
          面向高校党支部的活动发布、Excel 名单导入、积分流水、排行榜和荣誉展示平台。
        </Typography.Paragraph>
      </div>
      <Card className="login-card">
        <Typography.Title level={3}>账号登录</Typography.Title>
        <Form
          layout="vertical"
          initialValues={{ account: "teacher@qingfeng.local", password: "Qingfeng@123" }}
          onFinish={async (values) => {
            try {
              const user = await login(values.account, values.password);
              message.success("登录成功");
              navigate(user.role === "STUDENT" ? "/student" : "/admin", { replace: true });
            } catch (error) {
              message.error(error instanceof Error ? error.message : "登录失败");
            }
          }}
        >
          <Form.Item label="账号" name="account" rules={[{ required: true, message: "请输入邮箱、手机号、学号或工号" }]}>
            <Input size="large" placeholder="teacher@qingfeng.local" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" placeholder="Qingfeng@123" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            登录
          </Button>
        </Form>
        <div className="login-tips">
          <span>默认账号：</span>
          <code>teacher@qingfeng.local</code>
          <span> / </span>
          <code>Qingfeng@123</code>
        </div>
      </Card>
    </div>
  );
}
