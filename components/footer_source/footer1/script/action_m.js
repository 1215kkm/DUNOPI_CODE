$('header nav i.fa-bars').click(function(){
    $('.lnb_bg').fadeToggle(200);
    $('nav').toggleClass('on');
    $('.lnb').slideUp();
    $('nav > ul > li').removeClass('on');
});

$('nav > ul > li').click(function(){
    $('.lnb').slideUp();
    $('nav > ul > li').removeClass('on');
    $(this).toggleClass('on').find('.lnb').stop().slideToggle();
})