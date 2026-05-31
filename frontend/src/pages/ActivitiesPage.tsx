import { Button, DatePicker, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Upload, message } from "antd";
import type { UploadFile } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { ExternalLink, FileText, FileSpreadsheet, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useCachedQuery } from "../api/useCachedQuery";
import { activityTypeLabels, stageLabels } from "../api/types";

export default function ActivitiesPage({ readonly = false }: { readonly?: boolean }) {
  const { data, setData, loading, refreshing, reload } = useCachedQuery<any[]>("/activities");
  const rows = data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [deletingId, setDeletingId] = useState("");
  const [wordFiles, setWordFiles] = useState<UploadFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const timeText = (value?: string | Date) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-");

  const openCreate = () => {
    setEditing(null);
    setWordFiles([]);
    form.resetFields();
    form.setFieldsValue({ type: "PARTY_CLASS", basePoints: 1, isRequired: false, requiredStages: [], allowedStages: [] });
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setWordFiles([]);
    form.setFieldsValue({
      ...row,
      activityTime: dayjs(row.activityTime),
      requiredStages: row.requiredStages ?? [],
      allowedStages: row.allowedStages ?? []
    });
    setOpen(true);
  };

  const parseWord = async () => {
    if (!wordFiles[0]?.originFileObj) return message.warning("请先选择 .docx 文件");
    const data = new FormData();
    data.append("file", wordFiles[0].originFileObj);
    setParsing(true);
    try {
      const parsed = await api.post<never, any>("/activities/parse-word", data, { headers: { "Content-Type": "multipart/form-data" } });
      form.setFieldsValue({
        title: parsed.title || form.getFieldValue("title"),
        location: parsed.location || form.getFieldValue("location"),
        type: parsed.type || form.getFieldValue("type"),
        isRequired: parsed.isRequired ?? form.getFieldValue("isRequired"),
        requiredStages: parsed.requiredStages?.length ? parsed.requiredStages : form.getFieldValue("requiredStages"),
        allowedStages: parsed.allowedStages?.length ? parsed.allowedStages : form.getFieldValue("allowedStages"),
        basePoints: parsed.basePoints ?? form.getFieldValue("basePoints"),
        signupLink: parsed.signupLink || form.getFieldValue("signupLink"),
        description: parsed.description || form.getFieldValue("description"),
        ...(parsed.activityTime && dayjs(parsed.activityTime).isValid() ? { activityTime: dayjs(parsed.activityTime).second(0).millisecond(0) } : {})
      });
      const missingLabels = Object.entries({
        title: "活动名称",
        activityTime: "活动时间",
        location: "活动地点",
        type: "活动类型",
        participation: "参与要求",
        basePoints: "基础积分",
        signupLink: "报名链接",
        description: "活动说明"
      })
        .filter(([key]) => parsed.missingFields?.[key])
        .map(([, label]) => label);
      if (missingLabels.length) {
        message.warning(`Word 解析完成，${missingLabels.join("、")}未识别，请手动补充`);
      } else {
        message.success("Word 解析完成，请检查并微调表单");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Word 解析失败");
    } finally {
      setParsing(false);
    }
  };

  const save = async (values: any) => {
    const activityTime = dayjs(values.activityTime).second(0).millisecond(0);
    const payload = {
      ...values,
      activityTime: activityTime.toISOString(),
      basePoints: Number(values.basePoints ?? 1),
      requiredStages: values.requiredStages ?? [],
      allowedStages: values.allowedStages ?? []
    };
    const saved = editing ? await api.put<never, any>(`/activities/${editing.id}`, payload) : await api.post<never, any>("/activities", payload);
    message.success("活动保存成功");
    setOpen(false);
    void reload();
    return saved;
  };

  const deleteActivity = async (row: any) => {
    setDeletingId(row.id);
    try {
      await api.delete(`/activities/${row.id}`);
      setData(rows.filter((item) => item.id !== row.id));
      message.success("活动删除成功");
      void reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "活动删除失败");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{readonly ? "活动中心" : "活动管理"}</h1>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} loading={refreshing && rows.length > 0} onClick={() => reload()}>刷新</Button>
          {!readonly && <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>发布活动</Button>}
        </Space>
      </div>
      <Table
        rowKey="id"
        dataSource={rows}
        loading={loading || refreshing}
        scroll={{ x: 980 }}
        columns={[
          {
            title: "活动名称",
            dataIndex: "title",
            fixed: "left",
            width: 220,
            render: (value, row) =>
              readonly ? (
                <Button type="link" className="table-link-button" onClick={() => setDetail(row)}>
                  {value}
                </Button>
              ) : (
                <Link to={`/admin/activities/${row.id}`}>{value}</Link>
              )
          },
          { title: "时间", dataIndex: "activityTime", width: 170, render: (value) => timeText(value) },
          { title: "地点", dataIndex: "location", width: 150 },
          { title: "类型", dataIndex: "type", width: 120, render: (value) => <Tag color="red">{activityTypeLabels[value]}</Tag> },
          {
            title: "参与要求",
            width: 260,
            render: (_: unknown, row: any) => (
              <Space wrap>
                <Tag color={row.isRequired ? "volcano" : "blue"}>{row.isRequired ? "必须参与" : "自愿参与"}</Tag>
                {row.requiredStages?.map((stage: string) => <Tag key={stage}>{stageLabels[stage]}</Tag>)}
              </Space>
            )
          },
          { title: "基础积分", dataIndex: "basePoints", width: 100 },
          ...(!readonly
            ? [{
                title: "操作",
                width: 250,
                render: (_: unknown, row: any) => (
                  <Space>
                    <Button size="small"><Link to={`/admin/activities/${row.id}`}>详情</Link></Button>
                    <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
                    <Button size="small" type="primary" ghost icon={<FileSpreadsheet size={14} />} onClick={() => navigate(`/admin/import/activity?activityId=${row.id}`)}>
                      导入名单
                    </Button>
                    <Popconfirm
                      title="确定要删除该活动吗？"
                      description="仅允许删除尚未产生名单、积分流水和导入批次的测试活动；已有业务记录的活动请保留或编辑。"
                      okText="确认删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => deleteActivity(row)}
                    >
                      <Button size="small" danger loading={deletingId === row.id} icon={<Trash2 size={14} />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }]
            : [])
        ]}
        onRow={(record) => ({
          onClick: () => {
            if (readonly) setDetail(record);
          }
        })}
      />

      <Modal
        title={editing ? "编辑活动" : "发布活动"}
        open={open}
        onCancel={() => setOpen(false)}
        width={760}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="save" onClick={() => form.submit()}>保存</Button>,
          !editing && (
            <Button
              key="save-import"
              type="primary"
              onClick={async () => {
                try {
                  const values = await form.validateFields();
                  const saved = await save(values);
                  navigate(`/admin/import/activity?activityId=${saved.id}`);
                } catch (error) {
                  if (error instanceof Error) message.error(error.message);
                }
              }}
            >
              保存并导入名单
            </Button>
          )
        ]}
      >
        {!editing && (
          <div className="upload-strip">
            <Upload beforeUpload={() => false} maxCount={1} fileList={wordFiles} onChange={({ fileList }) => setWordFiles(fileList)} accept=".docx" capture={undefined}>
              <Button icon={<FileText size={16} />}>选择活动 Word</Button>
            </Upload>
            <Button loading={parsing} onClick={parseWord}>解析并填入表单</Button>
            <span className="muted">支持“活动名称、时间、地点、类型、参与要求、阶段、积分、报名链接、活动说明”等字段。</span>
          </div>
        )}
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
          <Form.Item name="title" label="活动名称" rules={[{ required: true, message: "请输入活动名称" }]}><Input /></Form.Item>
          <Form.Item name="activityTime" label="活动时间" rules={[{ required: true, message: "请选择活动时间" }]}>
            <DatePicker showTime={{ format: "HH:mm" }} format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="location" label="活动地点" rules={[{ required: true, message: "请输入活动地点" }]}><Input /></Form.Item>
          <Form.Item name="type" label="活动类型" initialValue="PARTY_CLASS"><Select options={Object.entries(activityTypeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="basePoints" label="基础积分" initialValue={1}><Input type="number" /></Form.Item>
          <Form.Item name="signupLink" label="报名链接"><Input /></Form.Item>
          <Form.Item name="isRequired" label="是否必须参与" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
          <Form.Item name="requiredStages" label="必须参与阶段"><Select mode="multiple" options={Object.entries(stageLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="allowedStages" label="可参与阶段"><Select mode="multiple" options={Object.entries(stageLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="description" label="活动说明"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detail?.title ?? "活动详情"}
        open={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
        width={720}
      >
        {detail && (
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="活动名称" span={2}>{detail.title}</Descriptions.Item>
            <Descriptions.Item label="活动时间">{timeText(detail.activityTime)}</Descriptions.Item>
            <Descriptions.Item label="活动地点">{detail.location ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="活动类型"><Tag color="red">{activityTypeLabels[detail.type] ?? "-"}</Tag></Descriptions.Item>
            <Descriptions.Item label="基础积分">{detail.basePoints ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="参与要求" span={2}>
              <Space wrap>
                <Tag color={detail.isRequired ? "volcano" : "blue"}>{detail.isRequired ? "必须参与" : "自愿参与"}</Tag>
                {detail.requiredStages?.length
                  ? detail.requiredStages.map((stage: string) => <Tag key={stage}>{stageLabels[stage]}</Tag>)
                  : <span className="muted">不限阶段</span>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="活动说明" span={2}>{detail.description || "暂无活动说明"}</Descriptions.Item>
            <Descriptions.Item label="报名链接" span={2}>
              {detail.signupLink ? (
                <Button
                  type="primary"
                  icon={<ExternalLink size={15} />}
                  href={detail.signupLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  点击报名
                </Button>
              ) : (
                "暂无报名链接"
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
