var urlParams;
(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
       urlParams[decode(match[1])] = decode(match[2]);
})();

if (!window.chrome) {
  alert('This page needs Google Chrome to play correctly.');
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var context = new AudioContext();

// UI elements that can be updated
 var player = document.getElementById('player');
 var rate = document.getElementById('rate');
 var meta = document.getElementById('meta');
 var pcConstraint;
var dataConstraint;

// check for required APIs
if (RTCPeerConnection) {
} else {
  alert('The required APIs are not fully supported in this browser.');
}

// configuration for peer connections
var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

// connect to the server
var socket = io.connect();

// references to the id of this listener and the id of the host.
var myId;
var to = urlParams.id;

// id of the listener is received from the server
socket.on('your-id', function(id) {
  myId = id;
  console.log('id = ' + id);
  // send logon message to the host
  socket.emit('logon', { from: myId, to: to } );
});

socket.on('error', function(message) {
  alert(message);
});

window.onbeforeunload = function(e) {
  player.pause();
  socket.emit('logoff', { from: myId, to: to } );
  for (var i=0;i<1000;i++){
      // do something unnoticable but time consuming like writing a lot to console
      console.log('buying some time to finish sending data'); 
  };
};

// creates a peer connection
pcConstraint = null;
window.pc = new RTCPeerConnection(pc_config, pcConstraint);

// creates a data channel to receive meta data
dataConstraint = null;
var dataChannel = pc.createDataChannel('mediaDescription', dataConstraint);

pc.onicecandidate = function(event) {
  socket.emit('message', { from: myId, to: to, data: { type: 'candidate', candidate: event.candidate } });
}

pc.ondatachannel = function (event) {
  console.log('Receive Channel Callback');
  dataChannel = event.channel;
  dataChannel.onmessage = onReceiveMessageCallback;
  dataChannel.onopen = onReceiveChannelStateChange;
  dataChannel.onclose = onReceiveChannelStateChange;
};

function onReceiveMessageCallback (event) {
  try {
    var mediaDescription = JSON.parse(event.data);
      meta.innerHTML = 'Listening to ' + mediaDescription.title  + '"<br /> by ' + mediaDescription.artist;
  } catch (err) {
    console.log(err);
  }
}

function updateMediaDescription() {
  console.log('media description received');
}
function onReceiveChannelStateChange() {
  var readyState = dataChannel.readyState;
  console.log('Receive channel state is: ' + readyState);
}



// when a message is received add it to the peerconnection accordingly
socket.on('message', function(message) {
  console.log('Received message: ' + JSON.stringify(message.data));
  console.log(dataChannel.readyState);
  
  if (message.data.type === 'candidate') {
    if (message.data.candidate) {
      console.log('adding an ice candidate');
      pc.addIceCandidate(new RTCIceCandidate(message.data.candidate), onAddIceCandidateSuccess, onAddIceCandidateError);
      console.log(dataChannel.readyState);
    }
  } else if (message.data.type === 'sdp') {
    console.log('setting remote description and creating answer.')
    pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
    pc.createAnswer(function(desc) {
        pc.setLocalDescription(desc);
        socket.emit('message', { from: myId, to: message.from, data: { type: 'sdp', sdp: desc} } );
      }, failedCreateAnswer);
    console.log(dataChannel.readyState);
  }
});

pc.onaddstream = gotRemoteStream;

// when a media stream is received attach it to the media element.
function gotRemoteStream(event) {
  console.log('Got remote stream.');
  attachMediaStream(player, event.stream);
  player.play();
  monitorBitrate();
  player.onloadeddata = function (event) {
    console.log(event);
  }
  player.onprogress = function (event) {
    console.log(event);
  }
}

var timestampPrev = 0;
var bytesPrev;
var monitorInterval;

function monitorBitrate() {
  if (monitorInterval) {
    timestampPrev = 0;
    bytesPrev = 0;
  }

  monitorInterval = setInterval(function() {
    if (pc.getRemoteStreams()[0]) {
      pc.getStats(function(stats) {
        var bitrateTxt = 'No bitrate stats';
        var results = stats.result();
        for (var i in results) {
          var result = results[i];
          if (!result.local || result.local === result) {
            if (result.type === 'ssrc') {
              var bytesNow = result.stat('bytesReceived');
              if (timestampPrev > 0) {
                var bitrate = Math.round((bytesNow - bytesPrev) * 8 / (result.timestamp - timestampPrev));
                if (bitrate > 0) {
                  var bitrateTxt = 'Received in ' + bitrate + ' kbits/sec';
                }  
              }
              timestampPrev = result.timestamp;
              bytesPrev = bytesNow;
            }
          }
        rate.innerHTML = bitrateTxt;
        }
      });
    }
  }, 1000);
}

 function failedCreateAnswer(error) {
  console.log("Failure callback from createAnswer: " + JSON.stringify(error));
}

function failedSetRemoteDescription(error) {
  console.log("Failure callback from setRemoteDescription: " + JSON.stringify(error));
}

function onAddIceCandidateSuccess() {
  console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
   console.log('Failed to add Ice Candidate: ' + error.toString());
}