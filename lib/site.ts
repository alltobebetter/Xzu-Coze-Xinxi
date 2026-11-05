export const SITE = {
  event: '第十二届信息技术文化节',
  track: '扣子（Coze）智能体设计大赛',
  theme: '智体赋能 · 文化共生',
  themeSub: '以 Coze 构建藏汉服务新场景',
  college: '西藏大学信息科学技术学院',
  committee: '共青团西藏大学信息科学技术学院委员会',
  organizer: '电子爱好者协会竞赛工作组',
  contact: {
    name: '石旭乔',
    phone: '17701619924',
    qq: '3036372843',
    group: '1091697273',
  },
  deadline: process.env.NEXT_PUBLIC_DEADLINE || null,
} as const;
