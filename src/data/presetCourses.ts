import { CoursePreset } from "../types";

export const PRESET_COURSES: CoursePreset[] = [
  {
    id: "econ-202",
    code: "ECON 202",
    title: "Macroeconomics: Stochastic Volatility & Liquidity Traps",
    professor: "Prof. Arthur Pendelton",
    department: "Department of Economics",
    initialSyllabus: `Course Overview: ECON 202 covers modern macroeconomic models in open economies, with special emphasis on quantitative easing, nominal interest rate zero-lower-bound constraints, stochastic volatility, liquidity traps, and fiscal multiplier efficacy. Required reading: Woodford (2003) Interest and Prices.`,
    initialGlossary: [
      {
        id: "term-1",
        term: "Zero Lower Bound (ZLB)",
        chinese: "零利率下限",
        phonetic: "/ˈzɪəroʊ ˈloʊər baʊnd/",
        definitionEn: "A macroeconomic problem where nominal interest rates cannot be driven below zero.",
        definitionZh: "央行名义利率无法降至零以下的经济学瓶颈，导致传统货币政策失灵。",
        category: "Monetary Policy",
        exampleEn: "At the Zero Lower Bound, central banks must resort to non-conventional monetary tools."
      },
      {
        id: "term-2",
        term: "Liquidity Trap",
        chinese: "流动性陷阱",
        phonetic: "/lɪˈkwɪdəti træp/",
        definitionEn: "A situation where injections of cash into the private banking system fail to decrease interest rates.",
        definitionZh: "当利率极低时，人们宁愿持有现金也不愿投资或消费，增发货币无法刺激需求。",
        category: "Core Concept",
        exampleEn: "In a liquidity trap, aggregate demand remains depressed despite monetary expansion."
      },
      {
        id: "term-3",
        term: "Stochastic Volatility",
        chinese: "随机波动率",
        phonetic: "/stəˈkæstɪk ˌvɒləˈtɪlɪti/",
        definitionEn: "A statistical model where the variance of a financial parameter is randomly distributed.",
        definitionZh: "将资产回报率或经济指标的波动性视作非恒定、随机变化的统计建模方法。",
        category: "Quantitative Method",
        exampleEn: "Stochastic volatility accounts for sudden market shocks during financial crises."
      },
      {
        id: "term-4",
        term: "Fiscal Multiplier",
        chinese: "财政乘数",
        phonetic: "/ˈfɪskl ˈmʌltɪplaɪər/",
        definitionEn: "The ratio of a change in national income to the change in government spending that brought it about.",
        definitionZh: "政府支出每变动一个单位所引起的国民收入变动倍数。",
        category: "Macro Framework",
        exampleEn: "During deep recessions, the fiscal multiplier can exceed 1.5."
      }
    ],
    simulatedAudioScript: [
      {
        seconds: 5,
        timestamp: "00:05",
        textEn: "Good morning everyone. Today we are diving into advanced monetary theory, specifically focusing on what happens when conventional monetary policy hits the zero lower bound.",
        chineseSummary: "今天课程探讨当传统货币政策触及“零利率下限(ZLB)”时的宏观理论。",
        difficulty: 2,
        detectedTerms: [
          {
            term: "Zero Lower Bound (ZLB)",
            chinese: "零利率下限",
            definitionZh: "名义利率无法进一步下调的政策界限。"
          }
        ]
      },
      {
        seconds: 15,
        timestamp: "00:15",
        textEn: "When nominal interest rates approach zero percent, the central bank loses its primary lever for stimulating aggregate demand. This leads directly into a classic liquidity trap.",
        chineseSummary: "名义利率逼近0%时，央行失去刺激总需求的主工具，直接陷入“流动性陷阱”。",
        difficulty: 3,
        detectedTerms: [
          {
            term: "Liquidity Trap",
            chinese: "流动性陷阱",
            definitionZh: "货币政策注入资金但无法降低利率或刺激需求的困境。"
          }
        ]
      },
      {
        seconds: 28,
        timestamp: "00:28",
        textEn: "Notice that in Keynesian synthesis models, private economic agents hoard liquid cash reserves because the opportunity cost of holding cash becomes effectively zero.",
        chineseSummary: "在凯恩斯模型中，因持现机会成本为零，私人机构和个人会大量囤积现金。",
        difficulty: 3,
        detectedTerms: []
      },
      {
        seconds: 42,
        timestamp: "00:42",
        textEn: "Now let's introduce stochastic volatility into our dynamic stochastic general equilibrium equations. How does market uncertainty amplify the risk of protracted recession?",
        chineseSummary: "将“随机波动率”引入DSGE方程，分析市场不确定性如何放大衰退风险。",
        difficulty: 5,
        detectedTerms: [
          {
            term: "Stochastic Volatility",
            chinese: "随机波动率",
            definitionZh: "波动率随随机过程变化的统计性质。"
          }
        ]
      },
      {
        seconds: 58,
        timestamp: "00:58",
        textEn: "When variance itself is a random variable, forward guidance by the Federal Reserve becomes far less deterministic than classical models predict.",
        chineseSummary: "若方差本身也是随机变量，美联储的前瞻性指引效果将远低于经典预估。",
        difficulty: 4,
        detectedTerms: []
      },
      {
        seconds: 75,
        timestamp: "01:15",
        textEn: "Consequently, the fiscal multiplier rises sharply. Government expenditure under ZLB conditions produces a significantly larger GDP push than during normal expansionary phases.",
        chineseSummary: "结果是“财政乘数”大幅上升，零利率下政府支出对GDP的拉动远高于平时。",
        difficulty: 4,
        detectedTerms: [
          {
            term: "Fiscal Multiplier",
            chinese: "财政乘数",
            definitionZh: "政府每支出1美元所能带动的宏观GDP增量。"
          }
        ]
      }
    ]
  },
  {
    id: "cs-106b",
    code: "CS 106B",
    title: "Algorithms & Data Structures: Dynamic Programming & Bellman Equation",
    professor: "Prof. Elena Rostova",
    department: "Department of Computer Science",
    initialSyllabus: `CS 106B covers core algorithmic paradigms: recursion, memoization, dynamic programming, DAG shortest path, Bellman-Ford, optimal substructure, and overlapping subproblems.`,
    initialGlossary: [
      {
        id: "cs-1",
        term: "Optimal Substructure",
        chinese: "最优子结构",
        phonetic: "/ˈɒptɪml ˈsʌbstrʌktʃər/",
        definitionEn: "A property where an optimal solution can be constructed from optimal solutions of its subproblems.",
        definitionZh: "问题的最优解包含其子问题的最优解，是动态规划的核心前提。",
        category: "Algorithm Property"
      },
      {
        id: "cs-2",
        term: "Memoization",
        chinese: "记忆化搜索",
        phonetic: "/ˌmɛmoʊɪˈzeɪʃən/",
        definitionEn: "An optimization technique that stores the results of expensive function calls.",
        definitionZh: "将递归过程中已计算过的重叠子问题结果缓存起来，避免重复计算。",
        category: "Optimization Technique"
      },
      {
        id: "cs-3",
        term: "Bellman Equation",
        chinese: "贝尔曼方程",
        phonetic: "/ˈbɛlmən ɪˈkweɪʒən/",
        definitionEn: "A mathematical relationship that expresses the value of a decision state in terms of immediate reward and discounted future value.",
        definitionZh: "将决策状态值拆解为当前即时收益与未来状态折现值之和的统领方程。",
        category: "Math Framework"
      }
    ],
    simulatedAudioScript: [
      {
        seconds: 5,
        timestamp: "00:05",
        textEn: "Welcome back. Today we transition from naive recursion to Dynamic Programming. The key idea is breaking down a problem into overlapping subproblems.",
        chineseSummary: "今天从朴素递归转向动态规划(DP)，核心是将问题拆解为重叠子问题。",
        difficulty: 2,
        detectedTerms: []
      },
      {
        seconds: 18,
        timestamp: "00:18",
        textEn: "Without memoization, computing the 50th Fibonacci number takes exponential time, roughly O of 2 to the Nth power. But caching values reduces complexity to linear O of N.",
        chineseSummary: "不用“记忆化(Memoization)”，求第50个斐波那契数需要指数级时间O(2^n)；记忆化后降至线性O(n)。",
        difficulty: 3,
        detectedTerms: [
          {
            term: "Memoization",
            chinese: "记忆化搜索",
            definitionZh: "把已计算结果暂存内存，下次直接调取的优化手段。"
          }
        ]
      },
      {
        seconds: 35,
        timestamp: "00:35",
        textEn: "For Dynamic Programming to apply, the problem must exhibit optimal substructure. This means the overall global optimum is recursively built from local subproblem optima.",
        chineseSummary: "适用DP的关键是具备“最优子结构”：全局最优解由子问题的局部最优解推导得出。",
        difficulty: 4,
        detectedTerms: [
          {
            term: "Optimal Substructure",
            chinese: "最优子结构",
            definitionZh: "子问题的最优解能递推组合出原问题的最优解。"
          }
        ]
      },
      {
        seconds: 52,
        timestamp: "00:52",
        textEn: "In reinforcement learning and graph optimization, this recurrence is formalized by the Bellman Equation, balancing current cost against expected future cost.",
        chineseSummary: "在图优化与强化学习中，这种递推归纳为“贝尔曼方程”，权衡当前开销与未来预期开销。",
        difficulty: 5,
        detectedTerms: [
          {
            term: "Bellman Equation",
            chinese: "贝尔曼方程",
            definitionZh: "动态规划与强化学习中定义状态价值递归关系的方程。"
          }
        ]
      }
    ]
  },
  {
    id: "bio-201",
    code: "BIO 201",
    title: "Molecular Biology: Cellular Respiration & ATP Synthase",
    professor: "Prof. Marcus Thorne",
    department: "Department of Biological Sciences",
    initialSyllabus: `BIO 201 explores mitochondrial bioenergetics, oxidative phosphorylation, chemiosmosis, proton gradient dynamics, and ATP synthase rotary mechanism.`,
    initialGlossary: [
      {
        id: "bio-1",
        term: "Oxidative Phosphorylation",
        chinese: "氧化磷酸化",
        phonetic: "/ˈɒksɪdətɪv ˌfɒsfərɪˈleɪʃən/",
        definitionEn: "The metabolic pathway in which cells use enzymes to oxidize nutrients, thereby releasing energy which is used to produce ATP.",
        definitionZh: "细胞在线粒体内通过电子传递链氧化营养物质并合成ATP的能量转化途径。",
        category: "Biochemical Pathway"
      },
      {
        id: "bio-2",
        term: "Chemiosmosis",
        chinese: "化学渗透",
        phonetic: "/ˌkɛmiɒsˈmoʊsɪs/",
        definitionEn: "The movement of ions across a semipermeable membrane bound structure, down their electrochemical gradient.",
        definitionZh: "质子穿过线粒体内膜顺电化学梯度扩散，驱动ATP合成酶旋转生能的过程。",
        category: "Cellular Mechanism"
      }
    ],
    simulatedAudioScript: [
      {
        seconds: 5,
        timestamp: "00:05",
        textEn: "Today we examine how mitochondria generate the cellular energy currency, ATP, through oxidative phosphorylation.",
        chineseSummary: "今天学习线粒体如何通过“氧化磷酸化”产生细胞能量通用货币ATP。",
        difficulty: 2,
        detectedTerms: [
          {
            term: "Oxidative Phosphorylation",
            chinese: "氧化磷酸化",
            definitionZh: "利用营养物质氧化释放的能量把ADP合成ATP的过程。"
          }
        ]
      },
      {
        seconds: 22,
        timestamp: "00:22",
        textEn: "The electron transport chain pumps protons across the inner mitochondrial membrane into the intermembrane space, building a steep electrochemical gradient.",
        chineseSummary: "电子传递链将质子泵入膜间隙，建立起跨膜电化学浓度梯度。",
        difficulty: 4,
        detectedTerms: []
      },
      {
        seconds: 40,
        timestamp: "00:40",
        textEn: "This proton motive force drives protons back into the matrix through ATP synthase via chemiosmosis, rotating the molecular rotor to condense ADP and phosphate.",
        chineseSummary: "“质子动力势”通过“化学渗透(Chemiosmosis)”驱使质子流经ATP合成酶，转动分子马达合成ATP。",
        difficulty: 5,
        detectedTerms: [
          {
            term: "Chemiosmosis",
            chinese: "化学渗透",
            definitionZh: "质子顺电化学梯度流过跨膜通道带动ATP生成的物理化学过程。"
          }
        ]
      }
    ]
  }
];
