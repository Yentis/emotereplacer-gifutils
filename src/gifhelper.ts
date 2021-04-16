import bent from 'bent';
import { Gif, GifFrame, GifUtil } from 'gifwrap';
import { Stream } from 'stream';
import Jimp from 'jimp';
import GIFEncoder from './classes/gifencoder';
import toStream from './buffer-to-stream';
import SpecialCommand from './classes/specialCommand';

import * as rotate from './modifiers/rotate';
import * as spin from './modifiers/spin';
import * as shake from './modifiers/shake';
import * as rainbow from './modifiers/rainbow';
import * as wiggle from './modifiers/wiggle';
import * as infinite from './modifiers/infinite';
import * as slide from './modifiers/slide';
import * as rain from './modifiers/rain';

export async function getBuffer(data: string | Buffer | Stream): Promise<Buffer> {
  const buffers: Uint8Array[] = [];
  let readStream: Stream;

  if (Buffer.isBuffer(data)) {
    readStream = toStream(data);
  } else if (typeof (data) === 'string') {
    const stream = await bent()(data);
    if (!(stream instanceof Stream)) return Buffer.concat([]);
    readStream = stream;
  } else {
    readStream = data;
  }

  return new Promise((resolve, reject) => {
    readStream.on('data', (chunk) => {
      buffers.push(chunk);
    }).on('end', () => {
      resolve(Buffer.concat(buffers));
    }).on('error', (error) => {
      reject(error);
    });
  });
}

export async function getGifFromBuffer(data: string | Buffer): Promise<Gif> {
  const buffer = await getBuffer(data);
  const gif = await GifUtil.read(buffer);

  if (gif.frames.length > 200) {
    throw Error('Image too large, advanced modifiers not supported!');
  }

  return gif;
}

export function alignGif(frames: GifFrame[], interval: number): GifFrame[] {
  // Duplicate frames until interval is reached
  let alignedFrames = GifUtil.cloneFrames(frames);
  while (alignedFrames.length < interval) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames));
  }

  let framesToDelete = alignedFrames.length % interval;
  /*
      Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
      Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
      then framesToDelete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
    */
  while (framesToDelete / alignedFrames.length > 0.2) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames));
    framesToDelete = alignedFrames.length % interval;
  }

  const amountCopies = alignedFrames.length / frames.length;
  let currentCopy = 0;

  for (let i = 0; i < framesToDelete; i++) {
    const frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1;
    alignedFrames.splice(frameToDelete + currentCopy * frames.length, 1);
    // Keep shifting copy so each copy loses about the same amount of frames
    currentCopy = (currentCopy + 1) % amountCopies;
  }

  return alignedFrames;
}

export function setEncoderProperties(encoder: GIFEncoder, delay?: number): void {
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(5);
  if (delay) {
    encoder.setDelay(delay);
  }
  encoder.setTransparent(0x00000000);
}

function getSizeFromOptions(options: SpecialCommand) {
  let widthModifier = 1;
  let heightModifier = 1;

  if (!options.isResized) {
    const { size } = options;

    if (size.includes('x')) {
      const split = size.split('x');
      widthModifier = parseFloat(split[0]);
      heightModifier = parseFloat(split[1]);
    } else {
      widthModifier = parseFloat(size);
      heightModifier = parseFloat(size);
    }
  }

  return {
    widthModifier,
    heightModifier
  };
}

export function preparePNGVariables(options: SpecialCommand, image: Jimp['bitmap']): { width: number, height: number, encoder: GIFEncoder } {
  const {
    widthModifier,
    heightModifier
  } = getSizeFromOptions(options);
    // Flooring to elude rounding errors
  const width = Math.floor(widthModifier * image.width);
  const height = Math.floor(heightModifier * image.height);

  return {
    width,
    height,
    encoder: new GIFEncoder(width, height)
  };
}

export function rotateEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rotate.createRotatedGIF(options);
  }
  return rotate.createRotatedPNG(options);
}

export function spinEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return spin.createSpinningGIF(options);
  }
  return spin.createSpinningPNG(options);
}

export function shakeEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return shake.createShakingGIF(options);
  }
  return shake.createShakingPNG(options);
}

export function rainbowEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rainbow.createRainbowGIF(options);
  }
  return rainbow.createRainbowPNG(options);
}

export function wiggleEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return wiggle.createWigglingGIF(options);
  }
  return wiggle.createWigglingPNG(options);
}

export function infiniteEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return infinite.createInfiniteGIF(options);
  }
  return infinite.createInfinitePNG(options);
}

export function slideEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return slide.createSlidingGIF(options);
  }
  return slide.createSlidingPNG(options);
}

export function rainEmote(options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rain.createRainingGIF(options);
  }
  return rain.createRainingPNG(options);
}
