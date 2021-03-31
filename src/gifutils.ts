import toStream from 'buffer-to-stream';
import bent from 'bent';
import { Stream } from 'stream';
import Gifsicle from './gifsicle-stream';
import SpecialCommand from './classes/specialCommand';
import {
  infiniteEmote,
  rainbowEmote,
  rainEmote,
  rotateEmote,
  shakeEmote,
  slideEmote,
  spinEmote,
  wiggleEmote
} from './gifhelper';

interface Command {
  name: string,
  param?: string | number
}

interface Data {
  url: string,
  options: (string | number)[][],
  commands: { normal: Command[], special: Command[], priority: Command[] }
  gifsiclePath: string
}

function getCommands(options: Data['options']): Data['commands'] {
  const normal: Command[] = [];
  const special: Command[] = [];
  const priority: Command[] = [];

  options.forEach((option) => {
    switch (option[0]) {
      case 'resize': {
        const command: Command = {
          name: '--scale',
          param: option[1]
        };

        const split = command.param?.toString().split('x');
        const shouldProcessAfter = split?.some((axis) => parseFloat(axis) > 1) === true;

        if (shouldProcessAfter) {
          normal.push(command);
        } else {
          priority.push(command);
        }
        break;
      }
      case 'reverse': {
        normal.push({ name: '#-1-0' });
        break;
      }
      case 'flip':
        normal.push({ name: '--flip-horizontal' });
        break;
      case 'flap':
        normal.push({ name: '--flip-vertical' });
        break;
      case 'speed': {
        const param = option[1].toString();
        normal.push({ name: `-d${Math.max(2, parseFloat(param))}` });
        break;
      }
      case 'hyperspeed':
        normal.push({ name: 'hyperspeed' });
        break;
      case 'rotate':
        special.push({ name: option[0], param: option[1] });
        break;
      case 'wiggle': {
        let size = 2;

        if (option[1]) {
          const sizeName = option[1];

          if (sizeName === 'big') size = 4;
          else if (sizeName === 'bigger') size = 6;
          else if (sizeName === 'huge') size = 10;
        }

        special.push({ name: option[0], param: size });
        break;
      }
      case 'rain':
        special.push({ name: option[0], param: option[1] === 'glitter' ? 1 : 0 });
        break;
      case 'spin':
      case 'spinrev':
      case 'shake':
      case 'rainbow':
      case 'infinite':
      case 'slide':
      case 'sliderev': {
        let speed = 8;

        if (option[1]) {
          const speedName = option[1];

          if (speedName === 'fast') speed = 6;
          else if (speedName === 'faster') speed = 4;
          else if (speedName === 'hyper') speed = 2;
        }

        special.push({ name: option[0], param: speed });
        break;
      }
      default:
        break;
    }
  });

  return {
    normal,
    special,
    priority
  };
}

async function modifyGif(
  data: string | Buffer,
  options: Command[],
  gifsiclePath: string,
  _retryCount = 0
): Promise<Buffer> {
  if (data.length === 0) {
    return Buffer.concat([]);
  }
  let retryCount = _retryCount;

  const gifsicleParams: string[] = [];
  options.forEach((option) => {
    gifsicleParams.push(option.name);
    if (option.param) {
      gifsicleParams.push(option.param.toString());
    }
  });
  const gifProcessor = new Gifsicle(gifsiclePath, gifsicleParams);
  let readStream: Stream;

  if (Buffer.isBuffer(data)) {
    readStream = toStream(data);
  } else {
    const stream = await bent()(data);
    if (!(stream instanceof Stream)) return Buffer.concat([]);
    readStream = stream;
  }

  const buffers: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
    readStream
      .pipe(gifProcessor)
      .on('data', (chunk) => {
        buffers.push(chunk);
      })
      .on('error', (err) => reject(err))
      .on('end', () => {
        if (buffers.length === 0 && retryCount < 5) {
          retryCount += 1;
          resolve(modifyGif(data, options, gifsiclePath, retryCount));
        } else {
          resolve(Buffer.concat(buffers));
        }
      });
  });
}

function getCommandIndex(
  commands: Command[],
  name: string
): number | null {
  const index = commands.findIndex((command: Command) => command.name === name);
  return index !== -1 ? index : null;
}

function processSpecialCommand(
  command: SpecialCommand
): Promise<string | Buffer> {
  console.info(`EmoteReplacer: Command name: ${command.name}`);
  switch (command.name) {
    case 'rotate':
      return rotateEmote(command);
    case 'spin':
    case 'spinrev':
      return spinEmote(command);
    case 'shake':
      return shakeEmote(command);
    case 'rainbow':
      return rainbowEmote(command);
    case 'wiggle':
      return wiggleEmote(command);
    case 'infinite':
      return infiniteEmote(command);
    case 'slide':
    case 'sliderev':
      return slideEmote(command);
    case 'rain':
      return rainEmote(command);
    default:
      return Promise.resolve(command.buffer);
  }
}

async function processSpecialCommands(
  options: {
    data: string | Buffer,
    commands: Command[],
    fileType: string,
    size: string | number | undefined
  }
): Promise<string | Buffer> {
  const { commands } = options;
  let currentBuffer = options.data;

  console.info(`EmoteReplacer: Commands count: ${commands.length}`);

  for (let i = 0; i < commands.length; i += 1) {
    const value = (commands[i].param || 0).toString();
    const size = (options.size || 1).toString();
    // eslint-disable-next-line no-await-in-loop
    currentBuffer = await processSpecialCommand({
      name: commands[i].name,
      value: parseFloat(value),
      buffer: currentBuffer,
      type: i === 0 ? options.fileType : 'gif',
      size,
      isResized: i > 0
    });
  }

  return currentBuffer;
}

function removeEveryOtherFrame(frameInterval: number, commands: Command[], data: Buffer) {
  commands.push({
    name: '-d2'
  });

  const frameCount = data.toString('utf8').split('image #').length - 1;
  if (frameCount <= 4) return commands;
  commands.push({
    name: '--delete'
  });

  for (let i = 1; i < frameCount; i += frameInterval) {
    commands.push({
      name: `#${i}`
    });
  }

  return commands;
}

async function processNormalCommands(
  data: Data,
  buffer: string | Buffer,
  _commands: Command[]
): Promise<Buffer> {
  let commands = _commands;

  const info = await modifyGif(buffer, [{
    name: '-I'
  }], data.gifsiclePath);

  commands.unshift({
    name: '-U'
  });

  const hyperspeedIndex = getCommandIndex(commands, 'hyperspeed');
  if (hyperspeedIndex !== null) {
    commands.splice(hyperspeedIndex, 1);
    commands = removeEveryOtherFrame(2, commands, info);
  }

  return modifyGif(buffer, commands, data.gifsiclePath);
}

async function processCommands(data: Data): Promise<Buffer> {
  const fileType = data.url.endsWith('gif') ? 'gif' : 'png';
  let buffer: string | Buffer = data.url;
  let size: string | number | undefined;

  if (fileType === 'gif') {
    // Priority commands (namely resizing) must be done before unoptimizing
    // or it will cause glitches
    if (data.commands.priority.length > 0) {
      buffer = await modifyGif(buffer, data.commands.priority, data.gifsiclePath);
    }

    buffer = await modifyGif(buffer, [{
      name: '--unoptimize'
    }], data.gifsiclePath);
  }

  if (fileType === 'png') {
    const scaleIndex = getCommandIndex(data.commands.priority, '--scale');
    if (scaleIndex !== null) {
      size = data.commands.priority[scaleIndex].param;
    }
  }

  if (data.commands.special.length > 0) {
    buffer = await processSpecialCommands({
      data: buffer,
      commands: data.commands.special,
      fileType,
      size
    });
  }

  if (data.commands.normal.length > 0) {
    buffer = await processNormalCommands(data, buffer, data.commands.normal);
  }

  return modifyGif(buffer, [{
    name: '--optimize'
  }], data.gifsiclePath);
}

export default class GifUtils {
  name = 'GifUtils';

  static async modifyGif(_data: Data): Promise<string> {
    const data = _data;
    console.info('EmoteReplacer: Got request', JSON.stringify(data));
    data.commands = getCommands(data.options);
    console.info('EmoteReplacer: Processed request commands', data.commands);

    const buffer = await processCommands(data);
    console.info('EmoteReplacer: Processed modified emote', {
      length: buffer.length
    });

    return buffer.toString('base64');
  }
}
