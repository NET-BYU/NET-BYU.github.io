$(".abstract").click(function(event) {
    var description = $(event.target).parent().next();
    description.slideToggle("slow");
});

$("#the-net > a").click(function(event) {
    if ((event.ctrlKey || event.altKey || event.metaKey) && event.shiftKey) {
        console.log(`${event.ctrlKey} || ${event.altKey} || ${event.metaKey}`);
        window.location.href = "https://www.imdb.com/title/tt0113957/";
    }
});

// $("#background_image").mousemove(function( event ) {
//   $("#background_image").css('background-position', event.pageX + 'px ' + event.pageY + 'px');
// });
