/* ============================================================
 * 四级备考规划师 · 逻辑层 app.js
 * 纯前端 + localStorage，多学员档案相互独立，密码不明文存储。
 * ============================================================ */
const DB_KEY = 'cet4_app_v1';

/* ---------- 存储 ---------- */
function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { students: {}, currentUser: null }; }
  catch (e) { return { students: {}, currentUser: null }; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
let DB = loadDB();

/* 轻量哈希（本地演示用，非加密级；正式部署应由平台后端做安全存储） */
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36) + '_' + s.length;
}

let cur = null; // 当前学员档案对象

/* ---------- 工具 ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const today = () => new Date().toISOString().slice(0, 10);
function show(view) {
  $('#authView').classList.add('hidden');
  $('#onboardView').classList.add('hidden');
  $('#appView').classList.add('hidden');
  $(view).classList.remove('hidden');
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- 计划版本适配 ---------- */
function pickPlan(level, duration) {
  const d = Number(duration);
  if (level === 'weak') return 'basic4m';
  if (d <= 2) return 'sprint2m';
  if (d >= 4) return 'basic4m';
  return 'sprint2m'; // 3个月默认冲刺结构（可按自适应规则再调）
}

/* ---------- 注册 / 登录 ---------- */
$('#btnRegister').onclick = () => {
  const name = $('#authName').value.trim(), pass = $('#authPass').value.trim();
  const err = $('#authErr'); err.textContent = '';
  if (!name || !pass) return err.textContent = '姓名和密码都不能为空。';
  if (DB.students[name]) return err.textContent = '该姓名已注册，请直接登录。';
  DB.students[name] = { pass: hash(pass), profile: null, checkins: [], wrongs: [], mocks: [], tasks: {} };
  DB.currentUser = name; saveDB(DB);
  show('#onboardView');
};
$('#btnLogin').onclick = () => {
  const name = $('#authName').value.trim(), pass = $('#authPass').value.trim();
  const err = $('#authErr'); err.textContent = '';
  const s = DB.students[name];
  if (!s) return err.textContent = '未找到该学员，请先注册。';
  if (s.pass !== hash(pass)) return err.textContent = '密码不正确，请重试。';
  DB.currentUser = name; saveDB(DB);
  enterApp();
};
$('#btnLogout').onclick = () => { DB.currentUser = null; saveDB(DB); cur = null; $('#authPass').value=''; show('#authView'); };

/* ---------- 建档 ---------- */
$('#btnFinishOnboard').onclick = () => {
  const level = $('#obLevel').value, duration = $('#obDuration').value;
  const daily = $('#obDaily').value, weak = $('#obWeak').value;
  if (!daily || Number(daily) <= 0) return $('#obErr').textContent = '请填写每日可投入学习时长。';
  DB.students[DB.currentUser].profile = {
    level, duration: Number(duration), daily: Number(daily), weak,
    planKey: pickPlan(level, duration), currentStage: 0, createdAt: today()
  };
  saveDB(DB); toast('档案已建立，专属计划已生成 ✅'); enterApp();
};

/* ---------- 进入应用 ---------- */
function enterApp() {
  const s = DB.students[DB.currentUser]; cur = s;
  if (!s.profile) { show('#onboardView'); return; }
  show('#appView');
  $('#sideName').textContent = '👤 ' + DB.currentUser;
  updateSideStage();
  switchView('home');
}
function updateSideStage() {
  const st = STAGES[cur.profile.currentStage];
  $('#sideStage').textContent = '当前：' + st.name;
}

/* ---------- 导航 ---------- */
$$('#nav .nav-item').forEach(el => el.onclick = () => switchView(el.dataset.view));
function switchView(v) {
  $$('#nav .nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === v));
  ['home','plan','resource','tech','xhs','log','archive'].forEach(k => $('#view' + cap(k)).classList.toggle('hidden', k !== v));
  ({ home: renderHome, plan: renderPlan, resource: renderResource, tech: renderTech, xhs: renderXhs, log: renderLog, archive: renderArchive })[v]();
}
const cap = s => s[0].toUpperCase() + s.slice(1);

/* ---------- 首页 ---------- */
function renderHome() {
  const p = cur.profile, plan = PLANS[p.planKey];
  const done = cur.checkins.includes(today());
  $('#viewHome').innerHTML = `
    <div class="section-title">你好，${DB.currentUser} 👋</div>
    <div class="section-desc">匹配版本：<b>${plan.version}</b>（${plan.fit}） · ${plan.note}</div>

    <div class="card">
      <div style="font-weight:700;margin-bottom:8px">你的四阶段路径</div>
      <div class="stage-flow">
        ${STAGES.map((s,i)=>`<div class="stage-pill ${i===p.currentStage?'on':''}" style="background:${s.color}">
          ${s.icon} ${s.name}<small>${plan.stages[i].weeks}</small></div>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:13px;color:var(--ink-2)">
        当前阶段：
        <select id="stageSel">${STAGES.map((s,i)=>`<option value="${i}" ${i===p.currentStage?'selected':''}>${s.name}</option>`).join('')}</select>
        <span class="pill-cur">切换后资料库会按节奏推送</span>
      </div>
    </div>

    <div class="grid c4">
      <div class="card stat"><div class="num">${cur.checkins.length}</div><div class="lbl">累计打卡(天)</div></div>
      <div class="card stat"><div class="num">${cur.wrongs.filter(w=>w.status==='顽固错题').length}</div><div class="lbl">顽固错题</div></div>
      <div class="card stat"><div class="num">${cur.mocks.length}</div><div class="lbl">模考次数</div></div>
      <div class="card stat"><div class="num">${lastMockTotal()}</div><div class="lbl">最近模考分</div></div>
    </div>

    <div class="card">
      <button class="checkin-btn ${done?'done':''}" id="btnCheckin">${done?'✅ 今日已打卡':'📌 点击今日打卡'}</button>
      <div style="font-size:12px;color:var(--ink-2);margin-top:8px">打卡后系统按当前阶段维护你的学习档案。</div>
    </div>

    <div class="card" style="border-left:4px solid var(--brand)">
      <b>🎯 当前阶段核心目标</b>
      <p style="color:var(--ink-2);font-size:14px;margin-top:6px">${plan.stages[p.currentStage].goal}</p>
      <p style="font-size:13px;margin-top:8px">📚 调用资料包：${plan.stages[p.currentStage].materials}</p>
    </div>`;

  $('#stageSel').onchange = e => { p.currentStage = Number(e.target.value); saveDB(DB); updateSideStage(); renderHome(); toast('已切换到：'+STAGES[p.currentStage].name); };
  $('#btnCheckin').onclick = () => {
    if (cur.checkins.includes(today())) return;
    cur.checkins.push(today()); saveDB(DB); renderHome(); toast('打卡成功，继续加油！💪');
  };
}
function lastMockTotal() { return cur.mocks.length ? cur.mocks[cur.mocks.length-1].total : '—'; }

/* ---------- 备考计划 ---------- */
function renderPlan() {
  const p = cur.profile;
  const tabBtn = (k) => `<div class="plan-tab ${p.planKey===k?'active':''}" data-plan="${k}">${PLANS[k].version}<br><small style="font-weight:400">${PLANS[k].fit}</small></div>`;
  const render = (key) => {
    const plan = PLANS[key];
    return plan.stages.map((st,i)=>{
      const meta = STAGES[i];
      return `<div class="acc ${i===p.currentStage&&key===p.planKey?'open':''}">
        <div class="acc-head"><span class="badge" style="background:${meta.color}">${meta.icon}</span>
          ${meta.name}${key===p.planKey&&i===p.currentStage?' <span class="pill-cur">当前</span>':''}
          <span class="weeks">${st.weeks} ▾</span></div>
        <div class="acc-body">
          <div class="goal-box">🎯 <b>核心目标：</b>${st.goal}</div>
          <p style="font-size:13px;margin-bottom:8px">📚 <b>资料包：</b>${st.materials}</p>
          <table><tr><th>任务</th><th>内容</th><th>时长</th></tr>
            ${st.days.map(d=>`<tr><td><span class="day">${d.d}</span></td><td>${d.task}</td><td>${d.time}</td></tr>`).join('')}
          </table>
          <div style="margin-top:12px;font-weight:600;font-size:13px">✅ 阶段验收标准</div>
          <ul class="accept">${st.accept.map(a=>`<li>${a}</li>`).join('')}</ul>
        </div></div>`;
    }).join('');
  };
  $('#viewPlan').innerHTML = `
    <div class="section-title">📅 备考计划表</div>
    <div class="section-desc">按你的基础与时长自动匹配，可切换查看另一版本做参考。</div>
    <div class="plan-tabs">${tabBtn('sprint2m')}${tabBtn('basic4m')}</div>
    <div id="planBody">${render(p.planKey)}</div>`;
  $$('#viewPlan .plan-tab').forEach(t=>t.onclick=()=>{ $('#planBody').innerHTML=render(t.dataset.plan); bindAcc(); });
  bindAcc();
}
function bindAcc(){ $$('#viewPlan .acc-head').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('open')); }

/* ---------- 资料库（官方资源） ---------- */
function renderResource(focusCat) {
  const groups = RESOURCES.map((g,i)=>({g,i})).filter(({i})=>!focusCat||i===focusCat);
  $('#viewResource').innerHTML = `
    <div class="section-title">🗂️ 备考资源整合库</div>
    <div class="section-desc">已核实到各大平台<b>官方入口</b>，点击直达。真题永远第一优先级。</div>
    <div class="disc">⚠️ 版权提示：真题/音频请通过官方教材与正规渠道获取；链接以各平台最新页面为准。本工具不收录盗版 PDF。</div>
    ${groups.map(({g})=>`<div class="res-group"><h3>${g.cat}</h3>
      ${g.items.map(it=>`<div class="res-item"><div>
        <div class="rname">${it.name}</div><div class="rdesc">${it.desc}</div></div>
        <a class="rlink" href="${it.url}" target="_blank" rel="noopener">打开官网 ↗</a></div>`).join('')}
    </div>`).join('')}`;
}

/* ---------- 技巧库 ---------- */
function renderTech(key) {
  const keys = ['listening','reading','writing','translation'];
  const curKey = key || 'listening';
  const T = TECHNIQUES[curKey];
  $('#viewTech').innerHTML = `
    <div class="section-title">🎯 高分技巧库</div>
    <div class="section-desc">整合新东方、考虫、有道等机构公认有效方法，每条步骤化拆解。</div>
    <div class="tech-tabs">${keys.map(k=>`<div class="tech-tab ${k===curKey?'active':''}" data-k="${k}">${TECHNIQUES[k].title}</div>`).join('')}</div>
    <div class="grid c2">${T.items.map(it=>`<div class="card tech-card">
      <h4>${it.name}</h4><p>${it.steps}</p></div>`).join('')}</div>`;
  $$('#viewTech .tech-tab').forEach(t=>t.onclick=()=>renderTech(t.dataset.k));
}

/* ---------- 上岸经验（小红书高频） ---------- */
function renderXhs(key) {
  const keys = ['listening','reading','writing'];
  const curKey = key || 'listening';
  const D = XHS[curKey];
  const fire = h => '🔥'.repeat(h);
  const matRow = m => `<div class="xhs-mat">
    <div style="flex:1"><div class="mname">${m.name}</div><div class="mwhy">${m.why}</div></div>
    <span class="fire" title="提及热度">${fire(m.hot)}</span>
    ${m.url ? `<a class="mlink" href="${m.url}" target="_blank" rel="noopener">官网↗</a>`
            : `<span class="moff">正版渠道/应用商店</span>`}</div>`;
  const tipRow = t => `<div class="xhs-tip"><div class="tname">${fire(t.hot)} ${t.name}</div><div class="tsteps">${t.steps}</div></div>`;
  $('#viewXhs').innerHTML = `
    <div class="section-title">📕 小红书上岸经验·高频推荐</div>
    <div class="section-desc">提取阅读 / 听力 / 写作被多篇帖子反复推荐的高频资料与技巧。</div>
    <div class="src-note">数据来源：小红书经验帖要点（搜索引擎收录部分）+ B站/知乎/外研社等上岸帖交叉验证；🔥越多=多帖必提。链接仅收官方入口，其余走正版渠道。</div>
    <div class="tech-tabs">${keys.map(k=>`<div class="tech-tab ${k===curKey?'active':''}" data-k="${k}">${XHS[k].icon} ${XHS[k].title}</div>`).join('')}</div>
    <div class="xhs-cols">
      <div class="card"><b>${D.icon} 高频推荐资料</b>${D.materials.map(matRow).join('')}</div>
      <div class="card" style="border-left:4px solid var(--brand)"><b>💡 高频技巧（按提及排序）</b>${D.tips.map(tipRow).join('')}</div>
    </div>`;
  $$('#viewXhs .tech-tab').forEach(t=>t.onclick=()=>renderXhs(t.dataset.k));
}

/* ---------- 学习记录：打卡 / 错题 / 模考 ---------- */
function renderLog() {
  $('#viewLog').innerHTML = `
    <div class="section-title">✏️ 学习记录</div>
    <div class="section-desc">汇报即存档：错题、模考分数自动写入档案并追踪薄弱项趋势。</div>

    <div class="card"><b>📌 打卡记录（近14天）</b>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        ${last14().map(d=>`<span class="tag" style="${cur.checkins.includes(d)?'background:#dcfce7;color:#16a34a':''}">${d.slice(5)}</span>`).join('')}
      </div></div>

    <div class="card"><b>🧩 错题记录</b>
      <div class="inline-form" style="margin-top:12px">
        <select id="wType">${['听力','阅读','写作','翻译'].map(t=>`<option>${t}</option>`).join('')}</select>
        <input id="wSource" class="grow" placeholder="来源，如：真题①仔细阅读">
        <input id="wReason" placeholder="错因：词汇/定位/没听懂/时间不够">
        <button class="btn sm" id="btnAddWrong">添加</button>
      </div>
      <table><tr><th>日期</th><th>题型</th><th>来源</th><th>错因</th><th>状态</th><th></th></tr>
        ${cur.wrongs.length?cur.wrongs.map((w,i)=>`<tr><td>${w.date}</td><td>${w.type}</td><td>${w.source}</td>
          <td>${w.reason}</td><td><span class="tag ${w.status==='顽固错题'?'stubborn':''}">${w.status}</span></td>
          <td><span class="del" data-toggle="${i}">切换</span> · <span class="del" data-del="${i}">删</span></td></tr>`).join('')
          :'<tr><td colspan="6" class="empty">还没有错题记录，添加第一条吧</td></tr>'}
      </table></div>

    <div class="card"><b>📈 模考分数记录</b>
      <div class="inline-form" style="margin-top:12px">
        <input id="mName" class="grow" placeholder="模考名称，如：冲刺模考①">
        <input id="mTotal" type="number" placeholder="总分" style="width:90px">
        <input id="mL" type="number" placeholder="听" style="width:66px">
        <input id="mR" type="number" placeholder="读" style="width:66px">
        <input id="mW" type="number" placeholder="写" style="width:66px">
        <input id="mT" type="number" placeholder="译" style="width:66px">
        <button class="btn sm" id="btnAddMock">记录</button>
      </div>
      ${cur.mocks.length?`<div style="font-size:13px;color:var(--ink-2);margin-bottom:6px">总分变化曲线</div>
        <div class="spark">${maxSpark()}</div>`:'<div class="empty">暂无模考记录</div>'}
      <table style="margin-top:16px"><tr><th>日期</th><th>名称</th><th>总分</th><th>听</th><th>读</th><th>写</th><th>译</th><th></th></tr>
        ${cur.mocks.length?cur.mocks.map((m,i)=>`<tr><td>${m.date}</td><td>${m.name}</td><td><b>${m.total}</b></td>
          <td>${m.listening||'-'}</td><td>${m.reading||'-'}</td><td>${m.writing||'-'}</td><td>${m.translation||'-'}</td>
          <td><span class="del" data-deldel="${i}">删</span></td></tr>`).join('')
          :'<tr><td colspan="8" class="empty">记录后可自动生成分数曲线</td></tr>'}
      </table></div>`;

  $('#btnAddWrong').onclick=()=>{
    const type=$('#wType').value, source=$('#wSource').value.trim(), reason=$('#wReason').value.trim();
    if(!source) return toast('请填写错题来源');
    cur.wrongs.push({date:today(),type,source,reason,status:'待复习'}); saveDB(DB); renderLog(); toast('已加入错题本');
  };
  $$('#viewLog [data-toggle]').forEach(el=>el.onclick=()=>{
    const w=cur.wrongs[+el.dataset.toggle]; w.status = w.status==='顽固错题'?'待复习':'顽固错题'; saveDB(DB); renderLog();
  });
  $$('#viewLog [data-del]').forEach(el=>el.onclick=()=>{ cur.wrongs.splice(+el.dataset.del,1); saveDB(DB); renderLog(); });
  $('#btnAddMock').onclick=()=>{
    const name=$('#mName').value.trim(), total=+$('#mTotal').value;
    if(!name||!total) return toast('至少填写名称与总分');
    cur.mocks.push({date:today(),name,total,listening:+$('#mL').value||0,reading:+$('#mR').value||0,writing:+$('#mW').value||0,translation:+$('#mT').value||0});
    saveDB(DB); renderLog(); toast('模考成绩已记录');
  };
  $$('#viewLog [data-deldel]').forEach(el=>el.onclick=()=>{ cur.mocks.splice(+el.dataset.deldel,1); saveDB(DB); renderLog(); });
}
function last14(){ const a=[]; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); a.push(d.toISOString().slice(0,10)); } return a; }
function maxSpark(){
  const mx=Math.max(...cur.mocks.map(m=>m.total),425);
  return cur.mocks.map(m=>`<div class="bar" style="height:${Math.round(m.total/mx*100)}%"><span>${m.total}</span><em>${m.date.slice(5)}</em></div>`).join('');
}

/* ---------- 我的档案 ---------- */
function renderArchive() {
  const p=cur.profile, plan=PLANS[p.planKey];
  const md = buildMarkdown();
  $('#viewArchive').innerHTML = `
    <div class="section-title">📇 我的学习档案</div>
    <div class="section-desc">独立存储、可随时导出为 Markdown，直接上传阿里魔搭创空间知识库。</div>

    <div class="card"><b style="font-size:16px">基本信息</b>
      <div class="kv" style="margin-top:12px">
        <div class="k">学员姓名</div><div>${DB.currentUser}</div>
        <div class="k">建档日期</div><div>${p.createdAt}</div>
        <div class="k">当前英语基础</div><div>${{weak:'基础很差',normal:'基础一般',ok:'有一定基础'}[p.level]}</div>
        <div class="k">备考剩余时长</div><div>${p.duration} 个月</div>
        <div class="k">每日学习时长</div><div>${p.daily} 小时</div>
        <div class="k">最薄弱题型</div><div>${p.weak}</div>
        <div class="k">计划版本</div><div>${plan.version}（${plan.fit}）</div>
        <div class="k">当前阶段</div><div>${STAGES[p.currentStage].name}</div>
        <div class="k">打卡 / 错题 / 模考</div><div>${cur.checkins.length} 天 · ${cur.wrongs.length} 条 · ${cur.mocks.length} 次</div>
      </div></div>

    <div class="card"><b style="font-size:16px">📤 导出为 Markdown（同步魔搭创空间）</b>
      <div style="display:flex;gap:10px;margin:12px 0">
        <button class="btn sm" id="btnCopy">一键复制</button>
        <button class="btn sm ghost" id="btnDl">下载 .md 文件</button>
      </div>
      <textarea class="export-box" id="mdBox" readonly>${md.replace(/</g,'&lt;')}</textarea>
    </div>`;

  $('#btnCopy').onclick=()=>{ navigator.clipboard.writeText(md).then(()=>toast('已复制，可粘贴到魔搭知识库')); };
  $('#btnDl').onclick=()=>{
    const blob=new Blob([md],{type:'text/markdown'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`${DB.currentUser}_四级学习档案.md`; a.click(); toast('档案已下载');
  };
}
function buildMarkdown(){
  const p=cur.profile, plan=PLANS[p.planKey];
  let md=`# ${DB.currentUser} 的四级备考学习档案\n\n`;
  md+=`> 建档：${p.createdAt} · 版本：${plan.version} · 当前阶段：${STAGES[p.currentStage].name}\n\n`;
  md+=`## 基本信息\n- 基础：${{weak:'基础很差',normal:'基础一般',ok:'有一定基础'}[p.level]}\n- 剩余时长：${p.duration}个月\n- 每日时长：${p.daily}小时\n- 薄弱题型：${p.weak}\n\n`;
  md+=`## 专属备考计划（${plan.version}）\n`;
  plan.stages.forEach((st,i)=>{ md+=`\n### ${STAGES[i].name}（${st.weeks}）\n- 目标：${st.goal}\n- 资料包：${st.materials}\n- 任务：${st.days.map(d=>d.d+' '+d.task).join('；')}\n- 验收：${st.accept.join('；')}\n`; });
  md+=`\n## 打卡记录\n- 累计 ${cur.checkins.length} 天：${cur.checkins.join(', ')||'暂无'}\n`;
  md+=`\n## 错题记录\n`; md+= cur.wrongs.length? cur.wrongs.map(w=>`- ${w.date} 【${w.type}】${w.source}｜错因:${w.reason}｜${w.status}`).join('\n'):'- 暂无';
  md+=`\n\n## 模考分数\n`; md+= cur.mocks.length? cur.mocks.map(m=>`- ${m.date} ${m.name}：总分${m.total}（听${m.listening}/读${m.reading}/写${m.writing}/译${m.translation}）`).join('\n'):'- 暂无';
  return md;
}

/* ---------- 快捷指令 ---------- */
function runCmd(raw){
  const c = raw.trim(); if(!c) return;
  const map = {
    '查看计划':()=>{ switchView('plan'); },
    '查看档案':()=>{ switchView('archive'); },
    '听力资料':()=>{ switchView('tech'); renderTech('listening'); },
    '阅读资料':()=>{ switchView('tech'); renderTech('reading'); },
    '写作资料':()=>{ switchView('tech'); renderTech('writing'); },
    '技巧汇总':()=>{ switchView('tech'); renderTech('listening'); toast('技巧库：听力/阅读/写作/翻译四选一'); },
    '上岸经验':()=>{ switchView('xhs'); },
    '单词推荐':()=>{ switchView('resource'); renderResource(2); }
  };
  if(map[c]){ map[c](); $('#cmdInput').value=''; }
  else toast('未识别指令，可用：查看计划/查看档案/听力资料/阅读资料/写作资料/技巧汇总/单词推荐');
}
$('#cmdInput').addEventListener('keydown',e=>{ if(e.key==='Enter') runCmd(e.target.value); });
$$('#quickChips .chip').forEach(ch=>ch.onclick=()=>runCmd(ch.dataset.cmd));

/* ---------- 启动：自动恢复登录 ---------- */
(function init(){
  if(DB.currentUser && DB.students[DB.currentUser]){ enterApp(); }
  else { show('#authView'); }
})();
