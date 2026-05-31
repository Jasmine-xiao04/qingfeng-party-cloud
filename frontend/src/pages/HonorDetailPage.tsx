import { Button, Card, Descriptions, Image, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { honorTypeLabels } from "../api/types";

export default function HonorDetailPage({ readonly = false }: { readonly?: boolean }) {
  const { id } = useParams();
  const [data, setData] = useState<any>();

  useEffect(() => {
    if (id) api.get<never, any>(`/honors/${id}`).then(setData);
  }, [id]);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>荣誉详情</h1>
        <Button><Link to={readonly ? "/student/honors" : "/admin/honors"}>返回荣誉列表</Link></Button>
      </div>
      <Card>
        {data?.coverUrl && <Image className="detail-cover" src={data.coverUrl} alt={data.title} preview={false} />}
        <Space wrap className="mb-16">
          <Tag color="red">{honorTypeLabels[data?.type] ?? "-"}</Tag>
          {data?.isPinned && <Tag color="volcano">置顶</Tag>}
          <Tag>{data?.status === "PUBLISHED" ? "已发布" : data?.status === "DRAFT" ? "草稿" : "已隐藏"}</Tag>
        </Space>
        <Typography.Title level={2}>{data?.title ?? "-"}</Typography.Title>
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="发布人">{data?.publisher?.name ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="发布时间">{data?.publishedAt ? dayjs(data.publishedAt).format("YYYY-MM-DD HH:mm") : "-"}</Descriptions.Item>
          <Descriptions.Item label="关联寝室">{data?.relatedDormitory ?? "-"}</Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph className="article-content">{data?.content ?? "-"}</Typography.Paragraph>
      </Card>
    </div>
  );
}
