$('header nav').mouseenter(function(){
    $('.lnb').stop().fadeIn(200);
    $('.lnb_bg').stop().fadeIn(200);
});
$('header nav').mouseleave(function(){
    $('.lnb').stop().fadeOut(200);
    $('.lnb_bg').stop().fadeOut(200);
});

$('a.search').click(function(){
    $('#search').fadeIn(200);
});
$('a.btn_close').click(function(){
    $('#search').fadeOut(200);
});

$('.call').click(function(){
    $('.call').toggleClass('on');
});





var pageUrl = window.location.href;
// alert(pageUrl.indexOf('merong'))

$('.snb li a').each(function(){
    var snbHref = $(this).attr('href');   //a태그마다의 href 속성값을 구하라
    if(pageUrl.indexOf(snbHref) > -1){
        $(this).parent().addClass('on');
    };
});





var liOnLeftPos;
var liOnW;

function snbUnderline(){
    liOnLeftPos = $('.snb li.on').offset().left;
    liOnW = $('.snb li.on').width();
    $('.underline').css({left:liOnLeftPos, width:liOnW});
}

snbUnderline();

$(window).resize(function(){
    snbUnderline();
});

$('.snb li').mouseenter(function(){
    var liLeftPos =  $(this).offset().left;
    var liW = $(this).width();
    $('.underline').css({left:liLeftPos, width:liW});
});

$('.snb').mouseleave(function(){
    $('.underline').css({left:liOnLeftPos, width:liOnW});
});

var snbOnText = $('.snb li.on').text()
$('.content_box h2').html(snbOnText+'<span>YONSEI MIGEUM INTERNAL</span>');



