import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Result, Row, Select, Space, Statistic, Steps, Table, Tag, Upload, message } from "antd";
import type { UploadFile } from "antd";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import dayjs from "dayjs";
import { api } from "../api/client";

type ImportType = "activity" | "history";

type PreviewRecord = {
  id: string;
  rowNumber?: number | string;
  rawName: string;
  rawStudentNo: string;
  rawActivityName?: string;
  pointsChange?: number;
  remark?: string;
  matchStatus: "MATCHED" | "NOT_FOUND" | "DUPLICATED_NAME" | "ERROR";
  errorReason?: string;
  user?: {
    id: string;
    name: string;
    studentNo?: string;
    developmentStage?: string;
    batch?: string;
  } | null;
};

const statusMeta: Record<string, { label: string; color: string }> = {
  MATCHED: { label: "已匹配", color: "green" },
  NOT_FOUND: { label: "未匹配", color: "red" },
  DUPLICATED_NAME: { label: "重名待确认", color: "orange" },
  ERROR: { label: "异常", color: "red" }
};

function getDisplayStatus(record: PreviewRecord) {
  if (record.matchStatus === "ERROR" && record.errorReason?.includes("重复")) return { label: "重复记录", color: "volcano" };
  if (record.matchStatus === "ERROR" && record.errorReason?.includes("冲突")) return { label: "信息冲突", color: "magenta" };
  return statusMeta[record.matchStatus] ?? { label: record.matchStatus, color: "default" };
}

function isImportable(record: PreviewRecord) {
  return record.matchStatus === "MATCHED" && Boolean(record.user?.id);
}

export default function ImportPage({ type }: { type: ImportType }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [batchId, setBatchId] = useState("");
  const [activityInfo, setActivityInfo] = useState<any>(null);
  const [records, setRecords] = useState<PreviewRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const isActivity = type === "activity";

  const loadBatches = useCallback(() => {
    const batchType = isActivity ? "ACTIVITY_LIST" : "HISTORY_POINTS";
    api.get<never, any[]>(`/import/batches?type=${batchType}`).then(setBatches).catch(() => undefined);
  }, [isActivity]);

  useEffect(() => {
    if (!isActivity) {
      loadBatches();
      return;
    }

    api.get<never, any[]>("/activities").then((data) => {
      setActivities(data);
      const activityId = searchParams.get("activityId");
      if (activityId) {
        const selected = data.find((item) => item.id === activityId);
        form.setFieldsValue({ activityId, defaultPoints: selected?.basePoints });
      }
    });
    api.get<never, any[]>("/users").then(setMembers).catch(() => undefined);
    loadBatches();
  }, [form, isActivity, loadBatches, searchParams]);

  const computed = useMemo(() => {
    const matchedRecords = records.filter(isImportable);
    const abnormalRecords = records.filter((record) => !isImportable(record));
    return {
      total: records.length,
      matched: matchedRecords.length,
      failed: abnormalRecords.length,
      points: matchedRecords.reduce((sum, record) => sum + Number(record.pointsChange ?? 0), 0)
    };
  }, [records]);

  const resetPreview = () => {
    setBatchId("");
    setActivityInfo(null);
    setRecords([]);
    setSummary(null);
    setConfirmResult(null);
    setCurrent(0);
  };

  const updateRecord = (id: string, patch: Partial<PreviewRecord>) => {
    setRecords((prev) => prev.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  const removeRecord = (id: string) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const preview = async (values: any) => {
    if (!fileList[0]?.originFileObj) return message.warning("请先选择 Excel 文件");
    if (isActivity && !values.activityId) {
      return message.warning("请先在活动管理中发布活动，再选择对应活动导入名单");
    }

    const formData = new FormData();
    formData.append("file", fileList[0].originFileObj);
    Object.entries(values).forEach(([key, value]) => formData.append(key, String(value ?? "")));
    const url = isActivity ? "/import/activity-preview" : "/import/history-preview";

    setPreviewing(true);
    try {
      const data = await api.post<never, any>(url, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setBatchId(data.batchId);
      setActivityInfo(data.activity ?? null);
      setRecords(data.records ?? []);
      setSummary(data.summary ?? null);
      setConfirmResult(null);
      setCurrent(1);
      message.success("预览生成成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  const confirm = async () => {
    if (!batchId) return message.warning("请先生成导入预览");
    const importableRows = records.filter(isImportable);
    if (importableRows.length === 0) return message.warning("当前没有可导入的已匹配记录");

    setConfirming(true);
    try {
      const url = isActivity ? "/import/activity-confirm" : "/import/history-confirm";
      const payload = isActivity
        ? {
            batchId,
            records: importableRows.map((record) => ({
              id: record.id,
              userId: record.user?.id,
              rawName: record.rawName,
              rawStudentNo: record.rawStudentNo,
              pointsChange: record.pointsChange,
              remark: record.remark,
              matchStatus: "MATCHED"
            }))
          }
        : { batchId, createMissing: false };
      const data = await api.post<never, any>(url, payload);
      setConfirmResult(data);
      setCurrent(2);
      message.success(`导入完成，成功 ${data.imported ?? data.successCount ?? 0} 条`);
      loadBatches();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "确认导入失败");
    } finally {
      setConfirming(false);
    }
  };

  const confirmWithWarning = () => {
    if (computed.failed === 0) {
      void confirm();
      return;
    }
    Modal.confirm({
      title: "当前仍有未匹配或异常数据",
      content: "是否只导入已匹配记录？未匹配、冲突、重名和重复记录将被跳过。",
      okText: "只导入已匹配",
      cancelText: "返回处理",
      onOk: confirm
    });
  };

  const rollback = async (targetBatchId: string) => {
    try {
      const result = await api.post<never, any>(`/import/batches/${targetBatchId}/rollback`);
      message.success(`已回滚 ${result.rolledBack} 条积分流水`);
      loadBatches();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "回滚失败");
    }
  };

  const cancelPreviewBatch = async (targetBatchId: string) => {
    try {
      await api.delete(`/import/batches/${targetBatchId}`);
      message.success("已取消该预览批次");
      if (targetBatchId === batchId) resetPreview();
      loadBatches();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "取消预览失败");
    }
  };

  const memberOptions = members.map((member) => ({
    value: member.id,
    label: `${member.name} ${member.studentNo ?? ""}`,
    member
  }));

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{isActivity ? "Excel 活动名单导入" : "历史积分导入"}</h1>
        <Button onClick={resetPreview}>重新开始</Button>
      </div>
      <Steps current={current} items={[{ title: "上传文件" }, { title: "预览确认" }, { title: "导入完成" }]} />

      {current === 0 && (
        <Card>
          <Alert
            type="info"
            showIcon
            message={
              isActivity
                ? "支持字段：姓名、学生姓名、姓名（必填）、学号、学生学号、学号（必填）、积分变化、加分、分值、备注。若 Excel 没有积分变化，则使用默认积分。"
                : "支持字段：姓名、学号、历史积分、总积分、所属批次、发展阶段、备注。每名成员只能确认一次历史导入。"
            }
            className="mb-16"
          />
          <Form form={form} layout="vertical" onFinish={preview} initialValues={{ defaultPoints: 1 }}>
            {isActivity && (
              <>
                <Row gutter={16}>
                  <Col xs={24} lg={16}>
                    <Form.Item
                      name="activityId"
                      label="对应活动"
                      rules={[{ required: true, message: "请先选择对应活动" }]}
                      extra="请先在活动管理中发布活动，再选择对应活动导入名单。这样积分流水、参与记录和活动详情都能准确关联。"
                    >
                      <Select
                        showSearch
                        placeholder="请选择已发布活动"
                        optionFilterProp="label"
                        onChange={(activityId) => {
                          const selected = activities.find((item) => item.id === activityId);
                          form.setFieldsValue({ defaultPoints: selected?.basePoints ?? form.getFieldValue("defaultPoints") });
                        }}
                        options={activities.map((item) => ({ value: item.id, label: item.title }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} lg={8}>
                    <Form.Item name="defaultPoints" label="默认积分">
                      <InputNumber min={-20} max={20} step={0.5} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              fileList={fileList}
              onChange={({ fileList }) => {
                setFileList(fileList);
                resetPreview();
              }}
              accept=".xlsx,.xls"
              capture={undefined}
            >
              <Button icon={<UploadCloud size={16} />}>选择 Excel 文件</Button>
            </Upload>
            <div className="form-actions">
              <Button type="primary" htmlType="submit" loading={previewing}>生成导入预览</Button>
            </div>
          </Form>
        </Card>
      )}

      {records.length > 0 && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Card><Statistic title="总行数" value={summary?.total ?? computed.total} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="已匹配" value={computed.matched} valueStyle={{ color: "#067647" }} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="需处理" value={computed.failed} valueStyle={{ color: computed.failed ? "#b42318" : undefined }} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="预计积分" value={computed.points} precision={1} /></Card></Col>
          </Row>
          {activityInfo && (
            <Alert
              type="success"
              showIcon
              message={`本次导入活动：${activityInfo.title}`}
              description="预览阶段不会修改积分；确认导入后才会写入参与记录和积分流水。"
            />
          )}
          <Card
            title="导入预览"
            extra={<Button onClick={resetPreview}>返回上一步重新上传</Button>}
          >
            <Table
              rowKey="id"
              dataSource={records}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1280 }}
              columns={[
                { title: "原始行号", dataIndex: "rowNumber", width: 90 },
                {
                  title: "姓名",
                  dataIndex: "rawName",
                  width: 130,
                  render: (value, row) => <Input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => updateRecord(row.id, { rawName: event.target.value })} />
                },
                {
                  title: "学号",
                  dataIndex: "rawStudentNo",
                  width: 150,
                  render: (value, row) => <Input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => updateRecord(row.id, { rawStudentNo: event.target.value })} />
                },
                {
                  title: "系统成员",
                  width: 240,
                  render: (_, row) => (
                    <Select
                      showSearch
                      allowClear
                      value={row.user?.id}
                      placeholder="手动选择成员"
                      optionFilterProp="label"
                      style={{ width: "100%" }}
                      options={memberOptions}
                      onChange={(userId, option) => {
                        const selected = Array.isArray(option) ? undefined : option?.member;
                        updateRecord(row.id, {
                          user: selected ?? null,
                          rawName: selected?.name ?? row.rawName,
                          rawStudentNo: selected?.studentNo ?? row.rawStudentNo,
                          matchStatus: selected ? "MATCHED" : "NOT_FOUND",
                          errorReason: selected ? "" : "未匹配：请手动选择成员"
                        });
                      }}
                    />
                  )
                },
                { title: "活动名称", dataIndex: "rawActivityName", width: 180 },
                {
                  title: "积分变化",
                  dataIndex: "pointsChange",
                  width: 120,
                  render: (value, row) => (
                    <InputNumber
                      value={value}
                      step={0.5}
                      min={-20}
                      max={20}
                      style={{ width: "100%" }}
                      onChange={(next: number | string | null) => updateRecord(row.id, { pointsChange: Number(next ?? 0) })}
                    />
                  )
                },
                {
                  title: "备注",
                  dataIndex: "remark",
                  width: 180,
                  render: (value, row) => <Input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => updateRecord(row.id, { remark: event.target.value })} />
                },
                {
                  title: "识别状态",
                  width: 150,
                  render: (_, row) => {
                    const meta = getDisplayStatus(row);
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  }
                },
                { title: "异常原因", dataIndex: "errorReason", width: 260 },
                {
                  title: "操作",
                  fixed: "right",
                  width: 90,
                  render: (_, row) => (
                    <Button size="small" danger icon={<Trash2 size={14} />} onClick={() => removeRecord(row.id)}>
                      删除
                    </Button>
                  )
                }
              ]}
            />
            <Space wrap>
              <Button type="primary" disabled={!batchId || current === 2 || computed.matched === 0} loading={confirming} onClick={confirmWithWarning}>
                确认导入系统
              </Button>
              <Button disabled={!batchId || current === 2 || computed.matched === 0} loading={confirming} onClick={confirm}>
                只导入已匹配数据
              </Button>
              {computed.failed > 0 && <span className="muted">未匹配、冲突、重名和重复记录不会入库，可手动选择成员或删除行后再导入。</span>}
            </Space>
          </Card>
        </>
      )}

      {confirmResult && (
        <Card>
          <Result
            status="success"
            icon={<CheckCircle2 />}
            title="导入完成"
            subTitle={`成功导入 ${confirmResult.imported ?? confirmResult.successCount ?? 0} 人，跳过重复 ${confirmResult.skippedDuplicate ?? 0} 人，未匹配 ${confirmResult.unmatched ?? 0} 人，异常 ${confirmResult.abnormal ?? 0} 人，本次累计积分 ${confirmResult.totalPoints ?? 0}。`}
          />
        </Card>
      )}

      <Card title={isActivity ? "活动名单导入批次" : "历史导入批次"}>
        <Table
          rowKey="id"
          dataSource={batches}
          scroll={{ x: 900 }}
          columns={[
            { title: "关联活动", render: (_, row) => row.activity?.title ?? "-" },
            { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "CONFIRMED" ? "green" : value === "ROLLED_BACK" ? "default" : "blue"}>{value === "CONFIRMED" ? "已确认" : value === "ROLLED_BACK" ? "已回滚" : "预览中"}</Tag> },
            { title: "记录数", dataIndex: "recordsCount", width: 90 },
            { title: "已入库流水", dataIndex: "pointsCount", width: 110 },
            { title: "操作人", render: (_, row) => row.operator?.name ?? "-" },
            { title: "创建时间", dataIndex: "createdAt", render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm") },
            {
              title: "操作",
              width: 130,
              render: (_, row) => {
                if (row.status === "CONFIRMED") {
                  return (
                    <Popconfirm title="确认回滚该批积分？" description="回滚会删除该批次产生的积分流水和活动参与记录。" onConfirm={() => rollback(row.id)}>
                      <Button size="small" danger>回滚</Button>
                    </Popconfirm>
                  );
                }
                if (row.status === "PREVIEWED") {
                  return (
                    <Popconfirm title="取消该预览批次？" description="只会删除尚未确认的预览数据，不影响成员积分。" onConfirm={() => cancelPreviewBatch(row.id)}>
                      <Button size="small">取消预览</Button>
                    </Popconfirm>
                  );
                }
                return "-";
              }
            }
          ]}
        />
      </Card>
    </div>
  );
}
