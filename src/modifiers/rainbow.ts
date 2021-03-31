import GIFEncoder from 'gifencoder';
import { JimpBitmap } from 'gifwrap';
import Jimp from 'jimp';
import SpecialCommand from '../classes/specialCommand';
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from '../gifhelper';

// r, g, b in [0, 255] ~ h, s, l in [0, 1]
function rgb2hsl(_r: number, _g: number, _b: number): number[] {
  const r = _r / 255;
  const g = _g / 255;
  const b = _b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h; let s; const l = (max + min) / 2;
  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        h = 0;
        break;
    }

    h /= 6;
  }

  return [h, s, l];
}

function shiftColor(
  bitmap: Buffer,
  index: number,
  shiftAmount: number,
  randomBlack: number,
  randomWhite: number
): number[] {
  const initialColors = [bitmap[index], bitmap[index + 1], bitmap[index + 2]];
  const whiteThreshold = 30;
  const blackThreshold = 220;

  let colors;
  if (
    initialColors[0] <= whiteThreshold
    && initialColors[1] <= whiteThreshold
    && initialColors[2] <= whiteThreshold
  ) {
    colors = [randomWhite, 0.5, 0.2];
  } else if (
    initialColors[0] >= blackThreshold
    && initialColors[1] >= blackThreshold
    && initialColors[2] >= blackThreshold
  ) {
    colors = [randomBlack, 0.5, 0.8];
  } else {
    colors = rgb2hsl(initialColors[0], initialColors[1], initialColors[2]);
  }

  colors[0] += shiftAmount;
  return colors;
}

function hue2rgb(p: number, q: number, _t: number): number {
  let t = _t;

  if (t < 0) t += 1;
  else if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;

  return p;
}

// h, s, l in [0, 1] ~ r, g, b in [0, 255]
function hsl2rgb(h: number, s: number, l: number): number[] {
  let r; let g; let b; let q; let
    p;
  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

function shiftColors(
  bitmap: JimpBitmap,
  interval: number,
  randomBlack: number,
  randomWhite: number
): void {
  for (let i = 0; i < bitmap.data.length; i += 4) {
    if (bitmap.data[i + 3] > 0) { // only recolor if non-transparent
      let colors = shiftColor(bitmap.data, i, interval, randomBlack, randomWhite);

      while (colors[0] > 1) colors[0] -= 1;
      colors = hsl2rgb(colors[0], colors[1], colors[2]);
      bitmap.data.set(colors, i);
    }
  }
}

export async function createRainbowGIF(options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer);
  const encoder = new GIFEncoder(inputGif.width, inputGif.height);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject);
    setEncoderProperties(encoder);

    const interval = 32 * options.value;
    const frames = alignGif(inputGif.frames, interval);
    const randomBlack = Math.random();
    const randomWhite = Math.random();

    for (let i = 0; i < frames.length; i += 1) {
      encoder.setDelay(frames[i].delayCentisecs * 10);
      const frame = frames[i];
      shiftColors(frame.bitmap, (i % interval) / interval, randomBlack, randomWhite);
      encoder.addFrame(frame.bitmap.data);
    }

    encoder.finish();
  });
}

export async function createRainbowPNG(options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path');
  const image = await Jimp.read(options.buffer);

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap);
  image.resize(width, height);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject);
    setEncoderProperties(encoder, options.value * 10);

    const amountFrames = 32; // arbitrary
    const interval = 1 / amountFrames; // hue shift per step
    const randomBlack = Math.random();
    const randomWhite = Math.random();

    for (let i = 0; i < amountFrames; i += 1) {
      shiftColors(image.bitmap, interval, randomBlack, randomWhite);
      encoder.addFrame(image.bitmap.data);
    }

    encoder.finish();
  });
}
