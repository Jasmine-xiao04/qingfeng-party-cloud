import { Button, Card, Col, Descriptions, Row, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { pointTypeLabels, roleLabels, stageLabels } from "../api/types";

export default function MemberDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>();

  useEffect(() => {
    if (id) api.get<never, any>(`/users/${id}`).then(setData);
  }, [id]);

  const total = useMemo(
    () => data?.pointRecords?.reduce((sum: number, item: any) => sum + Number(item.pointsChange ?? 0), 0) ?? 0,
    [data]
  );

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>成员详情</h1>
        <Button><Link to="/admin/members">返回成员管理</Link></Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card>
            <div className="profile-summary">
              <div className="profile-avatar">{data?.name?.slice(0, 1) ?? "-"}</div>
              <h2>{data?.name ?? "-"}</h2>
              <Tag color="red">{roleLabels[data?.role?.code] ?? "-"}</Tag>
              <div className="score-number">{total}</div>
              <span className="muted">当前总积分</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="基础信息">
            <Descriptions column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="学号/工号">{data?.studentNo ?? data?.workNo ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="发展阶段">{stageLabels[data?.developmentStage] ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="所属批次">{data?.batch ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="所属支部">{data?.branch ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="寝室号">{data?.dormitory ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="账号状态">{data?.status === "ACTIVE" ? "正常" : "停用"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="积分流水">
        <Table
          rowKey="id"
          dataSource={data?.pointRecords ?? []}
          scroll={{ x: 860 }}
          columns={[
            { title: "积分变化", dataIndex: "pointsChange", render: (value) => <Tag color={value >= 0 ? "green" : "red"}>{value >= 0 ? `+${value}` : value}</Tag> },
            { title: "类型", dataIndex: "type", render: (value) => pointTypeLabels[value] ?? value },
            { title: "关联活动", render: (_: unknown, row: any) => row.activity?.title ?? "-" },
            { title: "备注", dataIndex: "remark" },
            { title: "操作人", render: (_: unknown, row: any) => row.operator?.name ?? "-" },
            { title: "时间", dataIndex: "createdAt", render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm") }
          ]}
        />
      </Card>

      <Card title="活动参与记录">
        <Table
          rowKey="id"
          dataSource={data?.participations ?? []}
          scroll={{ x: 760 }}
          columns={[
            { title: "活动名称", render: (_: unknown, row: any) => row.activity?.title ?? "-" },
            { title: "时间", render: (_: unknown, row: any) => row.activity?.activityTime ? dayjs(row.activity.activityTime).format("YYYY-MM-DD HH:mm") : "-" },
            { title: "获得积分", dataIndex: "points" },
            { title: "签到状态", dataIndex: "checkinStatus" },
            { title: "备注", dataIndex: "remark" }
          ]}
        />
      </Card>
    </div>
  );
}
