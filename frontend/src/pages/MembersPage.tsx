import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Upload, message } from "antd";
import type { UploadFile } from "antd";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Plus, Search, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useCachedQuery } from "../api/useCachedQuery";
import { roleLabels, stageLabels } from "../api/types";
import { useAuth } from "../components/AuthContext";

export default function MembersPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [filters, setFilters] = useState({ keyword: "", developmentStage: "", batch: "" });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [form] = Form.useForm();

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({ sortByPoints: "true" });
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.developmentStage) params.set("developmentStage", filters.developmentStage);
    if (filters.batch) params.set("batch", filters.batch);
    return `/users?${params.toString()}`;
  }, [filters]);

  const { data, setData, loading, refreshing, reload } = useCachedQuery<any[]>(queryUrl);
  const rows = data ?? [];

  const canDeleteMember = (row: any) => {
    if (row.id === user?.id) return false;
    if (user?.role === "SECRETARY") return true;
    return user?.role === "ASSISTANT" && row.role?.code === "STUDENT";
  };

  const deleteMember = async (row: any) => {
    try {
      await api.delete(`/users/${row.id}`);
      setData(rows.filter((item) => item.id !== row.id));
      message.success("删除成功");
      void reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const submitImport = async () => {
    if (!fileList[0]?.originFileObj) return message.warning("请先选择成员 Excel");
    const data = new FormData();
    data.append("file", fileList[0].originFileObj);
    setImporting(true);
    try {
      const result = await api.post<never, any>("/users/import", data, { headers: { "Content-Type": "multipart/form-data" } });
      message.success(`导入完成：新增 ${result.created} 人，跳过 ${result.skipped} 人`);
      setImportOpen(false);
      setFileList([]);
      void reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成员导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>成员管理</h1>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} loading={refreshing && rows.length > 0} onClick={() => reload()}>刷新</Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={() => setImportOpen(true)}>批量导入成员</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新增成员</Button>
        </Space>
      </div>

      <div className="toolbar">
        <Input
          allowClear
          prefix={<Search size={16} />}
          placeholder="搜索姓名或学号"
          value={filters.keyword}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
        />
        <Select
          allowClear
          placeholder="发展阶段"
          value={filters.developmentStage || undefined}
          onChange={(value) => setFilters((prev) => ({ ...prev, developmentStage: value ?? "" }))}
          options={Object.entries(stageLabels).map(([value, label]) => ({ value, label }))}
        />
        <Input
          allowClear
          placeholder="所属批次"
          value={filters.batch}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFilters((prev) => ({ ...prev, batch: event.target.value }))}
        />
      </div>

      <Table
        rowKey="id"
        dataSource={rows}
        loading={loading || refreshing}
        scroll={{ x: 760 }}
        pagination={{
          ...pagination,
          total: rows.length,
          showTotal: (total) => `共 ${total} 名成员`,
          onChange: (current, pageSize) => setPagination({ current, pageSize })
        }}
        columns={[
          {
            title: "姓名",
            dataIndex: "name",
            fixed: "left",
            width: 150,
            render: (value: string, _row: any, index: number) => (
              <Space size={8}>
                <span className="muted">{(pagination.current - 1) * pagination.pageSize + index + 1}</span>
                <span>{value}</span>
              </Space>
            )
          },
          { title: "学号/工号", width: 150, render: (_: unknown, row: any) => row.studentNo ?? row.workNo ?? "-" },
          { title: "角色", width: 120, render: (_: unknown, row: any) => roleLabels[row.role?.code] },
          { title: "发展阶段", dataIndex: "developmentStage", width: 150, render: (value) => <Tag>{stageLabels[value]}</Tag> },
          {
            title: "操作",
            width: 180,
            render: (_: unknown, row: any) => (
              <Space>
                <Button size="small"><Link to={`/admin/members/${row.id}`}>详情</Link></Button>
                <Button size="small" onClick={() => { setEditing(row); form.setFieldsValue({ ...row, role: row.role?.code }); setOpen(true); }}>编辑</Button>
                {canDeleteMember(row) && (
                  <Popconfirm
                    title="确认删除该成员？"
                    description="删除后该账号将从成员列表移除并无法登录，历史积分和导入记录会保留用于追溯。"
                    okText="确定"
                    cancelText="取消"
                    onConfirm={() => deleteMember(row)}
                  >
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                )}
              </Space>
            )
          }
        ]}
      />

      <Modal title={editing ? "编辑成员" : "新增成员"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              if (editing) await api.put(`/users/${editing.id}`, values);
              else await api.post("/users", values);
              message.success("保存成功");
              setOpen(false);
              void reload();
            } catch (error) {
              message.error(error instanceof Error ? error.message : "保存失败");
            }
          }}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}><Input /></Form.Item>
          <Form.Item name="studentNo" label="学号"><Input /></Form.Item>
          <Form.Item name="workNo" label="工号"><Input /></Form.Item>
          <Form.Item name="password" label={editing ? "重置密码（不填则不修改）" : "初始密码"}><Input.Password placeholder={editing ? "留空则保持原密码" : "默认 123456"} /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="STUDENT">
            <Select options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="developmentStage" label="发展阶段" initialValue="ACTIVIST">
            <Select options={Object.entries(stageLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="batch" label="所属批次"><Input /></Form.Item>
          <Form.Item name="branch" label="所属支部"><Input /></Form.Item>
          <Form.Item name="dormitory" label="寝室号"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="批量导入成员" open={importOpen} onCancel={() => setImportOpen(false)} onOk={submitImport} confirmLoading={importing} okText="开始导入" destroyOnClose>
        <div className="page-stack compact">
          <div className="muted">支持字段：姓名、学号/工号、发展阶段、所属批次、所属支部、寝室号。普通学生默认密码为 123456。</div>
          <Upload beforeUpload={() => false} maxCount={1} fileList={fileList} onChange={({ fileList }) => setFileList(fileList)} accept=".xlsx,.xls" capture={undefined}>
            <Button icon={<FileSpreadsheet size={16} />}>选择成员 Excel</Button>
          </Upload>
        </div>
      </Modal>
    </div>
  );
}
