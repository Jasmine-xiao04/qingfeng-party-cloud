import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api, clearApiCache } from "../api/client";
import { useCachedQuery } from "../api/useCachedQuery";
import { pointTypeLabels } from "../api/types";
import { useAuth } from "../components/AuthContext";

export default function PointsPage({ mine = false }: { mine?: boolean }) {
  const recordsUrl = mine ? "/points/my" : "/points/records";
  const { user } = useAuth();
  const { data, loading, refreshing, reload } = useCachedQuery<any>(recordsUrl);
  const { data: rankings = [], refreshing: rankingsRefreshing, reload: reloadRankings } = useCachedQuery<any[]>(mine ? "/rankings?scope=myBatch" : null);
  const { data: users = [], refreshing: usersRefreshing, reload: reloadUsers } = useCachedQuery<any[]>(mine ? null : "/users?sortByPoints=true");
  const rows = mine ? data?.records ?? [] : data ?? [];
  const rankingSelf = mine ? rankings.find((item) => item.id === user?.id) : null;
  const apiTotal = Number(data?.totalPoints ?? 0);
  const total = mine ? (rows.length > 0 || apiTotal !== 0 ? apiTotal : Number(rankingSelf?.totalPoints ?? 0)) : 0;
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const refresh = () => {
    clearApiCache();
    void Promise.all([reload(), mine ? reloadRankings() : reloadUsers()]);
  };

  const submitAdjust = async (values: any) => {
    try {
      await api.post("/points/adjust", values);
      message.success("积分调整已记录");
      setOpen(false);
      form.resetFields();
      void Promise.all([reload(), reloadUsers()]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "积分调整失败");
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{mine ? "我的积分" : "积分流水"}</h1>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} loading={(refreshing || rankingsRefreshing) && rows.length > 0} onClick={refresh}>刷新</Button>
          {!mine && <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>手动调整积分</Button>}
        </Space>
      </div>
      {mine && <Card><span className="score-number">{total}</span><span className="muted"> 当前总积分</span></Card>}
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          loading={loading || refreshing}
          scroll={{ x: 900 }}
          columns={[
            ...(!mine ? [{ title: "成员", render: (_: unknown, row: any) => `${row.user?.name ?? ""} ${row.user?.studentNo ?? ""}` }] : []),
            { title: "积分变化", dataIndex: "pointsChange", render: (value) => <Tag color={value >= 0 ? "green" : "red"}>{value >= 0 ? `+${value}` : value}</Tag> },
            { title: "类型", dataIndex: "type", render: (value) => pointTypeLabels[value] ?? value },
            { title: "关联活动", render: (_: unknown, row: any) => row.activity?.title ?? "-" },
            { title: "备注", dataIndex: "remark" },
            { title: "时间", dataIndex: "createdAt", render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm") }
          ]}
        />
      </Card>

      <Modal title="手动调整积分" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={submitAdjust}>
          <Form.Item name="userId" label="成员" rules={[{ required: true, message: "请选择成员" }]}>
            <Select
              showSearch
              loading={usersRefreshing}
              placeholder="搜索姓名或学号"
              optionFilterProp="label"
              options={users.map((user) => ({
                value: user.id,
                label: `${user.name} ${user.studentNo ?? user.workNo ?? ""}`
              }))}
            />
          </Form.Item>
          <Form.Item name="pointsChange" label="积分变化" rules={[{ required: true, message: "请输入积分变化" }]}>
            <InputNumber min={-100} max={100} step={0.5} style={{ width: "100%" }} placeholder="加分填正数，扣分填负数" />
          </Form.Item>
          <Form.Item name="remark" label="调整原因" rules={[{ required: true, message: "请填写调整原因，方便追溯" }]}>
            <Input.TextArea rows={3} placeholder="例如：补录志愿服务、活动请假扣分修正等" />
          </Form.Item>
        </Form>
        <Space className="mt-8">
          <span className="muted">调整会生成“管理员调整”积分流水，不会覆盖历史数据。</span>
        </Space>
      </Modal>
    </div>
  );
}
