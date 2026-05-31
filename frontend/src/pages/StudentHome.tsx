import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { activityTypeLabels, stageLabels } from "../api/types";

export default function StudentHome() {
  const [data, setData] = useState<any>();

  useEffect(() => {
    api.get("/dashboard/student").then(setData);
  }, []);

  return (
    <div className="page-stack">
      <Typography.Title level={2}>你好，{data?.profile?.name ?? "同学"}</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}><Card><Statistic title="我的积分" value={data?.totalPoints ?? 0} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="同批次排名" value={data?.batchRank ?? "-"} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="发展阶段" value={stageLabels[data?.profile?.developmentStage] ?? "-"} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="我的必参加活动">
            <List
              dataSource={data?.requiredActivities ?? []}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta title={<Link to={`/student/activities/${item.id}`}>{item.title}</Link>} description={`${dayjs(item.activityTime).format("YYYY-MM-DD HH:mm")} · ${item.location}`} />
                  <Tag color="volcano">必须参与</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近积分变化">
            <List
              dataSource={data?.recentPoints ?? []}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta title={<Tag color={item.pointsChange >= 0 ? "green" : "red"}>{item.pointsChange >= 0 ? `+${item.pointsChange}` : item.pointsChange}</Tag>} description={item.activity?.title ?? item.remark} />
                  <span className="muted">{dayjs(item.createdAt).format("MM-DD HH:mm")}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      <Card title="最新支部活动">
        <List
          grid={{ gutter: 16, xs: 1, md: 2, xl: 3 }}
          dataSource={data?.latestActivities ?? []}
          renderItem={(item: any) => (
            <List.Item>
              <Card title={<Link to={`/student/activities/${item.id}`}>{item.title}</Link>}>
                <p>{dayjs(item.activityTime).format("YYYY-MM-DD HH:mm")}</p>
                <p>{item.location}</p>
                <Tag color="red">{activityTypeLabels[item.type]}</Tag>
                {item.isRequired && <Tag color="volcano">必须参与</Tag>}
              </Card>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
