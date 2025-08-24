$('.snb > li').click(function(){
    $(this).children('ul').show();
    return false
});

$('.snb li').mouseout(function(){
    $('.snb li ul').hide();
});

$('.snb li ul').mouseover(function(){
    $(this).show()
})