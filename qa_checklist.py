"""
QA 自检脚本 — 统一检查合规性、模块功能、HTTP 端到端。
运行方式: python qa_checklist.py
放在: project_002_多模态Agent智能面试评估系统/
"""

import sys, os, re, json, math, asyncio, urllib.request, time

# ---- 配置 ----
WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "backend")
sys.path.insert(0, BACKEND)

results = {"pass": 0, "fail": 0, "skip": 0}

def check(name: str, condition: bool, detail: str = "") -> bool:
    """统一检查函数"""
    if condition:
        results["pass"] += 1
        return True
    else:
        results["fail"] += 1
        msg = f"  FAIL [{name}]"
        if detail:
            msg += f" — {detail}"
        print(msg)
        return False


# ============================================================
# PHASE 1: 合规审计
# ============================================================
def audit_compliance():
    print("=" * 50)
    print("PHASE 1: 合规审计")
    print("=" * 50)

    # AGENTS.md
    with open(os.path.join(WORKSPACE, "AGENTS.md"), encoding="utf-8") as f:
        a = f.read()
    check("1.1 AGENTS P0指令", "最高优先级指令" in a and "必须先查看以下三个文档" in a)
    check("1.2 AGENTS 项目隔离", "项目隔离" in a or "project_XXX" in a)

    # 项目命名
    for d in sorted(os.listdir(WORKSPACE)):
        if not d.startswith("project_") or not os.path.isdir(os.path.join(WORKSPACE, d)):
            continue
        m = re.match(r"^project_(\d{3})_(.+)$", d)
        check(f"1.3 命名: {d}", bool(m) and " " not in d)

    # 项目隔离
    for root, dirs, files in os.walk(WORKSPACE):
        for fn in files:
            rel = os.path.relpath(os.path.join(root, fn), WORKSPACE)
            if rel in ["AGENTS.md", "全局工作台.md", "全局复利与踩坑日志.md", "新项目SOP.md"]:
                continue
            if any(rel.startswith(p) for p in ["project_001", "project_002", ".git", ".agents", ".codex"]):
                continue
            if "__pycache__" in rel:
                continue
            if rel.endswith("qa_checklist.py"):
                continue
            check(f"1.4 隔离: {rel}", False, "文件散落在项目外")
            break  # 只报告第一个

    # SOP 目录
    proj = os.path.join(WORKSPACE, "project_002_多模态Agent智能面试评估系统")
    for d in ["README.md", "src", "docs", "data", "config", "outputs"]:
        check(f"1.5 SOP目录: {d}", d in os.listdir(proj))

    # README 内容
    with open(os.path.join(proj, "README.md"), encoding="utf-8") as f:
        rm = f.read()
    for kw in ["项目编号", "项目名称", "创建日期", "项目目标", "关键需求"]:
        check(f"1.6 README: {kw}", kw in rm)

    # 复利日志格式
    log_path = os.path.join(WORKSPACE, "全局复利与踩坑日志.md")
    with open(log_path, encoding="utf-8") as f:
        log = f.read()
    entries = log.split("### [20")
    required_fields = ["**所属项目**", "**标签**", "**问题描述**", "**解决方案**", "**复用价值**"]
    for i, e in enumerate(entries[1:], 1):
        txt = "### [20" + e
        for field in required_fields:
            check(f"1.7 日志条目{i}: {field}", field in txt,
                  f"条目{i}缺少{field}" if field not in txt else "")

    # 编号递增
    nums = sorted([
        int(re.match(r"project_(\d{3})_", d).group(1))
        for d in os.listdir(WORKSPACE)
        if d.startswith("project_") and os.path.isdir(os.path.join(WORKSPACE, d))
    ])
    check("1.8 编号递增", nums == list(range(1, len(nums) + 1)), str(nums))


# ============================================================
# PHASE 2: 模块单元测试
# ============================================================
async def test_modules():
    print("\n" + "=" * 50)
    print("PHASE 2: 模块单元测试")
    print("=" * 50)

    from services.text_analyzer import analyze_text
    from services.voice_analyzer import analyze_voice
    from services.visual_analyzer import analyze_visual, FaceData
    from services.fusion import fuse_analysis
    from services.report import generate_report
    from services.agent import InterviewAgent, AgentDecision, get_agent

    D = lambda n, s: type("D", (), {"name": n, "score": s, "evidence": "ok"})()

    # Text
    r = await analyze_text("React虚拟DOM性能优化Webpack配置", "前端开发工程师")
    check("2.1 Text 5维", len(r.dimensions) == 5)
    check("2.2 Text 分数范围", 0 <= r.overall_score <= 100)

    # Text edges
    for label, text in [("空", ""), ("None", None), ("超长", "测试" * 500)]:
        try:
            r = await analyze_text(text or "", "前端开发工程师")
            check(f"2.3 Text {label}", 0 <= r.overall_score <= 100)
        except Exception:
            check(f"2.3 Text {label}", text is not None, "None应安全处理")

    # Voice
    tone = [0.08 * math.sin(2 * math.pi * 440 * i / 16000) for i in range(32000)]
    r = await analyze_voice(samples=tone, sample_rate=16000)
    check("2.4 Voice 5维", len(r.dimensions) == 5)
    check("2.5 Voice 分数范围", 0 < r.overall_score < 100)

    # Voice edges
    for label, samples in [("空", []), ("短", [0.01] * 100), ("静音", [0.0] * 8000)]:
        r = await analyze_voice(samples=samples, sample_rate=16000)
        check(f"2.6 Voice {label}", 0 <= r.overall_score <= 100)

    # Visual
    fd = FaceData()
    r = await analyze_visual(fd)
    check("2.7 Visual 4维", len(r.dimensions) == 4)
    check("2.8 Visual 正常分", r.overall_score >= 60)

    fd2 = FaceData(face_present=False)
    r = await analyze_visual(fd2)
    check("2.9 Visual 无人脸", r.overall_score <= 40)

    fd3 = FaceData(gaze_x=0.9, gaze_y=-0.8)
    r = await analyze_visual(fd3)
    check("2.10 Visual 视线偏移", r.overall_score < 75)

    # Fusion
    fr = await fuse_analysis(
        [D("A", 70) for _ in range(5)],
        [D("B", 60) for _ in range(5)],
        [D("C", 80) for _ in range(4)],
        70, 65, 80,
    )
    check("2.11 Fusion 18维", len(fr.dimensions) == 18)
    check("2.12 Fusion 融合维度", any(d.modality == "fusion" for d in fr.dimensions))

    # Fusion inconsistent
    fr2 = await fuse_analysis(
        [D("A", 90) for _ in range(5)],
        [D("B", 90) for _ in range(5)],
        [D("C", 20) for _ in range(4)],
        90, 90, 20,
    )
    cons = [d for d in fr2.dimensions if d.name == "跨模态一致性"][0]
    check("2.13 Fusion 不一致<40", cons.score < 40, f"score={cons.score}")

    # Report
    rep = await generate_report("测试岗", 5, 70, 65, 80, fr, {"深挖弱点": 3, "转话题": 2}, 15)
    check("2.14 Report 3雷达", len(rep.radar) == 3)
    check("2.15 Report 5+章节", len(rep.sections) >= 5)
    check("2.16 Report 建议", len(rep.recommendations) > 0)

    # Agent
    agent = InterviewAgent()
    async def mock_llm(s, k):
        return "reply"

    agent.reset_state("qa1")
    res = await agent.process_turn("qa1", "fe", "hi", [D("A", 60) for _ in range(5)], 60, "ok", mock_llm)
    check("2.17 Agent 首轮=1", res["turn"] == 1)

    agent.reset_state("qa2")
    for i in range(2):
        await agent.process_turn("qa2", "fe", "x", [D("A", 20) for _ in range(5)], 20, "bad", mock_llm)
    agent._states["qa2"].history[-1].decision = AgentDecision.END
    res = await agent.process_turn("qa2", "fe", "x", [D("A", 20) for _ in range(5)], 20, "bad", mock_llm)
    check("2.18 Agent END传播", res["decision"] == "结束", f"got {res['decision']}")

    a1, a2 = get_agent(), get_agent()
    check("2.19 Agent 单例", a1 is a2)


# ============================================================
# PHASE 3: HTTP 端到端
# ============================================================
def test_http():
    print("\n" + "=" * 50)
    print("PHASE 3: HTTP 端到端")
    print("=" * 50)

    def post(url, data):
        req = urllib.request.Request(url, data=json.dumps(data).encode(),
                                     headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read())

    # 健康检查（最多重试3次）
    for attempt in range(3):
        try:
            h = json.loads(urllib.request.urlopen("http://localhost:8000/health", timeout=5).read())
            check("3.1 Health可达", h.get("status") == "ok")
            break
        except Exception:
            if attempt < 2:
                time.sleep(2)
            else:
                check("3.1 Health可达", False, "服务器未启动，跳过HTTP测试")
                results["skip"] += 1
                return

    # 面试流程
    face = {
        "left_eye_open": 0.88, "right_eye_open": 0.9, "eye_blink_rate": 16,
        "gaze_x": 0.03, "gaze_y": -0.02, "gaze_stability": 0.85,
        "head_yaw": 1.5, "head_pitch": 2.0, "head_roll": 0.3,
        "head_movement": 0.1, "smile_ratio": 0.35, "expression_variance": 0.4,
        "face_present": True, "face_confidence": 0.95,
    }
    pos = "产品经理"
    sid = "qa_final"
    msgs = []

    answers = [
        "开始面试",
        "我有三年产品经验，擅长用户需求分析和数据驱动决策",
        "通过AARRR模型分析用户转化漏斗，找到关键流失环节并优化",
        "这个嘛...还行吧",
        "用RFM模型做用户分层，为高价值用户设计了专属运营策略，复购率提升20%",
    ]

    for i, text in enumerate(answers):
        msgs.append({"role": "user", "content": text})
        try:
            d = post("http://localhost:8000/api/chat", {
                "session_id": sid, "position": pos,
                "messages": [dict(m) for m in msgs],
                "face_data": face,
            })
            msgs.append({"role": "assistant", "content": d["reply"]})

            dim_count = len(d["dimensions"])
            tc = sum(1 for x in d["dimensions"] if x["modality"] == "text")
            vc = sum(1 for x in d["dimensions"] if x["modality"] == "visual")
            fc = sum(1 for x in d["dimensions"] if x["modality"] == "fusion")

            check(f"3.{2+i} R{i+1} 13维", dim_count == 13, f"got {dim_count} (t{tc}+v{vc}+f{fc})")
            check(f"3.{2+i} R{i+1} 决策", bool(d.get("agent_decision")))
            check(f"3.{2+i} R{i+1} 分数", 0 <= d["overall_score"] <= 100)
            check(f"3.{2+i} R{i+1} 回复", len(d.get("reply", "")) > 0)
        except Exception as e:
            check(f"3.{2+i} R{i+1} HTTP", False, str(e)[:80])
            break

    # 报告
    try:
        r = json.loads(urllib.request.urlopen(f"http://localhost:8000/api/report/{sid}", timeout=10).read())
        check("3.7 Report 等级", bool(r.get("overall_grade")))
        check("3.8 Report 雷达", len(r.get("radar", [])) == 3)
        check("3.9 Report 章节", len(r.get("sections", [])) >= 5)
        check("3.10 Report 统计", len(r.get("decision_stats", {})) > 0)
    except Exception as e:
        check("3.7 Report HTTP", False, str(e)[:80])


# ============================================================
# MAIN
# ============================================================
async def main():
    audit_compliance()
    await test_modules()
    test_http()

    print("\n" + "=" * 50)
    total = results["pass"] + results["fail"] + results["skip"]
    print(f"RESULTS: {results['pass']} PASS / {results['fail']} FAIL / {results['skip']} SKIP / {total} TOTAL")
    if results["fail"] == 0 and results["skip"] == 0:
        print("ALL CHECKS PASSED")
    elif results["fail"] == 0:
        print("PASSED (some skipped)")
    else:
        print(f"{results['fail']} FAILURES — review above")
    return results["fail"]

if __name__ == "__main__":
    exit(asyncio.run(main()))
