window.onload = function(){
    window._dunopiLoaded = {
    css: new Set(),
    js:  new Set()
    };


    function _normalizeToComponents(url) {
        // 예전 경로로 적힌 자원을 components로 강제 매핑
        if (!url) return url;
        if (url.startsWith('header_source/') ||
            url.startsWith('section_source/') ||
            url.startsWith('footer_source/')) {
            return 'components/' + url;
        }
        return url;
        }

        function _absFrom(baseDir, url) {
        if (!url) return url;
        // 외부/루트는 그대로
        if (/^([a-z]+:)?\/\//i.test(url) || url.startsWith('/')) return url;
        url = _normalizeToComponents(url);
        var pageDirAbs = new URL('.', location.href).href;       // index.html 디렉토리
        var baseAbs    = new URL(baseDir, pageDirAbs).href;      // 컴포넌트 폴더 절대경로
        return new URL(url, baseAbs).href;                       // 절대 URL 반환
        }

        function _ensureCss(href) {
        if (!href) return;
        if (window._dunopiLoaded.css.has(href)) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        window._dunopiLoaded.css.add(href);
        }

        function _ensureJs(src, cb) {
        if (!src) { cb && cb(); return; }
        if (window._dunopiLoaded.js.has(src)) { cb && cb(); return; }
        var s = document.createElement('script');
        s.src = src;
        s.onload  = function(){ window._dunopiLoaded.js.add(src); cb && cb(); };
        s.onerror = function(){ console.warn('[dunopi] script load failed:', src); cb && cb(); };
        document.body.appendChild(s);
    }



    let pic = "디자인",
        soc = "소스",
        mobileW = 768,
        $codeLink = $('.code_link'),
        $codeBox = $('.code_box'),
        $check = 0,
        $dpre = $('.design_preview').css('display'),
        winW = $(window).width()


    $('*').click(function(){
        console.log(winW, $check, $dpre)
    })

    $(window).resize(function(){
        winW = $(window).width();

        if(winW <= mobileW){
            $('.select_zone').removeClass('on');
            $('.select_zone').removeClass('on2');
        }
        else if(winW > mobileW && $dpre =='block'){
            $('.preview_v').removeClass('on');
            $('.source_v').addClass('on');
        } else if(winW > mobileW && $dpre =='none'){
            $('.preview_v').addClass('on');
            $('.source_v').removeClass('on');
        }
        // if(winW <= 768){
        //     $('.select_zone').removeClass('on');
        //     if($check == 0){
        //         $('.preview_v').addClass('on')
        //     } 
        // } else if(winW > 768 && $check == 0){
        //     $('.preview_v').removeClass('on')
        // }
    })



    /* ===== 컴포넌트 로더 =====
 * 카테고리/순번을 받아서 실제 html을 불러와 .dunopi 에 삽입
 * 폴더 규칙: header_source/header{N}/header{N}.html
 *           section_source/section{N}/section{N}.html   (Slide/Section 공통)
 *           footer_source/footer{N}/footer{N}.html
 */
    function loadComponent(category, orderIndex){
  // 실제 폴더 구조에 맞게
  var map = {
    header : { root: 'components/header_source',  prefix: 'header'  },
    slide  : { root: 'components/section_source', prefix: 'section' }, // slide도 section 재사용
    section: { root: 'components/section_source', prefix: 'section' },
    footer : { root: 'components/footer_source',  prefix: 'footer'  }
  };
  var key = (category||'').toLowerCase();
  if (!map[key]) { alert('알 수 없는 카테고리: ' + category); return; }

  var num      = orderIndex;
  var baseName = map[key].prefix + num;                    // header1 / section2 / footer1
  var baseDir  = map[key].root + '/' + baseName + '/';     // 컴포넌트 폴더

  var candidates = [
    baseDir + baseName + '.html',                          // components/.../header1/header1.html
    baseDir + 'index.html',                                // components/.../header1/index.html
    map[key].root + '/' + baseName + '.html'               // components/.../header1.html (단일 파일 케이스)
  ];

  tryGet(candidates, function(raw){ injectComponent(raw, baseDir); }, function(){
    alert('컴포넌트를 불러오지 못했습니다.\n시도 경로:\n- ' + candidates.join('\n- '));
  });

  function tryGet(paths, ok, fail, i){ i = i||0; if (i >= paths.length) return fail();
    $.get(paths[i], ok).fail(function(){ tryGet(paths, ok, fail, i+1); });
  }

  function injectComponent(raw, componentBaseDir){
    var doc   = new DOMParser().parseFromString(raw, 'text/html');
    var head  = doc.head || doc.querySelector('head');
    var body  = doc.body || doc;

    // ① CSS 수집 → 절대경로화 → <head>에 장착
    var cssHrefs = [];
    (head ? head.querySelectorAll('link[rel="stylesheet"][href]') : []).forEach(function(el){ cssHrefs.push(el.getAttribute('href')); });
    body.querySelectorAll('link[rel="stylesheet"][href]').forEach(function(el){ cssHrefs.push(el.getAttribute('href')); });
    cssHrefs.map(function(h){ return _absFrom(componentBaseDir, h); }).forEach(_ensureCss);
    // 내장 <style>은 그대로 복제해서 <head>로 이동
    (head ? head.querySelectorAll('style') : []).forEach(function(el){ document.head.appendChild(el.cloneNode(true)); });
    body.querySelectorAll('style').forEach(function(el){ document.head.appendChild(el.cloneNode(true)); });

    // ② 외부 JS 수집 → 절대경로화 → 로드
    var jsSrcs = [];
    (head ? head.querySelectorAll('script[src]') : []).forEach(function(el){ jsSrcs.push(el.getAttribute('src')); });
    body.querySelectorAll('script[src]').forEach(function(el){ jsSrcs.push(el.getAttribute('src')); });
    jsSrcs = jsSrcs.map(function(s){ return _absFrom(componentBaseDir, s); });

    // ③ 인라인 스크립트 수집 (나중에 실행)
    var inlineScripts = [];
    (head ? head.querySelectorAll('script:not([src])') : []).forEach(function(el){ inlineScripts.push(el.textContent); });
    body.querySelectorAll('script:not([src])').forEach(function(el){ inlineScripts.push(el.textContent); });

    // ④ 바디 콘텐츠에서 link/script는 제거(중복 로딩 방지) 후 DOM 붙이기
    $(body).find('link,script').remove();
    var wrapped = $('<div class="dunopi_zone"><span class="btn_del_dunopi">삭제</span><i></i></div>');
    wrapped.append($(body).contents());
    $('.dunopi').append(wrapped);

    // ⑤ 외부 JS들을 순차 로딩 후 인라인 스크립트 실행
    (function loadNext(i){
      if (i >= jsSrcs.length) {
        inlineScripts.forEach(function(code){ $.globalEval(code); });
        zoneRemove(); // 삭제 버튼 바인딩(초기코드 함수)
        return;
      }
      _ensureJs(jsSrcs[i], function(){ loadNext(i+1); });
    })(0);
  }
}




    /* 우측 썸네일 선택 */
    $('.each_section dd').click(function(e){
        e.preventDefault();

        var cateName   = $(this).siblings('dt').text().toLowerCase(); // header/slide/section/footer
        var orderIndex = $(this).prevAll('dd').length + 1;


        // (초기코드의 UI 토글 로직은 그대로 둡니다)
        $('.design_preview').show();
        $('.content_source').addClass('on');
        $(this).toggleClass('on').siblings().removeClass('on');
        $('a.download').slideDown(50);
        $('a.view_wide').slideDown(100);
        $('blockquote').fadeOut(200);
        $('.source_v').addClass('on');
        if($(window).width() <= mobileW){ $('.preview_v').addClass('on'); }

        // 실제 컴포넌트 로드
        loadComponent(cateName, orderIndex);
    });




    

    /* 처음 레이아웃 선택 */
    $('.layout_select li').click(function(){
        $('.layout_select').hide()
        var layoutPic = $(this).find('figure').html();
        var layoutName = $(this).find('h3').text();

        $('.layout_choice figure').html(layoutPic)
        $('.layout_choice h3').text(layoutName);
        $('.layout_choice').show();
    })


    //each_section 비활성
    function noEachSection(){
        $('.select_zone .each_section').addClass('on')
    }function noEachSectioff(){
        $('.select_zone .each_section').removeClass('on')
    }
    function noEachSection2off(){
        $('.prev_img dl').addClass('off')
    }
    function noEachSection2on(){
        $('.prev_img dl').removeClass('off')
    }


    //



    $(window).mousemove(function(){
        $('.message').addClass('on')
    })


    //$('.come1').click(function(){
        // let compMsg = "";
        // compMsg += "<div class='dunopi_message'>"
        // compMsg += "개인, 상업, 다 무료"
        // compMsg += "</div>"

        // $('.content_zone blockquote').html('개인, 상업, 다 무료<span>Free for All</span>')
        // alert('개인, 상업, 다 무료\nFree for All')
    //})


    $('.come1').mouseover(function(){
        $('.dunopi_message').show();
    });
    $('.come1').mouseout(function(){
        $('.dunopi_message').hide();
    })



    /* 화면크기 조절 */
    $('.topmenu .ico_pc').click(function(){
        $('.design_preview').css({width:'100%'})
        $(this).addClass('on').siblings().removeClass('on')
    })
    $('.topmenu .ico_mo').click(function(){
        //if($codeBox.length <= 0 ){
            $('.design_preview').css({width:'20%'});
            $(this).addClass('on').siblings().removeClass('on')
        //}
    })








    
    function zoneRemove(){
        $('.btn_del_dunopi').click(function(){
            $(this).parent().remove();
        })
    }



    /* 미리보기화면 전체보기 */
    $('.view_wide_small').click(function(){
        let dunopiH = $(".dunopi").height();
        let dunopiH2 = $(".content_zone").height();
        let dunopiH3 = dunopiH2/dunopiH
        console.log(dunopiH3)

        if(dunopiH3 < 0.8){
            $(".design_preview").css({transform:'translate(-50%,0) scale('+(dunopiH3-0.005)+')'});
            setTimeout(function(){
                $('.design_preview .btn_del_dunopi').css({transform:'scale('+((1-dunopiH3)/dunopiH3)+')', transformOrigin:'left'});
                $('.design_preview .btn_del_dunopi ~ i').css({transform:'scaleX('+((1-dunopiH3)/dunopiH3)+')', transformOrigin:'left'});
            },500)
            

        } else {
            $(".design_preview").css({transform:'translate(-50%,0) scale(0.8)'})
            $('.design_preview .btn_del_dunopi').css({transform:'scale(1)'});
        }



        // let headerLength = $('#header_dunopi .dunopi_zone').children().length;
        // let sectionLength = $('#section_dunopi .dunopi_zone').children().length;
        // let footerLength = $('#footer_dunopi .dunopi_zone').children().length;
        // let allH = headerLength + sectionLength + footerLength;
        // console.log(headerLength, sectionLength, footerLength);
        // let txt = $(this).html();
        // if(txt == '전체<br>보기'){
        //     $(this).html('기본<br>보기')
        // } else {
        //     $(this).html('전체<br>보기')
        // }

        // if(allH < 3){
        //     $('.content_zone .design_preview').toggleClass('on on8')
        // } 
        // if (allH >= 3 && allH < 4){
        //     $('.content_zone .design_preview').toggleClass('on on6')
        // } else if (allH >= 4 && allH < 5){
        //     $('.content_zone .design_preview').toggleClass('on on5')
        // } else if (allH >= 5 && allH < 6){
        //     $('.content_zone .design_preview').toggleClass('on on3')
        // } else if (allH >= 6 && allH < 7){
        //     $('.content_zone .design_preview').toggleClass('on on3')
        // } else if (allH >= 7 && allH < 8){
        //     $('.content_zone .design_preview').toggleClass('on on3')
        // } else if (allH >= 8 && allH < 10){
        //     $('.content_zone .design_preview').toggleClass('on on2')
        // } else if (allH >= 10 && allH < 12){
        //     $('.content_zone .design_preview').toggleClass('on on15')
        // } else if (allH >= 12 && allH < 14){
        //     $('.content_zone .design_preview').toggleClass('on on13')
        // } else if (allH >= 14){
        //     $('.content_zone .design_preview').toggleClass('on on1')
        // } 


    });




    
    /* 미리보기화면 100%보기 */
    $('.view_wide_big').click(function(){
        let previewAllSource = $('.content_zone .design_preview').html();
        $('body').append('<div class="previewAll"><span class="btn_preview_close">전체보기 끄기</span>'+previewAllSource+'</div>')
        $('.previewAll').slideDown(300);


        // let closeW = $('.btn_preview_close').width();
        // let closeH = $('.btn_preview_close').height();


        // let scrT = $('.previewAll').scrollTop();
        // $('.previewAll').scroll(function(){
        //     scrT = $('.previewAll').scrollTop();
        // });
        // $(window).mousemove(function(e){
        //     $('.btn_preview_close').css({left:e.pageX - closeW/2, top:e.pageY + scrT - closeH/2})
        // });

        $('.btn_preview_close').click(function(){
            $('.previewAll').slideUp(300)
            setTimeout(function(){
                $('.previewAll').remove()
            },300)
            console.log('scrT')
    
        });
        
    });



    /* 크게보기 = 전체보기 모드 해제(초기 편집 화면으로 복귀) */
    $('.view_reset').click(function(e){
        e.preventDefault();

        // 1) 전체보기 오버레이가 떠있다면 닫기(기존 close 로직과 동일하게 제거)
        if($('.previewAll').length){
            $('.previewAll').slideUp(300);
            setTimeout(function(){
                $('.previewAll').remove();
            }, 300);
        }

        // 2) 디자인 미리보기 배율/보조버튼 스케일 원복
        $(".design_preview").css({transform:'translate(-50%,0) scale(0.8)'}); // 초기 CSS 값
        $('.design_preview .btn_del_dunopi').css({transform:'scale(1)'});
        $('.design_preview .btn_del_dunopi ~ i').css({transform:'scaleX(1)'});

        // 3) 기타 전체보기 관련 보조 UI 상태 정리(있으면)
        $('.preview_zone').removeClass('on');
        $('.view').removeClass('on');
    });


    /* 구성선택 */
    $('.layout_v').click(function(){
        $('.layout_v').removeClass('on');
        $('.preview_v').addClass('on');
        $('.source_v').addClass('on');
        $('.select_zone').removeClass('on');
        
    });

    /* 소스보기 */ 
    $('.source_v').click(function(){
        // $('.source_v').hide();
        // $('.preview_v').show();


        $('.design_preview').hide();
        $('.code_wrap').show();

        $codeLink.show();
        $codeBox.css({display:'flex'});
        $('.content_zone').addClass('on');
        $('.content_source').show().addClass('on');            
        $('.content_source').css({width:'100%'});
        $codeBox.show();
        
        $('.preview_zone').removeClass('on');
        $('.view').removeClass('on');
        
        noEachSectioff();
        $('a.source_v').removeClass('on');
        $('a.preview_v').addClass('on');
        $('a.layout_v').addClass('on');
        /*if($('.option_tab a.source_v').hasClass('on')){
            $(this).text(pic);
        } else {
            $(this).text(soc);
            $('.select_zone .each_section').removeClass('on')
        } */
        if(winW <= mobileW){
            $('.select_zone').addClass('on');
            $('.select_zone').removeClass('on2');
        } else {
            $('.select_zone').removeClass('on');
            $('.select_zone').addClass('on2');
        }
    });




    /* 디자인보기 */
    $('.preview_v').click(function(){
        // $('.source_v').show();
        // $('.preview_v').hide();
        
        $('.design_preview').show();
        $('.select_zone').removeClass('on2');
        
        $codeLink.hide();
        $codeBox.css({display:'none'});
        $('.content_zone').removeClass('on');
        $('.content_source').addClass('on');            
        $('.content_source').css({width:''});
        $codeBox.hide();
        
        $('.preview_zone').removeClass('on');
        $('.view').removeClass('on');
        
        noEachSectioff();
        $('.option_tab a.source_v').addClass('on');

        
        $('.preview_v').removeClass('on');
        $('.layout_v').addClass('on');
        if(winW <= mobileW){
            $('.select_zone').addClass('on');
        };
    });





    $('.code_link a').click(function(){
        $(this).addClass('on').siblings().removeClass('on')
        let codeData = $(this).attr('data-code');
        if(codeData != 'all'){
            $('.code_box > div').css({flexGrow:0, padding:0})
            $('.code_box > div.'+codeData+'_code').css({flexGrow:1, padding:'10px'})
        } else {
            $('.code_box > div').css({flexGrow:1, padding:'10px'})
        }
    });


    // 처음부터
    $('a.reset').click(function(){
        // $('.source_v').show();
        // $('.preview_v').hide();

        $('a.source_v').removeClass('on');
        $('a.preview_v').removeClass('on');
        $('a.layout_v').removeClass('on');
        noEachSection2on()

        $codeLink.hide();
        $codeBox.css({display:'none'});
        
        $('.design_preview').hide();
        
        $('.dunopi *').detach();
        
        $('.each_section dd').removeClass('on')
        $('.content_zone').removeClass('on');
        $('.content_source').removeClass('on');
        $('.preview').removeClass('on');
        $('blockquote').fadeIn(200);
        $('.option_tab').removeClass('on');

        $('a.download').slideUp(50);
        $('a.view_wide').slideUp(100);
        
        $('.layout_select').show();
        $('.layout_choice').hide();
        
        $('.preview_zone').removeClass('on');
        $('.view').removeClass('on');
        $('.select_zone').removeClass('on')
        
        $('.select_zone .each_section').removeClass('on')


        $('.option_tab a.source_v').removeClass('on').text(soc);
        
        $('.content_zone blockquote').html('일을 줄이자!!<span>FREEDOME</span>');
    });


    
    //미리보기이미지 많이 더보기
    $('.view').click(function(){

        if($(this).hasClass('on')){
            $(this).removeClass('on');
            $('.preview_zone').removeClass('on');
            noEachSection2on()

        } else {
            $('.view').removeClass('on');
            $(this).addClass('on');
            $('.preview_zone').addClass('on');
            noEachSection2off()
        }

        // $('.preview_zone').toggleClass('on')
        // $('.preview_zone').toggle()

            

        for (i = 0; i < $('.preview_zone .imgs li .select_name').length; i++){
            let dtName = $(this).siblings().find('dt').text();
            $('.preview_zone .imgs li').eq(i).find('.select_name').text(dtName+(i+1))
        }
    });



    /* 미리보기 이미지 선택 */
    $('.preview_zone .imgs li').click(function(){
        $(this).addClass('on').siblings().removeClass('on')
    });

    
    /* 프리뷰 갤러리에서 더블클릭 → 실제 컴포넌트 삽입 */
    $('.preview_zone .imgs li').dblclick(function(){
        var dtName    = $('.preview_zone h2').text().toLowerCase(); // 현재 카테고리 타이틀
        var orderIndex= $(this).index() + 1;
        $('.preview_zone').removeClass('on');
        $('.view').removeClass('on');
        loadComponent(dtName, orderIndex);
    });





    $('.each_section .view').click(function(){
        let eachS = $(this).siblings('dl').find('dt').text();
        $('.preview_zone h2').text(eachS)
    });


    // $('.login').click(function(){
    //     alert('준비중')
    // });


    if(winW <= mobileW){
        loginBox();
    }
    function loginBox(){
        $('header#dunopi_main .login').click(function(){
            $('header#dunopi_main .login').toggleClass('on')
            $('header#dunopi_main .login .login_cont').toggle(300).toggleClass('on')
        })
    };





    $('.topmenu.code_input a.icon_normal').click(function(){
        $(this).addClass('on').siblings().removeClass('on');
        $('#dunopi_code_input .code_box').removeClass('on2 on3');
    })
    $('.topmenu.code_input a.icon_height100').click(function(){
        $(this).addClass('on').siblings().removeClass('on');
        $('#dunopi_code_input .code_box').removeClass('on2 on3').addClass('on2');
    })
    $('.topmenu.code_input a.icon_left_right').click(function(){
        $(this).addClass('on').siblings().removeClass('on');
        $('#dunopi_code_input .code_box').removeClass('on2 on3').addClass('on3');

            
        $('#dunopi_code_input .code_box.on3 > div h2').mouseover(function(){
            $('#dunopi_code_input .code_box.on3 > div h2').removeClass('on')
            $(this).addClass('on');
        })
    })

    $('.file_upload input[type=text]').focus(function(){
        $('.dunopi_category_list').show();
    });

    $('.dunopi_category_list li').click(function(){
        let listVal = $(this).find('p').text();

        $(this).addClass('on').siblings().removeClass('on')
        $('.dunopi_category_new').val(listVal);

        // $('.dunopi_category_list').slideUp(200);

        if($('.dunopi_category_new').val().length > 0){
            $('.dunopi_category_new').addClass('on')
        }
    });

    $('.dunopi_category_list li').dblclick(function(){
        $('.dunopi_category_list').slideUp(200);
    })

    $('.dunopi_category_new').keyup(function(){
        console.log($('.dunopi_category_new').val().length)
        if($('.dunopi_category_new').val().length <= 0){
            $('.dunopi_category_new').removeClass('on')
        }
    });

    $('html').click(function(e){
        if($(e.target).parents('.file_upload').length < 1){
            $('.dunopi_category_list').slideUp(200);
        }
    });

    $('.topmenu.code_input .file_upload input[type=file]').change(function(){
        let fileName = $(this).val();
            fileName = fileName.split('\\');
            fileNameLength = fileName.length
            fileName = fileName[fileNameLength - 1]
        $('.file_upload .filename').text(fileName)
    })

}
