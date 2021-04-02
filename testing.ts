import GifUtils from './src/gifutils';

function run() {
  GifUtils.modifyGif({
    url: 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/images/663.gif',
    options: [['spin']],
    commands: { normal: [], priority: [], special: [] },
    gifsiclePath: '<gifsicle absolute path here>'
  }).catch((error) => console.error(error));
}

setInterval(() => {
  run();
}, 1000);

process.stdin.resume();
