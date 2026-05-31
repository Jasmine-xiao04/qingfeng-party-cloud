import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="无权限访问"
      subTitle="当前账号没有访问该页面的权限。"
      extra={<Button type="primary"><Link to="/">返回首页</Link></Button>}
    />
  );
}

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请检查地址是否正确。"
      extra={<Button type="primary"><Link to="/">返回首页</Link></Button>}
    />
  );
}
