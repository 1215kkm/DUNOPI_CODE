// ====== 설정 ======
const PLACEHOLDER_IMAGE_URL = '/images/img_none.jpg'; // 같은 오리진 경로
const CORE_CSS = ['css/reset.css', 'css/dunopi_wrap.css'];
const CORE_JS = []; // 필요시 추가

// ====== 유틸 ======
async function _getArrayBuffer(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url);
  return await r.arrayBuffer();
}
async function _getText(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url);
  return await r.text();
}
const _isHttp = u => /^https?:\/\//i.test(u);
const _sameOrigin = u => _isHttp(u) ? u.startsWith(location.origin) : !u.startsWith('/');
function _safePath(url) { return url.replace(location.origin + '/', ''); }
function _uniq(arr) { return [...new Map(arr.map(v => [v, v])).values()]; }

// CSS @import 재귀 펼치기 → 개별 파일도 ZIP에 저장 (상대경로 보존)
async function _collectCssWithImports(zip, absUrl, seen = new Set(), outFiles = []) {
  if (seen.has(absUrl)) return outFiles;
  seen.add(absUrl);

  const base = new URL('.', absUrl).href;
  let css = await _getText(absUrl);

  // 추출: @import url("...") media...
  const re = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/gi;
  let m, last = 0, output = '';
  while ((m = re.exec(css)) !== null) {
    output += css.slice(last, m.index);
    const url = m[2] || m[4];
    const media = (m[5] || '').trim();
    const childAbs = new URL(_normalizeToComponents(url), base).href;
    await _collectCssWithImports(zip, childAbs, seen, outFiles);
    last = re.lastIndex;
  }
  output += css.slice(last);

  // ZIP 경로(원래 경로 그대로 assets/ 밑에 저장)
  if (_sameOrigin(absUrl)) {
    const rel = _safePath(absUrl);
    const dst = 'assets/' + rel;
    zip.file(dst, output);
    outFiles.push({ href: rel }); // HTML에서 'assets/' 붙여서 씀
  } else {
    outFiles.push({ href: absUrl });
  }
  return outFiles;
}



// placeholder 준비
async function _preparePlaceholder(zip) {
  if (!PLACEHOLDER_IMAGE_URL) return null;
  const abs = _absFrom('.', PLACEHOLDER_IMAGE_URL);
  if (_sameOrigin(abs)) {
    const rel = await _zipCopyFile(zip, abs);
    return rel; // e.g. images/img_none.jpg
  } else {
    return abs;
  }
}


// ====== 다운로드 핸들러 ======
function initDownload() {
  $("a.download").off("click").on("click", async function (e) {
    e.preventDefault();

    const $zones = $(".dunopi .dunopi_zone");
    if (!$zones.length) { alert("추가된 컴포넌트가 없습니다."); return; }

    const zip = new JSZip();

    const htmlParts = [];
    let cssHrefs = [];
    let jsSrcs = [];
    let inlineCssAll = [];
    let inlineJsAll = [];

    // 🔹 reset.css 강제 포함  (← 맨 앞 슬래시 제거: 'css/reset.css')
    const resetRel = await _zipCopyFile(zip, _absFrom('.', 'css/reset.css'), 'common/css/reset.css');
    cssHrefs.push('common/css/reset.css');

    // 🔹 Placeholder 파일 강제 포함  (← 맨 앞 슬래시 제거: 'images/img_none.jpg')
    const placeholderRel = await _zipCopyFile(zip, _absFrom('.', 'images/img_none.jpg'), 'common/images/img_none.jpg');

    // 🔹 본문 처리
    for (const el of $zones) {
      const $z = $(el);
      const $clone = $z.clone();
      $clone.find(".btn_del_dunopi, i").remove();

      // 이미지 src → placeholder로 교체
      $clone.find("img[src]").each(function () {
        this.setAttribute("src", "assets/" + placeholderRel);
        this.style.maxWidth = "100%";
        this.style.height = "auto";
      });

      htmlParts.push($clone.html());

      ($z.data("dpCss") || []).forEach(h => cssHrefs.push(h));
      ($z.data("dpJs") || []).forEach(s => jsSrcs.push(s));
      inlineCssAll = inlineCssAll.concat($z.data("dpInlineCss") || []);
      inlineJsAll = inlineJsAll.concat($z.data("dpInlineJs") || []);
    }

    cssHrefs = [...new Set(cssHrefs)];
    jsSrcs = [...new Set(jsSrcs)];

    // 🔹 CSS 링크 태그  (← 반.드.시 템플릿 문자열(`)로 감싸기!)
    const linkCssTags = cssHrefs.map(h =>
      h.startsWith('http')
        ? `<link rel="stylesheet" href="${h}">`
        : `<link rel="stylesheet" href="assets/${h}">`
    );

    if (inlineCssAll.length) {
      const cssText = inlineCssAll.join('\n');
      zip.file('assets/inline/inline.css', cssText);
      linkCssTags.push(`<link rel="stylesheet" href="assets/inline/inline.css">`);
    }

    // 🔹 JS 링크 태그
    const scriptTags = [];
    for (const src of jsSrcs) {
      const abs = _absFrom('.', src);
      if (_sameOrigin(abs)) {
        const rel = await _zipCopyFile(zip, abs);
        scriptTags.push(`<script src="assets/${rel}"></script>`);
      } else {
        scriptTags.push(`<script src="${src}"></script>`);
      }
    }

    if (inlineJsAll.length) {
      const jsText = ';' + inlineJsAll.join('\n;');
      zip.file('assets/inline/inline.js', jsText);
      scriptTags.push(`<script src="assets/inline/inline.js"></script>`);
    }

    // 🔹 index.html 생성
    const indexHtml =
      `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DUNOPI Export</title>
${linkCssTags.join('\n')}
</head>
<body>
${htmlParts.join('\n')}
${scriptTags.join('\n')}
</body>
</html>`;

    zip.file('index.html', indexHtml);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'dunopi-assembled.zip');
  });

}


// ===== 프리뷰 토글 바인딩을 '내가' 장악한다 =====
function installDevicePreviewBindings(){
  // 1) 프레임은 미리 만들어 두고(숨김), 내 바인딩이 항상 마지막에 오게 한다
  dpEnsureFrame();
  dpToggleFrame(false); // 시작은 기본(PC) 모드

  // 2) 기존에 붙어있던 모든 click 핸들러 제거 (네임스페이스 불문)
  $('.topmenu .ico_pc, .topmenu .ico_mo').each(function(){
    $(this).off('click').off('click.dp').off('click.dunopi');
  });

  // 3) 새로 바인딩
  $('.topmenu .ico_pc').on('click.dp', function(e){
    e.preventDefault();
    $(this).addClass('on').siblings().removeClass('on');
    dpToggleFrame(false);                  // 프레임 끄기 → .dunopi 표시
  });

  $('.topmenu .ico_mo').on('click.dp', function(e){
    e.preventDefault();
    $(this).addClass('on').siblings().removeClass('on');
    dpToggleFrame(true);                   // 프레임 켜기
    dpSetFrameWidth(375);                  // 뷰포트=375px
    dpMountIntoFrame();                    // 1회 즉시 동기화
  });

  // 4) 썸네일로 컴포넌트를 추가/변경할 때, 프레임 모드면 DOM 반영 후 1회 동기화
  $('.each_section dd').off('click.dp.mountfix').on('click.dp.mountfix', function(){
    dpMountOnceAfterChange();
  });

  // 5) 디버깅: 아이콘 눌렀을 때 프레임이 없으면 경고
  $(document).off('click.dp.guard').on('click.dp.guard', '.topmenu .ico_mo', function(){
    setTimeout(function(){
      if (!$('.design_preview .device-preview').length){
        console.warn('[DUNOPI] device-preview(iframe) not found. Check bindings.');
      }
    }, 0);
  });
}




// ===== iframe 프리뷰: 생성/토글/마운트 =====

function dpEnsureFrame() {
  const $wrap = $('.design_preview');
  if ($wrap.find('.device-preview').length) return;

  const srcdoc = `
<!doctype html><html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html,body{margin:0;padding:0;min-height:0;}
    #dp-mount{min-height:0;}
    img{max-width:100%;height:auto;display:block;}
  </style>
</head>
<body>
  <div id="dp-mount"></div>
  <script>
    (function(){
      function sendH(){
        try{
          var h = Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight,
            document.body.offsetHeight,  document.documentElement.offsetHeight,
            document.body.clientHeight,  document.documentElement.clientHeight
          );
          parent.postMessage({type:'dp-ifr-h', h:h}, '*');
        }catch(e){}
      }
      // 내용 변화(추가/삭제)와 레이아웃 변화 모두 감지
      new ResizeObserver(sendH).observe(document.body);
      var mount = document.getElementById('dp-mount');
      new MutationObserver(sendH).observe(mount, {childList:true, subtree:true});
      window.addEventListener('load', sendH);
      window.addEventListener('message', function(ev){
        if (ev && ev.data && ev.data.type === 'dp-recalc') sendH();
      });
      setTimeout(sendH, 60);
    }());
  <\/script>
</body>
</html>`.trim();

  const $frameWrap = $('<div class="device-preview" style="display:none"></div>');
  const $iframe = $('<iframe>').attr({ srcdoc: srcdoc, style:'width:100%;border:0;display:block;' });
  $frameWrap.append($iframe);
  $wrap.append($frameWrap);

  window.addEventListener('message', function(ev){
    if (!ev.data || ev.data.type !== 'dp-ifr-h') return;
    $iframe.height(ev.data.h || 0);
  });
}



function dpUpdateEmptyState(){
  const empty = $('.dunopi .dunopi_zone').length === 0;
  const $frame = $('.device-preview');
  const $ifr   = $('.device-preview iframe');

  if (empty){
    $frame.addClass('is-empty');
    // 혹시 이전 높이가 남아 있으면 강제로 0으로
    if ($ifr.length) $ifr.height(0);
  }else{
    $frame.removeClass('is-empty');
  }
}




// 프레임 폭(=미디어쿼리용 뷰포트 폭) + 컨테이너 폭도 함께 부드럽게 변경
function dpSetFrameWidth(px){
  $('.device-preview').css({ width: px + 'px', margin: '20px auto' });
  $('.design_preview').css({ width: (px + 40) + 'px' }); // 컨테이너도 함께
}


function dpToggleFrame(on){
  const $wrap   = $('.design_preview');
  dpEnsureFrame();
  const $frame  = $wrap.find('.device-preview');
  const $editor = $wrap.find('.dunopi');

  if (on){
    $wrap.addClass('mode-mobile');
    $frame.show();

    // ✅ 처음이거나, 변경이 있었을 때만 iframe에 다시 마운트
    if (!__dpFrameMounted || __dpPreviewDirty){
      dpMountIntoFrame();
      __dpFrameMounted = true;
      __dpPreviewDirty = false;
    }

    if (!$frame.width()) dpSetFrameWidth(375);
    dpUpdateEmptyState();
    dpRecalcFrameHeight();

  }else{
    $wrap.removeClass('mode-mobile');
    $wrap.css({ width: '' });
    $editor.show();
    setTimeout(()=>{ $frame.hide(); }, 220);
  }
}

// 프리뷰 더티/마운트 상태
let __dpPreviewDirty  = true;   // 컴포넌트 추가/삭제/변경이 있으면 true
let __dpFrameMounted  = false;  // iframe에 한 번이라도 마운트했는지


// 현재 조립된 컴포넌트 기준으로 iframe 안에 렌더링
function dpMountIntoFrame(){
  const $ifr = $('.device-preview iframe');
  if (!$ifr.length) return;
  const doc = $ifr[0].contentDocument;
  if (!doc) return;

  // UID 부여(있다면 유지)
  if (typeof dpAssignUids === 'function') dpAssignUids();

  // head 초기화
  doc.head.innerHTML = `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0;padding:0;min-height:0;}#dp-mount{min-height:0;}img{max-width:100%;height:auto;display:block;}</style>
  `;

  // reset.css(있을 때만)
  try{
    const reset = new URL('css/reset.css', location.href).href;
    const l1 = doc.createElement('link'); l1.rel='stylesheet'; l1.href=reset; doc.head.appendChild(l1);
  }catch(e){}

  // 외부 CSS/JS/인라인 수집
  const cssSet = new Set(), jsSet = new Set();
  let inlineCssAll = [], inlineJsAll = [];
  $('.dunopi .dunopi_zone').each(function(){
    const $z = $(this);
    ($z.data('dpCss') || []).forEach(h => cssSet.add(new URL(h, location.href).href));
    ($z.data('dpJs')  || []).forEach(s => jsSet.add(new URL(s, location.href).href));
    inlineCssAll = inlineCssAll.concat($z.data('dpInlineCss') || []);
    inlineJsAll  = inlineJsAll.concat($z.data('dpInlineJs')  || []);
  });

  [...cssSet].forEach(href=>{
    const l = doc.createElement('link'); l.rel='stylesheet'; l.href=href; doc.head.appendChild(l);
  });
  document.querySelectorAll('style').forEach(s=>{
    const st = doc.createElement('style'); st.textContent = s.textContent; doc.head.appendChild(st);
  });
  if (inlineCssAll.length){
    const st = doc.createElement('style'); st.textContent = inlineCssAll.join('\n'); doc.head.appendChild(st);
  }

  // 본문 주입
  const mount = doc.getElementById('dp-mount');
  mount.innerHTML = $('.dunopi').html() || '';
  // ▼ 프리뷰 전용 CSS: 모바일(iframe)에서도 PC처럼 우측 삭제버튼 노출
// ▼ 프레임 전용 CSS (버튼을 프레임 '안쪽' 우측 상단에 표시)
const dpPreviewStyles = doc.createElement('style');
dpPreviewStyles.textContent = `
  html,body,#dp-mount{margin:0;padding:0;min-height:0;}
  #dp-mount > *:first-child{ margin-top:0 !important; }

  .dunopi_zone{ position:relative; }
  .btn_del_dunopi{
    position:absolute; right:8px; top:8px;  /* ← 프레임 안쪽에 고정 */
    display:none; width:32px; height:32px; border-radius:6px;
    background:rgba(0,0,0,.8); color:#fff; cursor:pointer; z-index:9999;
  }
  .btn_del_dunopi:before, .btn_del_dunopi:after{
    content:""; position:absolute; left:6px; right:6px; top:15px; height:2px; background:#fff;
  }
  .btn_del_dunopi:before{ transform:rotate(45deg); }
  .btn_del_dunopi:after{ transform:rotate(-45deg); }
  .dunopi_zone:hover .btn_del_dunopi{ display:block; }
`;
doc.head.appendChild(dpPreviewStyles);


  // 삭제 버튼 브릿지(있다면 유지)
  const hook = doc.createElement('script');
  hook.textContent = `
    (function(){
      document.addEventListener('click', function(e){
        var btn = e.target.closest('.btn_del_dunopi');
        if(!btn) return;
        e.preventDefault();
        var zone = btn.closest('.dunopi_zone');
        if(!zone) return;
        var uid = zone.getAttribute('data-dp-uid');
        if(uid) parent.postMessage({type:'dp-del', uid: uid}, '*');
      }, true);
    }());
  `;
  doc.body.appendChild(hook);

  // 외부/인라인 JS
  [...jsSet].forEach(src=>{
    const s = doc.createElement('script'); s.src = src; doc.body.appendChild(s);
  });
  if (inlineJsAll.length){
    const s = doc.createElement('script'); s.textContent = ';\n' + inlineJsAll.join('\n;'); doc.body.appendChild(s);
  }

  // 빈 상태 접기 + 높이 재계산
  dpUpdateEmptyState();
  dpRecalcFrameHeight();
}


// 컴포넌트 DOM 변화가 생기면 1회만 마운트(비동기 주입 대응)
function dpMountOnceAfterChange(){
  // ✅ 'mode-mobile' 기준으로 체크 (has-frame 아님)
  if (!$('.design_preview').hasClass('mode-mobile')) return;

  const target = document.querySelector('.dunopi');
  if (!target) return;

  const obs = new MutationObserver(() => {
    try { dpMountIntoFrame(); dpSetIframeHeightImmediate(); } 
    finally { obs.disconnect(); }
  });
  obs.observe(target, { childList: true, subtree: true });
}


function dpSetIframeHeightImmediate(){
  const $ifr = $('.device-preview iframe');
  if (!$ifr.length) return;
  const doc = $ifr[0].contentDocument;
  if (!doc) return;
  const h = Math.max(
    doc.body.scrollHeight, doc.documentElement.scrollHeight,
    doc.body.offsetHeight,  doc.documentElement.offsetHeight,
    doc.body.clientHeight,  doc.documentElement.clientHeight
  ) || 0;
  $ifr.height(h);
}



// 전역으로 내보내기
window.DUNOPI_LOADER = { initDownload };

// 자식 DOM 변화가 생기면 1회만 _mountPreviewContent() 실행하고 해제
function _mountOnceAfterComponentLoad(){
  if (!$('.design_preview').hasClass('has-device')) return; // 프레임 모드 아닐 때는 패스
  const target = document.querySelector('.dunopi');
  if (!target) return;

  const obs = new MutationObserver(() => {
    try { _mountPreviewContent(); } finally { obs.disconnect(); }
  });
  obs.observe(target, { childList: true, subtree: true });
}



// ===== 디바이스 프리뷰 유틸 =====
function _ensureDevicePreview() {
  const $wrap = $('.design_preview');
  if ($wrap.hasClass('has-device')) return;
  $wrap.addClass('has-device');

  const srcdoc = `
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<div id="mount"></div>
<script>
(function(){
  function sendH(){
    try{
      var h = document.documentElement.scrollHeight || document.body.scrollHeight;
      parent.postMessage({type:'dp-ifr-h', h:h}, '*');
    }catch(e){}
  }
  new ResizeObserver(sendH).observe(document.body);
  window.addEventListener('load', sendH);
  setTimeout(sendH, 50);
}());
<\/script>
</body>
</html>`.trim();

  const $frameWrap = $('<div class="device-preview"></div>');
  const $iframe = $('<iframe>').attr({ srcdoc: srcdoc });
  $frameWrap.append($iframe);
  $wrap.append($frameWrap);

  // 아이프레임 높이 자동 맞춤
  window.addEventListener('message', function(ev){
    if (!ev.data || ev.data.type !== 'dp-ifr-h') return;
    $('.device-preview iframe').height(ev.data.h);
  });
}

function _mountPreviewContent(){
  const $ifr = $('.device-preview iframe');
  if (!$ifr.length) return;
  const doc = $ifr[0].contentDocument;
  if (!doc) return;

  // 1) 바깥의 CSS 링크를 아이프레임 head로 복사 (컴포넌트 CSS 포함)
  const parentLinks = document.querySelectorAll('link[rel="stylesheet"]');
  parentLinks.forEach(l=>{
    const href = l.getAttribute('href');
    if (!href) return;
    const abs = new URL(href, location.href).href;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = abs;
    doc.head.appendChild(link);
  });

  // 2) dunopi 조립 결과를 mount에 주입
  const html = $('.dunopi').html() || '';
  const mount = doc.getElementById('mount');
  mount.innerHTML = html;

  // 3) 이미지가 너무 크면 튀지 않게 기본 스타일
  const style = doc.createElement('style');
  style.textContent = `img{max-width:100%;height:auto;}`;
  doc.head.appendChild(style);
}

function _setDeviceWidth(px){
  $('.device-preview').css({
    width: px + 'px',
    margin: '20px auto'
  });
}

function _disableDevicePreview(){
  $('.design_preview').removeClass('has-device');
  $('.device-preview').remove();
}



function dpRecalcFrameHeight(){
  const $ifr = $('.device-preview iframe');
  if (!$ifr.length) return;

  // 부모 기준으로 비었으면 즉시 0으로
  const empty = $('.dunopi .dunopi_zone').length === 0;
  if (empty) { $ifr.height(0); }

  const w = $ifr[0].contentWindow;
  if (w) w.postMessage({ type: 'dp-recalc' }, '*');
}










// _absFrom 함수 추가 (원본 코드에 없어서 추가)
function _absFrom(base, url) {
  try {
    return new URL(url, new URL(base, location.href)).href;
  } catch (e) {
    return url;
  }
}


async function _zipCopyFile(zip, absUrl, targetPath = null) {
  const buf = await _getArrayBuffer(absUrl);
  let rel = _safePath(absUrl);
  if (targetPath) rel = targetPath;      // 원하는 경로로 강제 가능
  zip.file('assets/' + rel, buf);
  return rel; // html에서 쓸 상대 경로 반환
}



// 모든 CSS를 수집(@import 재귀 포함)하고 ZIP에 저장한 뒤, <link> 태그 문자열을 돌려줍니다.
async function buildCssLinkTags(zip, $zones) {
  // 1) reset.css 강제 포함
  await _zipCopyFile(zip, _absFrom('.', '/css/reset.css'), 'common/css/reset.css');
  let cssHrefs = ['common/css/reset.css'];

  // 2) 각 컴포넌트에서 수집한 외부 CSS 경로 합치기
  for (const el of $zones) {
    const $z = $(el);
    ($z.data("dpCss") || []).forEach(h => cssHrefs.push(h));
  }
  cssHrefs = [...new Set(cssHrefs)];

  // 3) @import 재귀 수집 + ZIP 저장
  const expandedCss = [];
  for (const href of cssHrefs) {
    const absUrl = _absFrom('.', href);
    const items = await _collectCssWithImports(zip, absUrl);
    // items: [{href: '...'}]
    items.forEach(it => expandedCss.push(it.href));
  }
  const finalCssHrefs = [...new Set(expandedCss)];

  // 4) 링크 태그 문자열 만들기 (같은 오리진이면 assets/ 접두)
  const linkCssTags = finalCssHrefs.map(h =>
    _isHttp(h) ? `<link rel="stylesheet" href="${h}">`
      : `<link rel="stylesheet" href="assets/${h}">`
  );

  return { linkCssTags, finalCssHrefs };
}




// 각 .dunopi_zone에 고유 UID 부여
function dpAssignUids(){
  $('.dunopi .dunopi_zone').each(function(){
    if (!this.dataset.dpUid) {
      this.dataset.dpUid = 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    }
  });
}

// 부모-iframe 메시지 브릿지(삭제)
function dpInstallIframeBridge(){
  window.removeEventListener('message', dpMessageHandler);
  window.addEventListener('message', dpMessageHandler);
}

function dpMessageHandler(ev){
  const data = ev.data || {};
  if (data.type === 'dp-del' && data.uid){
    const $zone = $('.dunopi .dunopi_zone[data-dp-uid="'+ data.uid +'"]');
    if ($zone.length){
      $zone.remove();
      if (typeof __dpPreviewDirty !== 'undefined') __dpPreviewDirty = true;

      if ($('.design_preview').hasClass('mode-mobile')){
        dpMountIntoFrame();                 // 내용 재주입
        if (typeof __dpPreviewDirty !== 'undefined') __dpPreviewDirty = false;

        // 높이 즉시 재계산 + 레이아웃 안정화 후 한 번 더
        dpSetIframeHeightImmediate();
        requestAnimationFrame(dpSetIframeHeightImmediate);
      }
    }
  }
}










// ===== UI(기존 유지) =====
let pic = "디자인",
  soc = "소스",
  mobileW = 768,
  $codeLink = $(".code_link"),
  $codeBox = $(".code_box"),
  $check = 0,
  $dpre = $(".design_preview").css("display"),
  winW = $(window).width();

$("*").click(function () { console.log(winW, $check, $dpre); });

$(window).resize(function () {
  winW = $(window).width();
  if (winW <= mobileW) {
    $(".select_zone").removeClass("on on2");
  } else if ($dpre == "block") {
    $(".preview_v").removeClass("on");
    $(".source_v").addClass("on");
  } else if ($dpre == "none") {
    $(".preview_v").addClass("on");
    $(".source_v").removeClass("on");
  }
});

$(".each_section dd").off("click.dunopi").on("click.dunopi", function (e) {
  e.preventDefault();
  var cateName = $(this).siblings("dt").text().toLowerCase();
  var orderIndex = $(this).prevAll("dd").length + 1;

  $(".design_preview").show();
  $(".content_source").addClass("on");
  $(this).toggleClass("on").siblings().removeClass("on");
  $("a.download").slideDown(50);
  $("a.view_wide").slideDown(100);
  $("blockquote").fadeOut(200);
  $(".source_v").addClass("on");
  if ($(window).width() <= mobileW) { $(".preview_v").addClass("on"); }

  loadComponent(cateName, orderIndex);

  __dpPreviewDirty = true;
  dpMountOnceAfterChange();
});


$(".layout_select li").click(function () {
  $(".layout_select").hide();
  var layoutPic = $(this).find("figure").html();
  var layoutName = $(this).find("h3").text();
  $(".layout_choice figure").html(layoutPic);
  $(".layout_choice h3").text(layoutName);
  $(".layout_choice").show();
});

function noEachSection() { $(".select_zone .each_section").addClass("on"); }
function noEachSectioff() { $(".select_zone .each_section").removeClass("on"); }
function noEachSection2off() { $(".prev_img dl").addClass("off"); }
function noEachSection2on() { $(".prev_img dl").removeClass("off"); }

$(window).mousemove(function () { $(".message").addClass("on"); });
$(".come1").mouseover(function () { $(".dunopi_message").show(); });
$(".come1").mouseout(function () { $(".dunopi_message").hide(); });

// PC 보기
$(".topmenu .ico_pc").off("click.dp").on("click.dp", function(e){
  e.preventDefault();
  $(this).addClass("on").siblings().removeClass("on");
  dpToggleFrame(false);
});

// 모바일 보기
$(".topmenu .ico_mo").off("click.dp").on("click.dp", function(e){
  e.preventDefault();
  $(this).addClass("on").siblings().removeClass("on");
  dpToggleFrame(true);
  dpSetFrameWidth(375);   // 폭 바꾸면 .design_preview도 같이 줄어듦
});



function zoneRemove() {
  $(".btn_del_dunopi").click(function () { $(this).parent().remove(); });
}

$(".view_wide_small").click(function () {
  let dunopiH = $(".dunopi").height();
  let dunopiH2 = $(".content_zone").height();
  let dunopiH3 = dunopiH2 / dunopiH;
  if (dunopiH3 < 0.8) {
    $(".design_preview").css({ transform: "translate(-50%,0) scale(" + (dunopiH3 - 0.005) + ")" });
    setTimeout(function () {
      $(".design_preview .btn_del_dunopi").css({ transform: "scale(" + (1 - dunopiH3) / dunopiH3 + ")", transformOrigin: "left" });
      $(".design_preview .btn_del_dunopi ~ i").css({ transform: "scaleX(" + (1 - dunopiH3) / dunopiH3 + ")", transformOrigin: "left" });
    }, 500);
  } else {
    $(".design_preview").css({ transform: "translate(-50%,0) scale(0.8)" });
    $(".design_preview .btn_del_dunopi").css({ transform: "scale(1)" });
  }
});

$(".view_wide_big").click(function () {
  let previewAllSource = $(".content_zone .design_preview").html();
  $("body").append('<div class="previewAll"><span class="btn_preview_close">전체보기 끄기</span>' + previewAllSource + '</div>');
  $(".previewAll").slideDown(300);
  $(".btn_preview_close").click(function () {
    $(".previewAll").slideUp(300);
    setTimeout(function () { $(".previewAll").remove(); }, 300);
  });
});

$(".view_reset").click(function (e) {
  e.preventDefault();
  if ($(".previewAll").length) {
    $(".previewAll").slideUp(300);
    setTimeout(function () { $(".previewAll").remove(); }, 300);
  }
  $(".design_preview").css({ transform: "translate(-50%,0) scale(0.8)" });
  $(".design_preview .btn_del_dunopi").css({ transform: "scale(1)" });
  $(".design_preview .btn_del_dunopi ~ i").css({ transform: "scaleX(1)" });
  $(".preview_zone").removeClass("on");
  $(".view").removeClass("on");
});

$(".layout_v").click(function () {
  $(".layout_v").removeClass("on");
  $(".preview_v").addClass("on");
  $(".source_v").addClass("on");
  $(".select_zone").removeClass("on");
});

$(".source_v").click(function () {
  $(".design_preview").hide();
  $(".code_wrap").show();
  $(".code_link").show();
  $(".code_box").css({ display: "flex" });
  $(".content_zone").addClass("on");
  $(".content_source").show().addClass("on");
  $(".content_source").css({ width: "100%" });
  $(".preview_zone").removeClass("on");
  $(".view").removeClass("on");
  noEachSectioff();
  $("a.source_v").removeClass("on");
  $("a.preview_v").addClass("on");
  $("a.layout_v").addClass("on");
  if ($(window).width() <= mobileW) {
    $(".select_zone").addClass("on").removeClass("on2");
  } else {
    $(".select_zone").removeClass("on").addClass("on2");
  }
});

$(".preview_v").click(function () {
  $(".design_preview").show();
  $(".select_zone").removeClass("on2");
  $(".code_link").hide();
  $(".code_box").css({ display: "none" });
  $(".content_zone").removeClass("on");
  $(".content_source").addClass("on");
  $(".content_source").css({ width: "" });
  $(".preview_zone").removeClass("on");
  $(".view").removeClass("on");
  noEachSectioff();
  $(".option_tab a.source_v").addClass("on");
  $(".preview_v").removeClass("on");
  $(".layout_v").addClass("on");
  if ($(window).width() <= mobileW) { $(".select_zone").addClass("on"); }
});

$(".code_link a").click(function () {
  $(this).addClass("on").siblings().removeClass("on");
  let codeData = $(this).attr("data-code");
  if (codeData != "all") {
    $(".code_box > div").css({ flexGrow: 0, padding: 0 });
    $(".code_box > div." + codeData + "_code").css({ flexGrow: 1, padding: "10px" });
  } else {
    $(".code_box > div").css({ flexGrow: 1, padding: "10px" });
  }
});

$("a.reset").click(function () {
  $("a.source_v, a.preview_v, a.layout_v").removeClass("on");
  noEachSection2on();
  $(".code_link").hide();
  $(".code_box").css({ display: "none" });
  $(".design_preview").hide();
  $(".dunopi *").detach();
  $(".each_section dd").removeClass("on");
  $(".content_zone, .content_source, .preview").removeClass("on");
  $("blockquote").fadeIn(200);
  $(".option_tab").removeClass("on");
  $("a.download").slideUp(50);
  $("a.view_wide").slideUp(100);
  $(".layout_select").show();
  $(".layout_choice").hide();
  $(".preview_zone").removeClass("on");
  $(".view").removeClass("on");
  $(".select_zone").removeClass("on");
  $(".select_zone .each_section").removeClass("on");
  $(".option_tab a.source_v").removeClass("on").text("소스");
  $(".content_zone blockquote").html("일을 줄이자!!<span>FREEDOME</span>");
});

$(".view").click(function () {
  if ($(this).hasClass("on")) {
    $(this).removeClass("on");
    $(".preview_zone").removeClass("on");
    noEachSection2on();
  } else {
    $(".view").removeClass("on");
    $(this).addClass("on");
    $(".preview_zone").addClass("on");
    noEachSection2off();
  }
  for (i = 0; i < $(".preview_zone .imgs li .select_name").length; i++) {
    let dtName = $(this).siblings().find("dt").text();
    $(".preview_zone .imgs li").eq(i).find(".select_name").text(dtName + (i + 1));
  }
});

$(".preview_zone .imgs li").click(function () {
  $(this).addClass("on").siblings().removeClass("on");
});

$(".preview_zone .imgs li").dblclick(function () {
  var dtName = $(".preview_zone h2").text().toLowerCase();
  var orderIndex = $(this).index() + 1;
  $(".preview_zone").removeClass("on");
  $(".view").removeClass("on");
  loadComponent(dtName, orderIndex);
});

$(".each_section .view").click(function () {
  let eachS = $(this).siblings("dl").find("dt").text();
  $(".preview_zone h2").text(eachS);
});

if ($(window).width() <= 768) {
  $("header#dunopi_main .login").click(function () {
    $("header#dunopi_main .login").toggleClass("on");
    $("header#dunopi_main .login .login_cont").toggle(300).toggleClass("on");
  });
}

$(".topmenu.code_input a.icon_normal").click(function () {
  $(this).addClass("on").siblings().removeClass("on");
  $("#dunopi_code_input .code_box").removeClass("on2 on3");
});
$(".topmenu.code_input a.icon_height100").click(function () {
  $(this).addClass("on").siblings().removeClass("on");
  $("#dunopi_code_input .code_box").removeClass("on2 on3").addClass("on2");
});
$(".topmenu.code_input a.icon_left_right").click(function () {
  $(this).addClass("on").siblings().removeClass("on");
  $("#dunopi_code_input .code_box").removeClass("on2 on3").addClass("on3");
  $("#dunopi_code_input .code_box.on3 > div h2").mouseover(function () {
    $("#dunopi_code_input .code_box.on3 > div h2").removeClass("on");
    $(this).addClass("on");
  });
});

$(".file_upload input[type=text]").focus(function () { $(".dunopi_category_list").show(); });
$(".dunopi_category_list li").click(function () {
  let listVal = $(this).find("p").text();
  $(this).addClass("on").siblings().removeClass("on");
  $(".dunopi_category_new").val(listVal);
  if ($(".dunopi_category_new").val().length > 0) {
    $(".dunopi_category_new").addClass("on");
  }
});
$(".dunopi_category_list li").dblclick(function () { $(".dunopi_category_list").slideUp(200); });
$(".dunopi_category_new").keyup(function () {
  if ($(".dunopi_category_new").val().length <= 0) {
    $(".dunopi_category_new").removeClass("on");
  }
});
$("html").click(function (e) {
  if ($(e.target).parents(".file_upload").length < 1) {
    $(".dunopi_category_list").slideUp(200);
  }
});
$(".topmenu.code_input .file_upload input[type=file]").change(function () {
  let fileName = $(this).val().split("\\");
  $(".file_upload .filename").text(fileName[fileName.length - 1]);
});

$(installDevicePreviewBindings);
$(function(){
  dpInstallIframeBridge();   // 메시지 브릿지 켜기
});