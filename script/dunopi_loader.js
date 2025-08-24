// ====== 설정 ======
const PLACEHOLDER_IMAGE_URL = '/images/img_none.jpg'; // 같은 오리진 경로
const CORE_CSS = ['css/reset.css','css/dunopi_wrap.css'];
const CORE_JS  = []; // 필요시 추가

// ====== 유틸 ======
async function _getArrayBuffer(url){ 
  const r = await fetch(url,{cache:'no-cache'}); 
  if(!r.ok) throw new Error(url); 
  return await r.arrayBuffer(); 
}
async function _getText(url){ 
  const r = await fetch(url,{cache:'no-cache'}); 
  if(!r.ok) throw new Error(url); 
  return await r.text(); 
}
const _isHttp = u => /^https?:\/\//i.test(u);
const _sameOrigin = u => _isHttp(u) ? u.startsWith(location.origin) : !u.startsWith('/');
function _safePath(url){ return url.replace(location.origin + '/', ''); }
function _uniq(arr){ return [...new Map(arr.map(v=>[v,v])).values()]; }

// CSS @import 재귀 펼치기 → 개별 파일도 ZIP에 저장 (상대경로 보존)
async function _collectCssWithImports(zip, absUrl, seen=new Set(), outFiles=[]){
  if (seen.has(absUrl)) return outFiles;
  seen.add(absUrl);

  const base = new URL('.', absUrl).href;
  let css = await _getText(absUrl);

  // 추출: @import url("...") media...
  const re = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/gi;
  let m, last = 0, output = '';
  while((m = re.exec(css)) !== null){
    output += css.slice(last, m.index);
    const url = m[2] || m[4]; 
    const media = (m[5] || '').trim();
    const childAbs = new URL(_normalizeToComponents(url), base).href;
    await _collectCssWithImports(zip, childAbs, seen, outFiles);
    last = re.lastIndex;
  }
  output += css.slice(last);

  // ZIP 경로(원래 경로 그대로 assets/ 밑에 저장)
  if (_sameOrigin(absUrl)){
    const rel = _safePath(absUrl);
    const dst = 'assets/' + rel;
    zip.file(dst, output);
    outFiles.push({ href: rel }); // HTML에서 'assets/' 붙여서 씀
  }else{
    outFiles.push({ href: absUrl });
  }
  return outFiles;
}

// 파일 복사(helper)
async function _zipCopyFile(zip, absUrl){
  const rel = _safePath(absUrl);
  const dst = 'assets/' + rel;
  const buf = await _getArrayBuffer(absUrl);
  zip.file(dst, buf);
  return rel; // html에서 쓸 상대경로
}

// placeholder 준비
async function _preparePlaceholder(zip){
  if (!PLACEHOLDER_IMAGE_URL) return null;
  const abs = _absFrom('.', PLACEHOLDER_IMAGE_URL);
  if (_sameOrigin(abs)){
    const rel = await _zipCopyFile(zip, abs);
    return rel; // e.g. images/img_none.jpg
  }else{
    return abs;
  }
}


// ====== 다운로드 핸들러 ======
function initDownload(){
$("a.download").off("click").on("click", async function(e){
  e.preventDefault();

  const $zones = $(".dunopi .dunopi_zone");
  if (!$zones.length){ alert("추가된 컴포넌트가 없습니다."); return; }

  const zip = new JSZip();

  const htmlParts = [];
  let cssHrefs = [];
  let jsSrcs   = [];
  let inlineCssAll = [];
  let inlineJsAll  = [];

  // 🔹 reset.css 강제 포함
  const resetRel = await _zipCopyFile(zip, _absFrom('.', '/css/reset.css'), 'common/css/reset.css');
  cssHrefs.push('common/css/reset.css');

  // 🔹 Placeholder 파일 강제 포함
  const placeholderRel = await _zipCopyFile(zip, _absFrom('.', '/images/img_none.jpg'), 'common/images/img_none.jpg');

  // 🔹 본문 처리
  for (const el of $zones){
    const $z = $(el);
    const $clone = $z.clone();
    $clone.find(".btn_del_dunopi, i").remove();

    // 이미지 src → placeholder로 교체
    $clone.find("img[src]").each(function(){
      this.setAttribute("src", "assets/" + placeholderRel);
      this.style.maxWidth = "100%";
      this.style.height   = "auto";
    });

    htmlParts.push($clone.html());

    ($z.data("dpCss") || []).forEach(h => cssHrefs.push(h));
    ($z.data("dpJs")  || []).forEach(s => jsSrcs.push(s));
    inlineCssAll = inlineCssAll.concat($z.data("dpInlineCss") || []);
    inlineJsAll  = inlineJsAll.concat($z.data("dpInlineJs")  || []);
  }

  cssHrefs = [...new Set(cssHrefs)];
  jsSrcs   = [...new Set(jsSrcs)];

  // 🔹 CSS 링크 태그
  const linkCssTags = cssHrefs.map(h => 
    h.startsWith('http') ? 
      `<link rel="stylesheet" href="${h}">` : 
      `<link rel="stylesheet" href="assets/${h}">`
  );

  if (inlineCssAll.length){
    const cssText = inlineCssAll.join('\n');
    zip.file('assets/inline/inline.css', cssText);
    linkCssTags.push(`<link rel="stylesheet" href="assets/inline/inline.css">`);
  }

  // 🔹 JS 링크 태그
  const scriptTags = [];
  for (const src of jsSrcs){
    const abs = _absFrom('.', src);
    if (_sameOrigin(abs)){
      const rel = await _zipCopyFile(zip, abs);
      scriptTags.push(`<script src="assets/${rel}"></script>`);
    } else {
      scriptTags.push(`<script src="${src}"></script>`);
    }
  }

  if (inlineJsAll.length){
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

  const blob = await zip.generateAsync({type:'blob'});
  saveAs(blob, 'dunopi-assembled.zip');
});

}

// 전역으로 내보내기
window.DUNOPI_LOADER = { initDownload };







// _absFrom 함수 추가 (원본 코드에 없어서 추가)
function _absFrom(base, url) {
  try {
    return new URL(url, new URL(base, location.href)).href;
  } catch (e) {
    return url;
  }
}


// ZIP에 파일 복사 (원래 경로 → assets/ 경로)
async function _zipCopyFile(zip, absUrl, targetPath=null){
  const buf = await _getArrayBuffer(absUrl);
  let rel = _safePath(absUrl);

  if (targetPath) {
    rel = targetPath; // 내가 원하는 위치로 강제
  }

  zip.file('assets/' + rel, buf);
  return rel;
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

    $(".each_section dd").click(function (e) {
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
    function noEachSectioff(){ $(".select_zone .each_section").removeClass("on"); }
    function noEachSection2off(){ $(".prev_img dl").addClass("off"); }
    function noEachSection2on(){ $(".prev_img dl").removeClass("off"); }

    $(window).mousemove(function () { $(".message").addClass("on"); });
    $(".come1").mouseover(function () { $(".dunopi_message").show(); });
    $(".come1").mouseout(function () { $(".dunopi_message").hide(); });

    $(".topmenu .ico_pc").click(function () {
        $(".design_preview").css({ width: "100%" });
        $(this).addClass("on").siblings().removeClass("on");
    });
    $(".topmenu .ico_mo").click(function () {
        $(".design_preview").css({ width: "20%" });
        $(this).addClass("on").siblings().removeClass("on");
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
        $("body").append('<div class="previewAll"><span class="btn_preview_close">전체보기 끄기</span>'+ previewAllSource +'</div>');
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
