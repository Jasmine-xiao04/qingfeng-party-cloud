import { Button, Card, Col, Form, Image, Input, Modal, Popconfirm, Row, Select, Space, Switch, Tag, message } from "antd";
import { Link } from "react-router-dom";
import { Pin, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useCachedQuery } from "../api/useCachedQuery";
import { honorTypeLabels } from "../api/types";
import { useState } from "react";

export default function HonorsPage({ readonly = false }: { readonly?: boolean }) {
  const queryUrl = `/honors${readonly ? "" : "?admin=true"}`;
  const { data, setData, loading, refreshing, reload } = useCachedQuery<any[]>(queryUrl);
  const rows = data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const save = async (values: any) => {
    const payload = { ...values, status: values.status ?? "PUBLISHED" };
    if (editing) await api.put(`/honors/${editing.id}`, payload);
    else await api.post("/honors", payload);
    message.success("保存成功");
    setOpen(false);
    void reload();
  };

  const togglePinned = async (item: any) => {
    await api.put(`/honors/${item.id}`, { isPinned: !item.isPinned });
    setData(rows.map((row) => row.id === item.id ? { ...row, isPinned: !row.isPinned } : row));
    message.success(item.isPinned ? "已取消置顶" : "已置顶");
    void reload();
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{readonly ? "荣誉展示" : "荣誉管理"}</h1>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} loading={refreshing && rows.length > 0} onClick={() => reload()}>刷新</Button>
          {!readonly && <Button type="primary" icon={<Plus size={16} />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ type: "EXCELLENT_ACTIVIST", status: "PUBLISHED", isPinned: false }); setOpen(true); }}>新增荣誉</Button>}
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        {rows.map((item) => (
          <Col xs={24} sm={12} xl={8} key={item.id}>
            <Card
              loading={loading && rows.length === 0}
              className="honor-card"
              cover={item.coverUrl ? <Image className="honor-cover" src={item.coverUrl} alt={item.title} preview={false} /> : <div className="honor-cover placeholder">青锋党建云</div>}
              title={<Link to={readonly ? `/student/honors/${item.id}` : `/admin/honors/${item.id}`}>{item.title}</Link>}
              extra={<Tag color={item.isPinned ? "red" : "default"}>{honorTypeLabels[item.type]}</Tag>}
              actions={!readonly ? [
                <Button type="link" onClick={() => { setEditing(item); form.setFieldsValue(item); setOpen(true); }}>编辑</Button>,
                <Button type="link" icon={<Pin size={14} />} onClick={() => togglePinned(item)}>{item.isPinned ? "取消置顶" : "置顶"}</Button>,
                <Popconfirm
                  title="确认删除该荣誉内容？"
                  onConfirm={async () => {
                    await api.delete(`/honors/${item.id}`);
                    setData(rows.filter((row) => row.id !== item.id));
                    message.success("删除成功");
                    void reload();
                  }}
                >
                  <Button type="link" danger icon={<Trash2 size={14} />}>删除</Button>
                </Popconfirm>
              ] : undefined}
            >
              <p className="line-clamp">{item.content}</p>
              <span className="muted">发布人：{item.publisher?.name ?? "-"}</span>
            </Card>
          </Col>
        ))}
      </Row>
      <Modal title={editing ? "编辑荣誉" : "新增荣誉"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} width={720} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await save(values);
            } catch (error) {
              message.error(error instanceof Error ? error.message : "保存失败");
            }
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="EXCELLENT_ACTIVIST"><Select options={Object.entries(honorTypeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="coverUrl" label="封面图片链接"><Input placeholder="可填写图片 URL，后续也可接入本地上传" /></Form.Item>
          <Form.Item name="relatedDormitory" label="关联寝室"><Input /></Form.Item>
          <Form.Item name="status" label="展示状态" initialValue="PUBLISHED">
            <Select options={[
              { value: "PUBLISHED", label: "已发布" },
              { value: "DRAFT", label: "草稿" },
              { value: "HIDDEN", label: "隐藏" }
            ]} />
          </Form.Item>
          <Form.Item name="isPinned" label="是否置顶" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
          <Form.Item name="content" label="正文内容" rules={[{ required: true, message: "请输入正文内容" }]}><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
