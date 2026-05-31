export type RoleCode = "SECRETARY" | "ASSISTANT" | "STUDENT";
export type DevelopmentStage = "ACTIVIST" | "DEVELOPMENT_OBJECT" | "PROBATIONARY_MEMBER" | "FULL_MEMBER";

export type CurrentUser = {
  id: string;
  name: string;
  role: RoleCode;
  studentNo?: string;
  workNo?: string;
  developmentStage?: DevelopmentStage;
  batch?: string;
  branch?: string;
  dormitory?: string;
};

export const stageLabels: Record<string, string> = {
  ACTIVIST: "入党积极分子",
  DEVELOPMENT_OBJECT: "发展对象",
  PROBATIONARY_MEMBER: "预备党员",
  FULL_MEMBER: "正式党员"
};

export const roleLabels: Record<string, string> = {
  SECRETARY: "书记/老师",
  ASSISTANT: "支部助理",
  STUDENT: "普通学生"
};

export const activityTypeLabels: Record<string, string> = {
  THEORY_STUDY: "理论学习",
  THEME_PARTY_DAY: "主题党日",
  VOLUNTEER_SERVICE: "志愿服务",
  BRANCH_MEETING: "支部大会",
  PARTY_CLASS: "党课培训",
  SOCIAL_PRACTICE: "社会实践",
  ORGANIZATION_LIFE: "组织生活会",
  OTHER: "其他"
};

export const honorTypeLabels: Record<string, string> = {
  EXCELLENT_MEMBER: "优秀党员",
  EXCELLENT_ACTIVIST: "优秀党性分子",
  MODEL_DORMITORY: "示范寝室",
  EXCELLENT_STORY: "优秀事迹",
  VOLUNTEER_STYLE: "志愿服务风采",
  PARTY_PROMOTION: "党建活动宣传"
};

export const pointTypeLabels: Record<string, string> = {
  ACTIVITY_ADD: "活动加分",
  ACTIVITY_DEDUCT: "活动扣分",
  HISTORY_IMPORT: "历史导入",
  ADMIN_ADJUST: "管理员调整"
};
