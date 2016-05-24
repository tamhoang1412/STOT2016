// references to UI elements that need to be updated
var holder = document.getElementById('holder');
var state = document.getElementById('status');
var room = document.getElementById('room');
var counter = document.getElementById('counter');
var meta = document.getElementById('meta');
var pcConstraint;
var dataConstraint;

(function(){
  new Clipboard('#copy-button');
})();
// Check for the various File API support.
if (window.File
&& window.FileReader
&& window.FileList
&& window.Blob
&& RTCPeerConnection
&& (window.AudioContext || window.webkitAudioContext)) {

window.AudioContext = window.AudioContext || window.webkitAudioContext;

if (navigator.webkitGetUserMedia) {
  state.className = 'success';
  state.innerHTML = 'All the required APIs are available.'
} else {
  state.className = 'fail';
  state.innerHTML = 'This demo requires Chrome for playing mp3 encoded media.'
}
} else {
state.className = 'fail';
}

// handle file drops
holder.ondragover = function () { this.className = 'hover'; return false; };
holder.ondragend = function () { this.className = ''; return false; };
holder.ondrop = handleFileDrop;

// socket connection to the signalling server
var socket = io.connect();

// setup media objects
var context = new AudioContext();
var currentStream;
var gainNode = context.createGain();
var mediaSource, mediaBuffer, remoteDestination, mediaDescription;
var muted, start, stop;
gainNode.connect(context.destination);

// webrtc connection configuration
var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

// keep track of peers and the id of this session
var peers = {};
var myId;

// after connecting to the server an ID for this session is received and saved.
socket.on('your-id', function(id) {
myId = id;
console.log('id = ' + id);
var clientURL = window.location.protocol + '//' + window.location.host + '/listen.html?id=' + myId;
room.innerHTML = clientURL;
});

socket.on('disconnected', function(from) {
peers[from] = undefined;
});

// when a listener logs on to the sessions we'll setup webrtc signalling for the session and check if we can start
// streaming media
socket.on('logon', function(message) {
console.log("log on");
pcConstraint = null;
window.pc = new RTCPeerConnection(pc_config, pcConstraint);



var from = message.from;
peers[from] = { peerconnection: pc, stream: undefined };

// create a data channel for sending the media description
dataConstraint = null;
peers[from].dataChannel = peers[from].peerconnection.createDataChannel('mediaDescription', dataConstraint);
pc.onicecandidate = function(event) {
  socket.emit('message', { from: myId, to: message.from, data: { type: 'candidate', candidate: event.candidate } } );  
}

peers[from].dataChannel.onopen = sendMediaDescription(peers[from].dataChannel);



peers[from].dataChannel.onopen = function() {
  startPlayingIfPossible(from);
};

peers[from].peerconnection.createOffer(function(desc) {
  gotDescription(from, desc);
}, failed);

counter.innerHTML = Object.keys(peers).length;
});

// when a listener leaves remove the rtc stream for that peer
socket.on('logoff', function(message) {
console.log('received logoff message');

try {
  peers[message.from].peerconnection.removeStream(peers[message.from].stream);
} catch (err) {

}

  peers[message.from].stream = undefined;
  delete peers[message.from];
counter.innerHTML = Object.keys(peers).length;
});

// when a message is received from a listener we'll update the rtc session accordingly
socket.on('message', function(message) {
console.log('Received message: ' + JSON.stringify(message.data));
if (message.data.type === 'candidate') {
  if (message.data.candidate) {
    peers[message.from].peerconnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
    console.log("candidate" + peers[message.from].dataChannel.readyState);
  }
} else if (message.data.type === 'sdp') {
  peers[message.from].peerconnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
  console.log("sdp" + peers[message.from].dataChannel.readyState);
}
});

// is called when SDP is received from a connected listener
function gotDescription(from, desc) {
peers[from].peerconnection.setLocalDescription(desc);
socket.emit('message', { from: myId, to: from, data: { type: 'sdp', sdp: desc } });
}

// checks if media is present and starts streaming media to a connected listener if possible
function startPlayingIfPossible(from) {
// add the stream to the peerconnection for this connection
if (mediaSource && remoteDestination) {
  var constraints = { mandatory: {}, optional: [] };
  // constraints.optional[0] = { 'bandwidth' : 100 }; // does not seem to influence quality
  peers[from].peerconnection.addStream(remoteDestination.stream, constraints);
  peers[from].stream = remoteDestination.stream;
  peers[from].peerconnection.createOffer(function(desc) {
    gotDescription(from, desc);
  }, failed);
  sendMediaDescription(peers[from].dataChannel);
}
}

// Sends media meta information over a rtc data channel to a connected listener

function sendMediaDescription(channel) {
console.log(mediaDescription);
channel.readyState = 'open';
if (mediaDescription && channel.readyState === 'open') {
  var data = JSON.stringify(mediaDescription);
  channel.send(data);
}
}

function onDataChannelOpen() {
sendMediaDescription(this);
}

function failed(code) {
  log("Failure callback: " + code);
}

// is called when a file is dropped in the drop zone
function handleFileDrop(event) {
  // stop the current stream.
  //stopStream();

this.className = '';
event.preventDefault();
var file = event.dataTransfer.files[0];
mediaDescription = {};

// load the meta-data from the mp3
ID3.loadTags(file.name, function() {
  mediaDescription.artist = 'Unknown';
    mediaDescription.title = 'Untitled';

    var tags = ID3.getAllTags(file.name);
    console.log(tags.artist + " - " + tags.title + ", " + tags.album);

    mediaDescription.artist = tags.artist;
    mediaDescription.title = tags.title;

    if ('picture' in tags) {
      var image = tags.picture;

      mediaDescription.image = {};
      mediaDescription.image.format = image.format;
      mediaDescription.image.size = image.data.length;

      // mediaDescription.image.base64 = Base64.encodeBytes(image.data);

      holder.style.background = 'url("data:' + image.format + ';base64,' + Base64.encodeBytes(image.data) + '") no-repeat center';
    } else {
      holder.style.background = 'url("res/no-artwork.png")';
    }

    holder.style.backgroundSize = "295px 295px";

    meta.innerHTML = 'Playing "' + mediaDescription.title + '"<br /> by ' + mediaDescription.artist;
}, { 
  tags: ["artist", "title", "album", "year", "comment", "track", "genre", "lyrics", "picture"],
  dataReader: new FileAPIReader(file)
});

if (file.type.match('audio*')) {
  var reader = new FileReader();
  // read the mp3 and decode the audio.
  reader.onload = (function(readEvent) {
    context.decodeAudioData(readEvent.target.result, function(buffer) {
      if (mediaSource) {
        mediaSource.stop(0);
      }
      mediaBuffer = buffer;
      playStream();
      start = Date.now();
    });
  });
  reader.readAsArrayBuffer(file);
}
return false;
}

// starts playing a media stream from a given offset.
function playStream(offset) {
  offset = offset ? offset : 0;
  mediaSource = context.createBufferSource();
  mediaSource.buffer = mediaBuffer;
  mediaSource.start(0, offset / 1000);
  mediaSource.connect(gainNode);
  // setup remote stream
  remoteDestination = context.createMediaStreamDestination();
  mediaSource.connect(remoteDestination);

  for (var peer in peers) {
    startPlayingIfPossible(peer);
  }
}

// stops playing the stream and removes the stream from peer connections
function stopStream() {
  for (var peer in peers) {
    if (peers[peer].stream) {
      peers[peer].stream.stop();
      peers[peer].peerconnection.removeStream(peers[peer].stream);
      peers[peer].stream = undefined;
    }
  }
  if (mediaSource) mediaSource.stop(0);
}