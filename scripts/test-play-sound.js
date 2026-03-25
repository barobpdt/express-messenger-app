/*
import player from 'play-sound'
player().play('../public/data/sfx/ding.wav') 

// To use mplayer specifically (skips availability checks)
var mplayer = require('play-sound')({ player: 'mplayer' });
mplayer.play('foo.mp3', function(err){
  if (err) throw err;
});
import { playAudioFile } from 'audic';
await playAudioFile('../public/data/sounds/sample01.mp3');
*/

import Audic from 'audic';
const audic = new Audic('../public/data/sounds/sample01.mp3');
await audic.play();
audic.addEventListener('ended', () => {
  audic.destroy();
});
