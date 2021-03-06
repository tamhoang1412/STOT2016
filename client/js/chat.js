$(function(){
    console.log("2");
    var socket = io.connect();
    var $messageForm = $('#messageForm');
    var $message = $('#message');
    var $chat = $('#chatWindow');
    var $usernameForm = $('#usernameForm');
    var $users = $('#users');
    var $username = $('#username');
    var $error = $('#error');

    $('textarea').on('keydown', function(event) {
        if (event.keyCode == 13)
            if (!event.shiftKey) $('#usernameForm').submit();
    });

    $usernameForm.submit(function(e) {
        e.preventDefault();
        socket.emit('new user', $username.val(), function(data){
            if(data) {
                $('#namesWrapper').hide();
                $('#mainWrapper').show();
            } else {
                $error.html('Username is already taken');
            }
        });
        $username.val('');
    });
    //username
    socket.on('usernames', function(data) {
        var html='';
        for (i=0; i<data.length; i++) {
            html += data[i]+'<br>';
        }
        $users.html(html);
    });

    $messageForm.submit(function(e) {
        e.preventDefault();
        socket.emit('send message', $message.val());
        $message.val('');
    });

    socket.on('new message', function(data) {
       $chat.append('<strong>'+data.user+'</strong>: '+data.msg+'<br>').animate({scrollTop: $chat.prop("scrollHeight")},100);
    });
});