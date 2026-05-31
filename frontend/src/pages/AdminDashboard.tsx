import { Alert, Card, Col, List, Row, Skeleton, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { activityTypeLabels, stageLabels } from "../api/types";

export default function AdminDashboard() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get("/dashboard/admin")
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError("");
      })
      .catch((error) => {
        if (!alive) return;
        setError(error instanceof Error ? error.message : "数据看板加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const stats = [
    ["支部成员", data?.membersTotal ?? 0],
    ["活动总数", data?.activitiesTotal ?? 0],
    ["本月活动", data?.monthlyActivities ?? 0],
    ["本月参与人次", data?.monthlyParticipants ?? 0]
  ];

  return (
    <div className="page-stack">
      <Typography.Title level={2}>数据看板</Typography.Title>
      {error && !data && <Alert type="error" showIcon message="数据看板加载失败" description={error} />}
      {loading && <Skeleton active paragraph={{ rows: 8 }} />}
      <Row gutter={[16, 16]}>
        {stats.map(([label, value]) => (
          <Col xs={12} lg={6} key={label}>
            <Card><Statistic title={label} value={value as number} /></Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="积分排行榜 Top 10">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={data?.top10 ?? []}
              columns={[
                { title: "排名", dataIndex: "rank", width: 70 },
                { title: "姓名", dataIndex: "name", render: (value, row: any) => <Link to={`/admin/members/${row.id}`}>{value}</Link> },
                { title: "批次", dataIndex: "batch" },
                { title: "积分", dataIndex: "totalPoints" }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="阶段人数">
            <Row gutter={[12, 12]}>
              {Object.entries(stageLabels).map(([key, label]) => (
                <Col span={12} key={key}>
                  <Statistic title={label} value={data?.stages?.[key] ?? 0} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="最近活动">
            <List
              dataSource={data?.recentActivities ?? []}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Link to={`/admin/activities/${item.id}`}>{item.title}</Link>}
                    description={`${dayjs(item.activityTime).format("YYYY-MM-DD HH:mm")} · ${item.location}`}
                  />
                  <Tag color="red">{activityTypeLabels[item.type]}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近积分变动">
            <List
              dataSource={data?.recentPoints ?? []}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta title={`${item.user?.name} ${item.pointsChange > 0 ? "+" : ""}${item.pointsChange}`} description={item.activity?.title ?? item.remark} />
                  <span className="muted">{dayjs(item.createdAt).format("MM-DD HH:mm")}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
