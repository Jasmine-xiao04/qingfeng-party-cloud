import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient, RoleCode, DevelopmentStage, ActivityType, HonorType } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { code: RoleCode.SECRETARY },
      update: {},
      create: { code: RoleCode.SECRETARY, name: "党支部书记/老师", description: "系统最高权限" }
    }),
    prisma.role.upsert({
      where: { code: RoleCode.ASSISTANT },
      update: {},
      create: { code: RoleCode.ASSISTANT, name: "支部助理", description: "日常管理执行角色" }
    }),
    prisma.role.upsert({
      where: { code: RoleCode.STUDENT },
      update: {},
      create: { code: RoleCode.STUDENT, name: "普通学生/党性分子", description: "学生查看角色" }
    })
  ]);

  const roleByCode = Object.fromEntries(roles.map((role) => [role.code, role]));
  const passwordHash = await bcrypt.hash("Qingfeng@123", 10);

  const secretary = await prisma.user.upsert({
    where: { email: "teacher@qingfeng.local" },
    update: {},
    create: {
      name: "张老师",
      workNo: "T0001",
      email: "teacher@qingfeng.local",
      phone: "13800000001",
      passwordHash,
      roleId: roleByCode.SECRETARY.id,
      developmentStage: DevelopmentStage.FULL_MEMBER,
      branch: "学生第一党支部"
    }
  });

  const assistant = await prisma.user.upsert({
    where: { studentNo: "20230000" },
    update: {},
    create: {
      name: "支部助理",
      studentNo: "20230000",
      email: "assistant@qingfeng.local",
      phone: "13800000002",
      passwordHash,
      roleId: roleByCode.ASSISTANT.id,
      developmentStage: DevelopmentStage.PROBATIONARY_MEMBER,
      batch: "2023级",
      branch: "学生第一党支部",
      dormitory: "A1-301"
    }
  });

  const students = await Promise.all(
    [
      ["李明", "20230001", DevelopmentStage.ACTIVIST, "2023级", "A1-302"],
      ["王晓雨", "20230002", DevelopmentStage.DEVELOPMENT_OBJECT, "2023级", "A1-303"],
      ["陈晨", "20240001", DevelopmentStage.ACTIVIST, "2024级", "B2-401"],
      ["赵一帆", "20240002", DevelopmentStage.PROBATIONARY_MEMBER, "2024级", "B2-402"]
    ].map(([name, studentNo, stage, batch, dormitory]) =>
      prisma.user.upsert({
        where: { studentNo: studentNo as string },
        update: {},
        create: {
          name: name as string,
          studentNo: studentNo as string,
          passwordHash,
          roleId: roleByCode.STUDENT.id,
          developmentStage: stage as DevelopmentStage,
          batch: batch as string,
          branch: "学生第一党支部",
          dormitory: dormitory as string
        }
      })
    )
  );

  const activity = await prisma.activity.upsert({
    where: { id: "seed-theme-party-day" },
    update: {},
    create: {
      id: "seed-theme-party-day",
      title: "五月主题党日学习",
      activityTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      location: "党建活动室 204",
      type: ActivityType.THEME_PARTY_DAY,
      description: "围绕最新理论学习材料开展集中学习与交流。",
      signupLink: "https://example.com/signup",
      isRequired: true,
      requiredStages: [DevelopmentStage.ACTIVIST, DevelopmentStage.DEVELOPMENT_OBJECT],
      allowedStages: [DevelopmentStage.ACTIVIST, DevelopmentStage.DEVELOPMENT_OBJECT, DevelopmentStage.PROBATIONARY_MEMBER],
      basePoints: 2,
      publisherId: secretary.id
    }
  });

  for (const [index, student] of students.entries()) {
    const existed = await prisma.pointsRecord.findFirst({ where: { userId: student.id, type: "HISTORY_IMPORT" } });
    if (!existed) {
      await prisma.pointsRecord.create({
        data: {
          userId: student.id,
          activityId: activity.id,
          pointsChange: 5 + index,
          type: "HISTORY_IMPORT",
          remark: "种子数据：历史积分导入",
          operatorId: secretary.id
        }
      });
    }
  }

  await prisma.honor.upsert({
    where: { id: "seed-honor-story" },
    update: {},
    create: {
      id: "seed-honor-story",
      title: "优秀党性分子风采展示",
      type: HonorType.EXCELLENT_ACTIVIST,
      content: "以真实行动服务同学，在理论学习、志愿服务和支部建设中发挥示范作用。",
      publisherId: assistant.id,
      isPinned: true,
      publishedAt: new Date()
    }
  });

  console.log("Seed completed. Test password: Qingfeng@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
