import { Button, Card, Select, Space, Table, Tag } from "antd";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useCachedQuery } from "../api/useCachedQuery";
import { stageLabels } from "../api/types";

export default function RankingsPage({ student = false }: { student?: boolean }) {
  const [scope, setScope] = useState(student ? "myBatch" : "all");
  const queryUrl = useMemo(() => {
    const query = scope === "all" ? "" : `?scope=${scope}`;
    return `/rankings${query}`;
  }, [scope]);
  const { data, loading, refreshing, reload } = useCachedQuery<any[]>(queryUrl);
  const rows = data ?? [];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{student ? "我的排名" : "积分排行榜"}</h1>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} loading={refreshing && rows.length > 0} onClick={() => reload()}>刷新</Button>
          <Select
            value={scope}
            style={{ width: 180 }}
            onChange={setScope}
            options={[
              { value: "all", label: "全部排行" },
              { value: "myBatch", label: "同批次排行" },
              { value: "myStage", label: "同阶段排行" }
            ]}
          />
        </Space>
      </div>
      <Card className="table-card-centered">
        <Table
          rowKey="id"
          dataSource={rows}
          loading={loading || refreshing}
          scroll={{ x: 760 }}
          columns={[
            { title: "排名", dataIndex: "rank", width: 90 },
            { title: "姓名", dataIndex: "name", width: 140 },
            { title: "学号", dataIndex: "studentNo", width: 160 },
            { title: "发展阶段", dataIndex: "developmentStage", width: 160, render: (value) => <Tag>{stageLabels[value]}</Tag> },
            { title: "总积分", dataIndex: "totalPoints", width: 120, sorter: (a, b) => a.totalPoints - b.totalPoints }
          ]}
        />
      </Card>
    </div>
  );
}
