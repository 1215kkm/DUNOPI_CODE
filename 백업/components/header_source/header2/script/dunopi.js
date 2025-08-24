$(document).ready(function(){
    $('nav > ul > li').click(function(){
        $('.lnb').slideUp();
        $(this).find('.lnb').stop().slideToggle()
    })
})


