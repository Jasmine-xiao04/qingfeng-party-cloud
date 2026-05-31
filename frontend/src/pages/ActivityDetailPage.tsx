import { Button, Card, Descriptions, Space, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { ExternalLink, FileSpreadsheet } from "lucide-react";
import { api } from "../api/client";
import { activityTypeLabels, pointTypeLabels, stageLabels } from "../api/types";

export default function ActivityDetailPage({ readonly = false }: { readonly?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>();

  useEffect(() => {
    if (id) api.get<never, any>(`/activities/${id}`).then(setData);
  }, [id]);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>活动详情</h1>
        <Space wrap>
          {!readonly && id && (
            <Button type="primary" icon={<FileSpreadsheet size={16} />} onClick={() => navigate(`/admin/import/activity?activityId=${id}`)}>
              导入名单
            </Button>
          )}
          <Button><Link to={readonly ? "/student/activities" : "/admin/activities"}>返回活动列表</Link></Button>
        </Space>
      </div>

      <Card title={data?.title ?? "活动详情"}>
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="活动时间">{data?.activityTime ? dayjs(data.activityTime).format("YYYY-MM-DD HH:mm") : "-"}</Descriptions.Item>
          <Descriptions.Item label="活动地点">{data?.location ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="活动类型"><Tag color="red">{activityTypeLabels[data?.type] ?? "-"}</Tag></Descriptions.Item>
          <Descriptions.Item label="基础积分">{data?.basePoints ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="参与要求">
            <Space wrap>
              <Tag color={data?.isRequired ? "volcano" : "blue"}>{data?.isRequired ? "必须参与" : "自愿参与"}</Tag>
              {data?.requiredStages?.map((stage: string) => <Tag key={stage}>{stageLabels[stage]}</Tag>)}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="发布人">{data?.publisher?.name ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="报名链接" span={2}>
            {data?.signupLink ? (
              <Button type="primary" icon={<ExternalLink size={15} />} href={data.signupLink} target="_blank" rel="noreferrer">
                点击报名
              </Button>
            ) : (
              "暂无报名链接"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="活动说明" span={2}>{data?.description ?? "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      {!readonly && (
        <>
          <Card title={`参与人员（${data?.participants?.length ?? 0} 人）`}>
            <Table
              rowKey="id"
              dataSource={data?.participants ?? []}
              scroll={{ x: 760 }}
              columns={[
                { title: "姓名", render: (_: unknown, row: any) => row.user?.name ?? "-" },
                { title: "学号", render: (_: unknown, row: any) => row.user?.studentNo ?? "-" },
                { title: "发展阶段", render: (_: unknown, row: any) => stageLabels[row.user?.developmentStage] ?? "-" },
                { title: "批次", render: (_: unknown, row: any) => row.user?.batch ?? "-" },
                { title: "获得积分", dataIndex: "points" },
                { title: "签到状态", dataIndex: "checkinStatus" },
                { title: "备注", dataIndex: "remark" }
              ]}
            />
          </Card>

          <Card title="该活动产生的积分流水">
            <Table
              rowKey="id"
              dataSource={data?.pointRecords ?? []}
              scroll={{ x: 760 }}
              columns={[
                { title: "成员", render: (_: unknown, row: any) => `${row.user?.name ?? ""} ${row.user?.studentNo ?? ""}` },
                { title: "积分变化", dataIndex: "pointsChange", render: (value) => <Tag color={value >= 0 ? "green" : "red"}>{value >= 0 ? `+${value}` : value}</Tag> },
                { title: "类型", dataIndex: "type", render: (value) => pointTypeLabels[value] ?? value },
                { title: "备注", dataIndex: "remark" },
                { title: "时间", dataIndex: "createdAt", render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm") }
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
