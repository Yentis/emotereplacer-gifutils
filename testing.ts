import GifUtils from './src/gifutils';

function run() {
  GifUtils.modifyGif({
    url: 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/images/663.gif',
    options: [['rotate', '45']],
    commands: { normal: [], priority: [], special: [] },
    gifsiclePath: 'C:/Users/Yentl/AppData/Roaming/BetterDiscord/plugins/gifsicle.exe'
  }).catch((error) => console.error(error));
}

setInterval(() => {
  run();
}, 1000);

process.stdin.resume();
