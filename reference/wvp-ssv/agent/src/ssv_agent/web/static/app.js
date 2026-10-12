const state = {
  page: 0,
  pageSize: 20,
  total: 0,
  selectedEvent: null,
  activeView: 'overview',
  visibleEventIds: [],
  detailSnapshot: null,
  currentDetail: null,
  activeEvidenceId: null,
  navigationToken: 0,
  timer: null,
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[character]));

const formatTime = (value) => {
  if (value === null || value === undefined || value === '') return '未知';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '未知';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
const labelStatus = { pending: '待处理', completed: '已完成', manual_review: '需关注' };
const labelVerdict = { violation: '违规', compliant: '合规', uncertain: '不确定' };
const labelEventType = { helmet_violation: '未戴安全帽' };
const labelSeverity = { critical: '严重', high: '高', medium: '中', low: '低' };
const statusClass = (value) => ({
  completed: 'success',
  manual_review: 'warning',
  pending: 'pending',
}[value] || 'muted');
const verdictClass = (value) => ({
  violation: 'danger',
  compliant: 'success',
  uncertain: 'warning',
}[value] || 'muted');

async function requestJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败 (${response.status})`);
  }
  return response.json();
}

function setConnection(connected) {
  $('#connection-dot').classList.toggle('ok', connected);
  $('#connection-label').textContent = connected ? '账本连接正常' : '账本不可用';
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('visible'), 3500);
}

function setView(view) {
  state.activeView = view;
  $('#overview').hidden = view !== 'overview';
  $('#events').hidden = view !== 'events';
  $('#event-detail').hidden = view !== 'detail';
  const activeNavView = view === 'detail' ? 'events' : view;
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === activeNavView);
  });
}

function navigateToView(view, { updateHash = true } = {}) {
  state.navigationToken += 1;
  state.selectedEvent = null;
  state.currentDetail = null;
  state.activeEvidenceId = null;
  state.detailSnapshot = null;
  setView(view);
  if (updateHash) {
    const nextHash = `#${view}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderOverview(data) {
  const metrics = [
    ['事件总数', data.total_events, '全部已入账事件', 'accent'],
    ['待处理', data.pending_events, '等待分析结果', 'pending'],
    ['已完成', data.completed_events, '已有分析结论', 'success'],
    ['需关注', data.needs_attention_events, '证据或复核异常', 'warning'],
  ];
  $('#metrics-grid').innerHTML = metrics.map(([label, value, hint, tone], index) => `
    <article class="metric-card ${tone}">
      <span class="metric-index">0${index + 1}</span>
      <span class="metric-label">${label}</span>
      <strong>${formatNumber(value)}</strong>
      <small>${hint}</small>
    </article>
  `).join('');
  $('#last-updated').textContent = data.newest_timestamp_ms != null
    ? `最新事件 ${formatTime(data.newest_timestamp_ms)}`
    : '暂无事件时间';
}

function renderRecent(items) {
  if (!items.length) {
    $('#recent-events').innerHTML = '<div class="empty-state">还没有已入账事件</div>';
    return;
  }
  $('#recent-events').innerHTML = items.slice(0, 4).map((item) => `
    <button class="mini-event" data-event-id="${escapeHtml(item.event_id)}" type="button">
      <span class="event-severity ${statusClass(item.status)}"></span>
      <span class="mini-event-main">
        <strong>${escapeHtml(labelEventType[item.event_type] || item.event_type || '未命名事件')}</strong>
        <small>${escapeHtml(item.source || '未知来源')} · ${formatTime(item.timestamp_ms)}</small>
      </span>
      <span class="mini-event-result ${verdictClass(item.verdict)}">
        ${escapeHtml(labelVerdict[item.verdict] || '未分析')}
      </span>
    </button>
  `).join('');
}

function renderEvents(payload) {
  state.total = payload.total;
  state.visibleEventIds = payload.items.map((item) => item.event_id);
  const body = $('#events-body');
  $('#result-count').textContent = `${formatNumber(payload.total)} 条记录`;
  if (!payload.items.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-message">没有匹配的事件</td></tr>';
  } else {
    body.innerHTML = payload.items.map((item) => `
      <tr data-event-id="${escapeHtml(item.event_id)}">
        <td><strong class="event-id">${escapeHtml(item.event_id)}</strong><small>${escapeHtml(labelEventType[item.event_type] || item.event_type || '未命名事件')}</small></td>
        <td>${escapeHtml(item.source || '未知')}</td>
        <td class="time-cell">${formatTime(item.timestamp_ms)}</td>
        <td><span class="tag ${statusClass(item.status)}">${escapeHtml(labelStatus[item.status] || item.status || '未知')}</span></td>
        <td><span class="tag ${verdictClass(item.verdict)}">${escapeHtml(labelVerdict[item.verdict] || '尚无结论')}</span></td>
        <td><span class="evidence-count">${item.evidence_count || 0}<small> / ${item.detection_count || 0} 检测</small></span></td>
        <td><button class="row-action" type="button">查看 →</button></td>
      </tr>
    `).join('');
  }

  const page = Math.floor(payload.offset / payload.limit) + 1;
  const pages = Math.max(1, Math.ceil(payload.total / payload.limit));
  $('#page-label').textContent = `${page} / ${pages}`;
  $('#prev-page').disabled = page <= 1;
  $('#next-page').disabled = page >= pages;
}

function filters() {
  const params = new URLSearchParams();
  const values = [
    ['q', $('#query-input').value.trim()],
    ['source', $('#source-input').value.trim()],
    ['status', $('#status-input').value],
    ['verdict', $('#verdict-input').value],
  ];
  values.forEach(([name, value]) => {
    if (value) params.set(name, value);
  });

  for (const [name, selector] of [['from_ms', '#from-input'], ['to_ms', '#to-input']]) {
    const value = $(selector).value;
    if (value) {
      const milliseconds = new Date(value).getTime();
      if (!Number.isNaN(milliseconds)) params.set(name, String(milliseconds));
    }
  }
  params.set('limit', state.pageSize);
  params.set('offset', state.page * state.pageSize);
  return params;
}

async function loadEvents({ resetPage = false } = {}) {
  if (resetPage) state.page = 0;
  const payload = await requestJson(`/api/events?${filters()}`);
  renderEvents(payload);
  return payload;
}

async function loadOverview() {
  const [overview, recent] = await Promise.all([
    requestJson('/api/overview'),
    requestJson('/api/events?limit=4&offset=0'),
  ]);
  renderOverview(overview);
  renderRecent(recent.items);
}

function renderEvidenceReference(evidenceId, evidenceIds) {
  const available = evidenceIds.has(evidenceId);
  const evidence = state.currentDetail?.evidence.find((item) => item.evidence_id === evidenceId);
  const registered = Boolean(evidence);
  const unsupported = evidence?.kind === 'clip';
  const availability = available
    ? '预览事件图片'
    : unsupported
      ? '视频证据暂未接入'
      : registered
        ? '图片证据不可用'
        : '证据未登记';
  const suffix = available ? '' : unsupported ? ' · 视频暂未接入' : registered ? ' · 不可用' : ' · 未登记';
  return `<button type="button" class="evidence-ref ${available ? '' : 'missing'}" data-evidence-target="${escapeHtml(evidenceId)}" title="${availability}" ${available ? '' : 'disabled'}>${escapeHtml(evidenceId)}${suffix}</button>`;
}

function renderClaims(claims, evidenceIds) {
  if (!Array.isArray(claims) || claims.length === 0) return '';
  return `<div class="claim-list">${claims.map((claim) => {
    const citations = Array.isArray(claim.evidence_ids) ? claim.evidence_ids : [];
    return `<article class="claim-item"><p>${escapeHtml(claim.text || '分析声明')}</p>${citations.length
      ? `<div class="claim-evidence">${citations.map((id) => renderEvidenceReference(id, evidenceIds)).join('')}</div>`
      : '<small class="claim-uncited">未关联证据</small>'}</article>`;
  }).join('')}</div>`;
}

function evidenceLabel(evidence) {
  if (evidence.kind === 'frame') {
    return evidence.coverage === 'anchor_only' ? '锚点附近图片（部分证据）' : '事件图片';
  }
  return '视频证据（暂未接入）';
}

function normaliseBBox(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  const values = bbox.slice(0, 4);
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
  const [rawX1, rawY1, rawX2, rawY2] = values;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const x1 = clamp(rawX1);
  const y1 = clamp(rawY1);
  const x2 = clamp(rawX2);
  const y2 = clamp(rawY2);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
}

function detectionLabel(detection) {
  const parts = [detection.class_name || '目标'];
  const confidence = Number(detection.confidence);
  if (detection.confidence != null && Number.isFinite(confidence)) {
    parts.push(`${Math.round(confidence * 100)}%`);
  }
  const trackId = Number(detection.track_id);
  if (detection.track_id != null && Number.isInteger(trackId) && trackId >= 0) {
    parts.push(`#${trackId}`);
  }
  return parts.join(' ');
}

function renderDetectionMarks(detections, width, height) {
  const fontSize = Math.max(12, Math.min(48, Math.round(width * 0.03)));
  return detections.map((detection, index) => {
    const bbox = normaliseBBox(detection.bbox);
    if (!bbox) return '';
    const x1 = bbox.x1 * width;
    const y1 = bbox.y1 * height;
    const x2 = bbox.x2 * width;
    const y2 = bbox.y2 * height;
    return `<rect class="detection-box" data-detection-index="${index}" x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"></rect><text class="detection-label" data-detection-index="${index}" x="${x1}" y="${Math.max(fontSize, y1 - 5)}" font-size="${fontSize}">${escapeHtml(detectionLabel(detection))}</text>`;
  }).join('');
}

function renderMediaPreview(evidence, detections) {
  if (!evidence) return '<div class="media-unavailable">尚未登记事件图片</div>';
  if (!evidence.available || !evidence.media_url) {
    return '<div class="media-unavailable">事件图片当前不可用</div>';
  }
  if (evidence.kind !== 'frame') return '<div class="media-unavailable">视频证据暂未接入</div>';
  if (evidence.detection_overlay && detections.some((item) => normaliseBBox(item.bbox))) {
    return `<div class="image-preview-stack"><img class="event-preview-image" src="${escapeHtml(evidence.media_url)}" alt="${escapeHtml(evidence.evidence_id)}" /><svg class="detection-overlay" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" role="img" aria-label="事件检测框"></svg></div>`;
  }
  return `<img class="event-preview-image" src="${escapeHtml(evidence.media_url)}" alt="${escapeHtml(evidence.evidence_id)}" />`;
}

function renderActiveMedia({ scroll = false } = {}) {
  const detail = state.currentDetail;
  if (!detail) return;
  const evidence = detail.evidence.find((item) => item.evidence_id === state.activeEvidenceId);
  $('#media-preview').innerHTML = renderMediaPreview(evidence, detail.detections || []);
  $('#media-caption').textContent = evidence
    ? `${evidenceLabel(evidence)} · ${evidence.evidence_id}`
    : '没有可用的已登记媒体';
  document.querySelectorAll('.media-tab').forEach((button) => {
    const selected = button.dataset.mediaId === state.activeEvidenceId;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const media = $('#media-preview').querySelector('img');
  const overlay = $('#media-preview').querySelector('.detection-overlay');
  const renderOverlay = () => {
    if (!media || !overlay || !evidence?.detection_overlay) return;
    const { naturalWidth: width, naturalHeight: height } = media;
    if (!width || !height) return;
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.innerHTML = renderDetectionMarks(detail.detections || [], width, height);
  };
  if (media?.complete) renderOverlay();
  else media?.addEventListener('load', renderOverlay, { once: true });
  media?.addEventListener('error', () => {
    $('#media-preview').innerHTML = '<div class="media-unavailable">事件图片无法显示</div>';
  }, { once: true });

  if (scroll) $('#media-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function selectEvidence(evidenceId, { scroll = false } = {}) {
  const evidence = state.currentDetail?.evidence.find((item) => item.evidence_id === evidenceId);
  if (!evidence?.available || !evidence.media_url) return;
  if (evidenceId === state.activeEvidenceId) {
    if (scroll) $('#media-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  state.activeEvidenceId = evidenceId;
  renderActiveMedia({ scroll });
}

function formatBBox(bbox) {
  if (!Array.isArray(bbox) || bbox.length === 0) return '未知';
  return JSON.stringify(bbox);
}

function renderReviewHistory(review, evidenceIds) {
  const confidence = review.confidence == null ? '未知' : `${Math.round(Number(review.confidence) * 100)}%`;
  const references = Array.isArray(review.evidence_ids) ? review.evidence_ids : [];
  return `
    <details class="history-entry">
      <summary class="history-row"><span class="tag ${verdictClass(review.verdict)}">${escapeHtml(labelVerdict[review.verdict] || review.verdict || '未知')}</span><span>revision ${escapeHtml(review.revision ?? '未知')}</span><time>${formatTime(review.created_ms)}</time></summary>
      <div class="history-entry-body">
        <p>${escapeHtml(review.explanation || '暂无说明')}</p>
        <small>置信度 ${confidence} · 证据状态 ${escapeHtml(review.evidence_status || '未知')}</small>
        ${renderClaims(review.claims, evidenceIds)}
        ${references.length ? `<div class="claim-evidence">${references.map((id) => renderEvidenceReference(id, evidenceIds)).join('')}</div>` : ''}
        ${review.rule_citations?.length ? `<small>规则引用：${review.rule_citations.map((citation) => escapeHtml(citation.rule_id || '规则')).join('、')}</small>` : ''}
      </div>
    </details>
  `;
}

function renderDetail(detail) {
  const sameEvent = state.currentDetail?.event.event_id === detail.event.event_id;
  if (!sameEvent) state.activeEvidenceId = null;
  state.currentDetail = detail;
  const snapshot = JSON.stringify({ detail, visibleEventIds: state.visibleEventIds });
  if (snapshot === state.detailSnapshot) return;

  state.detailSnapshot = snapshot;

  const event = detail.event;
  const latestReview = detail.latest_review;
  const evidence = Array.isArray(detail.evidence) ? detail.evidence : [];
  const imageEvidence = evidence.filter((item) => item.kind === 'frame');
  const detections = Array.isArray(detail.detections) ? detail.detections : [];
  const history = Array.isArray(detail.review_history) ? detail.review_history : [];
  const availableEvidenceIds = new Set(imageEvidence.filter((item) => item.available).map((item) => item.evidence_id));
  const activeEvidence = imageEvidence.find((item) => item.evidence_id === state.activeEvidenceId && item.available)
    || imageEvidence.find((item) => item.available)
    || imageEvidence[0];
  state.activeEvidenceId = activeEvidence?.evidence_id || null;

  const title = labelEventType[event.event_type] || event.event_type || '事件详情';
  const verdict = latestReview?.verdict || event.verdict;
  const confidence = latestReview?.confidence ?? event.confidence;
  const confidenceText = confidence == null ? '未知' : `${Math.round(Number(confidence) * 100)}%`;
  const eventIndex = state.visibleEventIds.indexOf(event.event_id);
  const firstReview = history[0];
  const lastReview = latestReview || history[history.length - 1];
  const resultIcon = verdict === 'violation' ? '!' : verdict === 'compliant' ? '✓' : '?';
  const historyItems = history.slice().reverse();
  const availableCount = imageEvidence.filter((item) => item.available).length;
  const onlyAnchorEvidence = availableCount > 0
    && imageEvidence.filter((item) => item.available).every((item) => item.coverage === 'anchor_only');
  const evidenceStatus = !imageEvidence.length
    ? '暂无图片证据'
    : !availableCount
      ? '图片不可用'
      : onlyAnchorEvidence
        ? '仅有锚点附近图片，需人工复核'
      : availableCount === imageEvidence.length
        ? '图片可用'
        : '部分图片可用';
  const latestReferences = Array.isArray(latestReview?.evidence_ids) ? latestReview.evidence_ids : [];

  $('#detail-title').textContent = title;
  $('#detail-content').innerHTML = `
    <div class="detail-grid">
      <div class="detail-context panel">
        <div class="context-item"><span class="context-icon" aria-hidden="true">▣</span><div><small>事件来源</small><strong>${escapeHtml(event.source || '未知来源')}</strong></div></div>
        <span class="context-separator" aria-hidden="true"></span>
        <div class="context-item"><span class="context-icon" aria-hidden="true">◷</span><div><small>事件时间</small><strong>${formatTime(event.timestamp_ms)}</strong></div></div>
        <span class="context-separator" aria-hidden="true"></span>
        <div class="context-item event-id-context"><span class="context-icon" aria-hidden="true">▤</span><div><small>Event ID</small><strong>${escapeHtml(event.event_id)}</strong></div></div>
        <div class="context-actions">
          <button class="event-nav-button" type="button" data-adjacent="-1" ${eventIndex <= 0 ? 'disabled' : ''}>← 上一条</button>
          <button class="event-nav-button" type="button" data-adjacent="1" ${eventIndex < 0 || eventIndex >= state.visibleEventIds.length - 1 ? 'disabled' : ''}>下一条 →</button>
        </div>
      </div>

      <div class="detail-main-grid">
        <section class="panel media-panel" id="media-panel">
          <div class="media-frame" id="media-preview" aria-label="事件媒体预览"></div>
          <div class="media-tabs" role="group" aria-label="选择事件证据">
            ${imageEvidence.length ? imageEvidence.map((item) => `
              <button class="media-tab ${item.evidence_id === state.activeEvidenceId ? 'active' : ''}" type="button" data-media-id="${escapeHtml(item.evidence_id)}" aria-pressed="${item.evidence_id === state.activeEvidenceId}" ${item.available ? '' : 'disabled'}>
                <span class="media-tab-icon" aria-hidden="true">▧</span>
                <span><strong>${evidenceLabel(item)}</strong><small>${escapeHtml(item.evidence_id)}</small></span>
              </button>
            `).join('') : '<div class="empty-state">尚未登记事件图片</div>'}
          </div>
          <div class="media-caption" id="media-caption"></div>
        </section>

        <section class="panel analysis-panel">
          <div class="analysis-result ${verdictClass(verdict)}">
            <span class="result-icon" aria-hidden="true">${resultIcon}</span>
            <div class="result-copy"><small>最新分析结论</small><h3>${escapeHtml(labelVerdict[verdict] || '尚无结论')}</h3><p>${escapeHtml(latestReview?.explanation || '尚无分析说明')}</p></div>
            <div class="confidence-box"><small>置信度</small><strong>${confidenceText}</strong></div>
          </div>
          <div class="analysis-evidence">
            <div><small>证据状态</small><strong class="evidence-state ${availableCount ? 'is-available' : ''}"><span class="status-dot ${availableCount ? 'ok' : ''}"></span>${evidenceStatus}</strong></div>
            <div class="evidence-labels"><small>证据标签</small>${imageEvidence.length
              ? imageEvidence.map((item) => renderEvidenceReference(item.evidence_id, availableEvidenceIds)).join('')
              : '<span class="muted-label">暂无图片证据</span>'}</div>
          </div>
          <div class="analysis-description"><h4>事件说明</h4><p>${escapeHtml(latestReview?.explanation || '尚无分析说明')}</p></div>
          ${latestReview?.claims?.length ? `<div class="analysis-claims"><h4>分析依据</h4>${renderClaims(latestReview.claims, availableEvidenceIds)}</div>` : ''}
          ${latestReferences.length ? `<div class="review-evidence"><span>本次复核引用</span>${latestReferences.map((id) => renderEvidenceReference(id, availableEvidenceIds)).join('')}</div>` : ''}
          ${latestReview?.rule_citations?.length ? `<div class="rule-citations">规则引用：${latestReview.rule_citations.map((citation) => escapeHtml(citation.rule_id || '规则')).join('、')}</div>` : ''}
          <div class="analysis-footer"><span>revision ${escapeHtml(latestReview?.revision ?? event.revision ?? '未知')}</span><span>${latestReview?.created_ms == null ? '分析时间未知' : formatTime(latestReview.created_ms)}</span></div>
        </section>
      </div>

      <div class="detail-bottom-grid">
        <section class="panel info-panel">
          <div class="panel-heading"><h3>原始事件</h3></div>
          <dl class="facts-list">
            <div><dt>事件类型</dt><dd>${escapeHtml(title)}</dd></div>
            <div><dt>严重级别</dt><dd><span class="tag ${['high', 'critical'].includes(event.severity) ? 'danger' : event.severity === 'medium' ? 'warning' : 'muted'}">${escapeHtml(labelSeverity[event.severity] || event.severity || '未知')}</span></dd></div>
            <div><dt>事件时间</dt><dd>${formatTime(event.timestamp_ms)}</dd></div>
            <div><dt>事件来源</dt><dd>${escapeHtml(event.source || '未知来源')}</dd></div>
            <div><dt>Event ID</dt><dd>${escapeHtml(event.event_id)}</dd></div>
            <div><dt>规则 ID</dt><dd>${escapeHtml(event.rule_id || '未知')}</dd></div>
            <div><dt>事件状态</dt><dd>${escapeHtml(labelStatus[event.status] || event.status || '未知')}</dd></div>
          </dl>
          <details class="raw-event-panel"><summary>原始字段</summary><pre class="json-view">${escapeHtml(JSON.stringify(event, null, 2))}</pre></details>
        </section>

        <section class="panel info-panel detection-panel">
          <div class="panel-heading"><h3>检测记录</h3><span class="panel-count">${detections.length} 项</span></div>
          ${detections.length ? `<div class="detection-list">${detections.map((item) => `
            <article class="detection-row">
              <dl class="detection-facts">
                <div><dt>检测目标</dt><dd>${escapeHtml(item.class_name || '未知目标')}</dd></div>
                <div><dt>检测置信度</dt><dd>${item.confidence == null ? '未知' : `${Math.round(Number(item.confidence) * 100)}%`}</dd></div>
                <div><dt>bbox（原始）</dt><dd title="${escapeHtml(formatBBox(item.bbox))}">${escapeHtml(formatBBox(item.bbox))}</dd></div>
                <div><dt>track ID</dt><dd>${item.track_id == null ? '未知' : escapeHtml(item.track_id)}</dd></div>
                <div><dt>跟踪状态</dt><dd>${escapeHtml(item.track_state || '未知')}</dd></div>
                <div><dt>是否遮挡</dt><dd>${item.occluded == null ? '未知' : item.occluded ? '是' : '否'}</dd></div>
              </dl>
            </article>
          `).join('')}</div>` : '<div class="empty-state">没有检测记录</div>'}
        </section>

        <section class="panel info-panel history-panel">
          <div class="panel-heading"><h3>分析历史</h3><span class="panel-icon" aria-hidden="true">◷</span></div>
          <dl class="history-summary">
            <div><dt>当前版本</dt><dd>revision ${escapeHtml(latestReview?.revision ?? event.revision ?? '未知')}</dd></div>
            <div><dt>首次分析</dt><dd>${firstReview?.created_ms == null ? '未知' : formatTime(firstReview.created_ms)}</dd></div>
            <div><dt>最近更新</dt><dd>${lastReview?.created_ms == null ? '未知' : formatTime(lastReview.created_ms)}</dd></div>
            <div><dt>分析状态</dt><dd><span class="tag ${statusClass(event.status)}">${escapeHtml(labelStatus[event.status] || event.status || '未知')}</span></dd></div>
          </dl>
          <div class="history-list">${historyItems.length ? historyItems.map((review) => renderReviewHistory(review, availableEvidenceIds)).join('') : '<small class="history-empty">没有已保存的复核历史</small>'}</div>
        </section>
      </div>

    </div>
  `;

  renderActiveMedia();
  $('#detail-content').querySelectorAll('[data-media-id]').forEach((button) => {
    button.addEventListener('click', () => selectEvidence(button.dataset.mediaId));
  });
  $('#detail-content').querySelectorAll('[data-evidence-target]').forEach((button) => {
    button.addEventListener('click', () => selectEvidence(button.dataset.evidenceTarget, { scroll: true }));
  });
  $('#detail-content').querySelectorAll('[data-adjacent]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextIndex = state.visibleEventIds.indexOf(state.selectedEvent) + Number(button.dataset.adjacent);
      const nextEventId = state.visibleEventIds[nextIndex];
      if (nextEventId) openDetail(nextEventId);
    });
  });

}

async function openDetail(eventId, { updateHash = true } = {}) {
  const token = ++state.navigationToken;
  try {
    const detail = await requestJson(`/api/events/${encodeURIComponent(eventId)}`);
    if (token !== state.navigationToken) return;
    state.selectedEvent = eventId;
    renderDetail(detail);
    setView('detail');
    if (updateHash) {
      const nextHash = `#event/${encodeURIComponent(eventId)}`;
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    if (token === state.navigationToken) showToast(error.message);
  }
}

function routeFromHash() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('event/')) {
    let eventId;
    try {
      eventId = decodeURIComponent(hash.slice('event/'.length));
    } catch {
      showToast('事件链接无效');
      navigateToView('events', { updateHash: false });
      return;
    }
    if (state.activeView === 'detail' && state.selectedEvent === eventId) return;
    openDetail(eventId, { updateHash: false });
    return;
  }
  navigateToView(hash === 'events' ? 'events' : 'overview', { updateHash: false });
}

async function refresh() {
  try {
    await Promise.all([loadOverview(), loadEvents()]);
    setConnection(true);
    $('#last-updated').dataset.synced = String(Date.now());
  } catch (error) {
    setConnection(false);
    if ($('#events-body').children.length === 0 || $('#events-body').textContent.includes('正在读取')) {
      $('#events-body').innerHTML = '<tr><td colspan="7" class="table-message">事件账本暂不可用</td></tr>';
    }
    if ($('#metrics-grid').querySelector('.loading-card')) {
      $('#metrics-grid').innerHTML = '<div class="empty-state">事件账本暂不可用</div>';
    }
    showToast(error.message);
    return;
  }
  if (state.activeView === 'detail' && state.selectedEvent) {
    const selectedEvent = state.selectedEvent;
    try {
      const detail = await requestJson(`/api/events/${encodeURIComponent(selectedEvent)}`);
      if (state.selectedEvent === selectedEvent) renderDetail(detail);
    } catch (error) {
      showToast(error.message);
    }
  }
}

$('#filters-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadEvents({ resetPage: true }).catch((error) => showToast(error.message));
});
$('#refresh-button').addEventListener('click', () => refresh());
$('#close-detail').addEventListener('click', () => navigateToView('events'));
$('#prev-page').addEventListener('click', () => {
  if (state.page > 0) {
    state.page -= 1;
    loadEvents().catch((error) => showToast(error.message));
  }
});
$('#next-page').addEventListener('click', () => {
  if ((state.page + 1) * state.pageSize < state.total) {
    state.page += 1;
    loadEvents().catch((error) => showToast(error.message));
  }
});
$('#recent-events').addEventListener('click', (event) => {
  const button = event.target.closest('[data-event-id]');
  if (button) openDetail(button.dataset.eventId);
});
$('#events-body').addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-event-id]');
  if (row) openDetail(row.dataset.eventId);
});
window.addEventListener('hashchange', routeFromHash);

routeFromHash();
refresh();
state.timer = window.setInterval(refresh, 10000);
