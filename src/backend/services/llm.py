"""LLM 抽象层 — 统一接口，ChatGLM / Mock 双模式"""

import json
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List
from core.config import settings


@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str = ""
    tokens_used: int = 0


class BaseLLM(ABC):
    @abstractmethod
    async def chat(self, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        ...

    @abstractmethod
    async def health(self) -> bool:
        ...


class ChatGLMClient(BaseLLM):
    """通过 OpenAI 兼容 API 调用 ChatGLM"""

    def __init__(self, base_url: str = "", model: str = ""):
        self.base_url = base_url or settings.CHATGLM_API_URL
        self.model = model or settings.CHATGLM_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            import httpx  # 懒加载，Mock 模式不需要
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def chat(
        self, messages: List[LLMMessage],
        temperature: float = 0.7, max_tokens: int = 2048,
    ) -> LLMResponse:
        client = self._get_client()
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return LLMResponse(
                content=data["choices"][0]["message"]["content"],
                model=data.get("model", self.model),
                tokens_used=data.get("usage", {}).get("total_tokens", 0),
            )
        except Exception as e:
            raise RuntimeError(f"ChatGLM 调用失败: {e}")

    async def health(self) -> bool:
        try:
            client = self._get_client()
            resp = await client.get(f"{self.base_url}/v1/models")
            return resp.status_code == 200
        except Exception:
            return False


class MockLLM(BaseLLM):
    """本地 Mock — 根据 Agent 决策动态生成回复，不再机械循环"""

    # 按决策类型组织题库，每个策略有多个变体
    GREETINGS = {
        "前端开发工程师": [
            "你好！欢迎参加前端开发工程师岗位的面试。我是 AI 面试官，面试大约 15 分钟。请先简单介绍一下你的前端背景和项目经验。",
            "欢迎！感谢你抽出时间。今天我们来聊聊前端开发。请先用 2-3 分钟介绍一下你的技术栈和做过的项目。",
            "你好！我是今天的面试官。我们直奔主题——请介绍一下你在前端领域的技术积累和最有挑战性的项目。",
            "欢迎参加前端岗位面试！请放松，先聊聊你的 JS/TS 基础、框架经验和浏览器原理方面的积累。",
        ],
        "后端开发工程师": [
            "你好！欢迎参加后端开发工程师岗位的面试。我是 AI 面试官，面试大约 15 分钟。请先介绍一下你的后端技术背景。",
            "欢迎！今天我们来深入聊聊后端开发。请先用 2-3 分钟介绍一下你的技术栈——语言、框架、数据库都有哪些经验？",
            "你好！我是今天的面试官。请介绍一下你在分布式系统、数据库优化或高并发方面的项目经验。",
            "欢迎参加后端岗位面试！请简要介绍一下你擅长的技术方向，以及你做过的最复杂的后端项目。",
        ],
        "数据分析师": [
            "你好！欢迎参加数据分析师岗位的面试。我是 AI 面试官，面试大约 15 分钟。请先介绍一下你的数据分析背景和常用工具。",
            "欢迎！今天我们来聊聊数据分析。请用 2-3 分钟介绍一下你做过的分析项目，以及你最擅长的分析方法。",
            "你好！我是今天的面试官。请介绍一下你在 SQL、Python 和统计学方面的积累，最好能结合一个具体的分析案例。",
            "欢迎参加数据分析岗位面试！请聊聊你对数据驱动决策的理解，以及你最有成就感的一个分析成果。",
        ],
        "产品经理": [
            "你好！欢迎参加产品经理岗位的面试。我是 AI 面试官，面试大约 15 分钟。请先介绍一下你的产品背景和负责过的产品。",
            "欢迎！今天我们来聊聊产品思维。请用 2-3 分钟介绍一下你最满意的一个产品决策或功能设计。",
            "你好！我是今天的面试官。请介绍一下你在需求分析、用户研究和跨团队协作方面的经验。",
            "欢迎参加产品岗位面试！请聊聊你对'好产品'的定义，以及你经历过的从 0 到 1 的项目。",
        ],
        "UI/UX 设计师": [
            "你好！欢迎参加 UI/UX 设计师岗位的面试。我是 AI 面试官，面试大约 15 分钟。请先介绍一下你的设计背景和作品方向。",
            "欢迎！今天我们来聊聊设计思维。请用 2-3 分钟介绍一下你最满意的一个设计作品和背后的设计思考。",
            "你好！我是今天的面试官。请介绍一下你在用户研究、交互设计和视觉设计方面的经验侧重。",
            "欢迎参加设计岗位面试！请聊聊你的设计流程——从接到需求到最终交付，你通常怎么推进？",
        ],
    }

    DEEP_DIVE = {
        "前端开发工程师": [
            "你提到了前端性能优化，能具体讲讲你是怎么分析性能瓶颈的？用了什么工具？",
            "刚才说到组件化，你项目中组件粒度是怎么划分的？有没有遇到过组件过度拆分的问题？",
            "能结合你项目中的具体场景，说明一下你是怎么处理状态管理复杂度的？",
            "你提到了 TypeScript，在实际项目中泛型和类型体操用到什么程度？举一个印象深刻的例子。",
            "关于 Webpack/Vite 配置，你做过哪些非标准的自定义配置？为什么需要这么做？",
        ],
        "后端开发工程师": [
            "你提到了数据库优化，能结合具体 SQL 和 EXPLAIN 结果说明你是怎么分析慢查询的？",
            "微服务拆分边界你是怎么确定的？有没有拆错又合回去的经历？",
            "分布式事务你们项目怎么处理的？最终一致性方案遇到过数据不一致的情况吗？",
            "Redis 在你的项目中具体承担了什么角色？遇到过缓存穿透/击穿/雪崩吗？怎么解决的？",
            "聊聊你做过的最复杂的一次上线：灰度策略、回滚方案、监控告警都是怎么设计的？",
        ],
        "数据分析师": [
            "你提到了 A/B 测试，能具体说说你怎么计算最小样本量和实验时长？",
            "你的分析结果被业务方质疑过吗？你是怎么用数据说服他们的？",
            "聊聊你处理过的最脏的数据集：缺失率多高？异常值怎么识别和处理？",
            "除了常规的指标看板，你有没有做过让业务方眼前一亮的深度分析？具体是什么？",
        ],
        "产品经理": [
            "你提到的需求优先级排序，能不能用你最近的两个需求举例，说明为什么 A 排在 B 前面？",
            "和研发沟通需求时被挑战过吗？最激烈的一次是什么情况？你怎么处理的？",
            "聊聊你做过的一个失败的功能：当初为什么上？数据表现怎么样？你学到了什么？",
            "聊聊你做过的竞品分析：你的分析框架是什么？从中得到了什么关键洞察？",
            "你怎么定义 MVP？能不能举一个你实际裁剪需求、确定最小可行集的例子？",
            "用户调研中，你怎么区分用户的真实需求和伪需求？能举例吗？",
            "产品上线后，你最关注的前三个指标是什么？为什么选这三个？",
            "你怎么判断一个功能该不该砍掉？有没有砍过自己很喜欢但数据不支持的功能？",
        ],
        "UI/UX 设计师": [
            "你提到的设计系统，在推进过程中遇到过研发不配合的情况吗？怎么解决的？",
            "聊聊你做过的一次用户测试：怎么招募用户？发现了什么意外的问题？",
            "设计和开发还原度不一致时，你的底线是什么？哪些可以妥协，哪些必须坚持？",
            "能分享一下你做过的一个设计改版案例吗？从发现问题到最终落地的完整过程。",
            "设计评审中，被非设计背景的同事质疑过吗？你是怎么回应和说服的？",
            "交互设计中，你怎么处理复杂信息架构？能不能举个例子说明你的思路？",
            "你对设计系统的理解是什么？有参与过组件库或设计系统的搭建吗？",
            "你平时怎么保持设计敏感度？有没有特别欣赏的产品或设计作品？为什么？",
        ],
    }

    SWITCH_TOPIC = {
        "前端开发工程师": [
            "我们换个方向。你对前端安全了解多少？比如 XSS、CSRF 的防御方案。",
            "聊聊工程化方面。你们项目的 CI/CD 流程是怎么设计的？",
            "你对前端监控和错误追踪有什么经验？Sentry 或其他工具用得多吗？",
            "换个角度。你关注前端社区的最新动态吗？最近有什么你觉得有意思的新技术？",
            "谈谈跨端开发。你对小程序、React Native 或 Flutter 有经验吗？",
        ],
        "后端开发工程师": [
            "换个话题。你对系统设计有什么理解？如果让你设计一个短链接服务，你会怎么考虑？",
            "聊聊中间件。消息队列在你们项目中怎么用的？有没有遇到过消息丢失或重复消费？",
            "你对容器化和 K8s 有多少了解？生产环境部署是怎么做的？",
        ],
        "数据分析师": [
            "换个方向。你对机器学习有多少了解？在你的分析工作中有没有用到建模？",
            "聊聊数据治理。你们公司的数据质量是怎么保障的？元数据管理做得怎么样？",
            "你对数据产品的理解是什么？有没有参与过数据产品的设计和迭代？",
        ],
        "产品经理": [
            "换个角度聊聊。你对商业变现有什么理解？你们产品的商业模式是什么？",
            "聊聊跨部门协作。你和运营、市场、销售部门的协作中，最头疼的是什么？",
            "你对行业趋势怎么看？最近有什么让你印象深刻的产品创新？",
        ],
        "UI/UX 设计师": [
            "换个话题。你对无障碍设计有多少了解？有在实际项目中落地过吗？",
            "聊聊设计工具。除了 Figma，你还用过哪些工具？你觉得 AI 设计工具会取代设计师吗？",
            "你对设计师的前端能力怎么看？你觉得设计师需要学代码吗？到什么程度？",
        ],
    }

    GIVE_HINT = [
        "没关系，不用紧张。这样，我们从更基础的角度来思考——你接触过这个领域的哪些基本概念？",
        "这个问题确实有难度。不如先说说你对这个领域的整体理解，不用追求细节完全准确。",
        "放松一下。你可以从自己的实际经验出发，不一定非要用专业术语，用你自己的话描述就行。",
    ]

    END = [
        "好的，面试就到这里。感谢你今天的时间，你的回答让我对你的能力有了比较全面的了解。评估报告稍后生成，请查看。",
        "面试到此结束。感谢你的参与！你在多个方面展现了不错的潜力，评估结果请查看报告页面。",
    ]

    def __init__(self):
        self._shuffled: dict[str, dict[str, list]] = {}
        self._indices: dict[str, dict[str, int]] = {}

    def _next(self, sid: str, key: str, items: list) -> str:
        if sid not in self._shuffled:
            self._shuffled[sid] = {}
            self._indices[sid] = {}
        if key not in self._shuffled[sid] or self._indices[sid].get(key, 0) >= len(self._shuffled[sid][key]):
            shuffled = list(items)
            random.shuffle(shuffled)
            self._shuffled[sid][key] = shuffled
            self._indices[sid][key] = 0
        idx = self._indices[sid][key]
        self._indices[sid][key] += 1
        return self._shuffled[sid][key][idx]

    async def chat(
        self, messages: List[LLMMessage],
        session_id: str = "", position: str = "", **kwargs,
    ) -> LLMResponse:
        # 从 system prompt 中提取本轮决策
        decision = "开场"
        for m in messages:
            if m.role == "system":
                if "深挖弱点" in m.content: decision = "深挖弱点"
                elif "转话题" in m.content: decision = "转话题"
                elif "给提示" in m.content: decision = "给提示"
                elif "结束" in m.content: decision = "结束"
                elif "开场" in m.content: decision = "开场"
                break

        if not position or position not in self.DEEP_DIVE:
            pos = "前端开发工程师"
        else:
            pos = position

        if decision == "开场":
            content = self._next(session_id, "greet", self.GREETINGS.get(pos, self.GREETINGS.get("前端开发工程师", ["你好！欢迎参加面试，请先做个自我介绍。"])))
        elif decision == "深挖弱点":
            content = self._next(session_id, "deep", self.DEEP_DIVE.get(pos, list(self.DEEP_DIVE.values())[0]))
        elif decision == "转话题":
            content = self._next(session_id, "switch", self.SWITCH_TOPIC.get(pos, self.SWITCH_TOPIC["前端开发工程师"]))
        elif decision == "给提示":
            content = self._next(session_id, "hint", self.GIVE_HINT)
        elif decision == "结束":
            content = self._next(session_id, "end", self.END)
        else:
            content = self._next(session_id, "deep", self.DEEP_DIVE.get(pos, list(self.DEEP_DIVE.values())[0]))

        return LLMResponse(content=content, model="mock", tokens_used=0)

    async def health(self) -> bool:
        return True


_llm_instance: Optional[BaseLLM] = None


def get_llm() -> BaseLLM:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = MockLLM()
    return _llm_instance


def set_llm(llm: BaseLLM):
    global _llm_instance
    _llm_instance = llm
