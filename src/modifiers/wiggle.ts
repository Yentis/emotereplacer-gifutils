import Jimp from 'jimp';
import GIFEncoder from '../classes/gifencoder';
import SpecialCommand from '../classes/specialCommand';
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from '../gifhelper';

function prepareWiggleVariables(margin: number, height: number) {
  const shiftSize = Math.max(1, margin / 6);
  const interval = 2 * (margin / shiftSize + 4);
  const stripeHeight = Math.max(1, Math.floor(height / 32));
  const shift = margin / 2; // Initial offset of wiggle
  const left = true; // true -> go to left

  return {
    shiftSize,
    interval,
    stripeHeight,
    shift,
    left
  };
}

function shiftWiggleStep(
  _shift: number,
  _left: boolean,
  margin: number,
  shiftSize: number
): [number, boolean] {
  let shift = _shift;
  let left = _left;

  if (left) {
    shift -= shiftSize;
    if (shift < -shiftSize) left = false;
  } else {
    shift += shiftSize;
    if (shift > margin + shiftSize) left = true;
  }

  return [shift, left];
}

function getWiggledFrameData(oldFrame: Jimp, _shift: number, _left: boolean, options: {
  stripeHeight: number,
  shiftSize: number,
  width: number,
  margin: number
}): Jimp['bitmap'] {
  const newFrame = new Jimp(options.width, oldFrame.bitmap.height);
  let shift = _shift;
  let left = _left;

  // Wiggle each stripe
  for (let stripe = 0; stripe < oldFrame.bitmap.height; stripe += options.stripeHeight) {
    newFrame.blit(oldFrame, shift, stripe, 0, stripe, oldFrame.bitmap.width, options.stripeHeight);
    [shift, left] = shiftWiggleStep(shift, left, options.margin, options.shiftSize);
  }
  return newFrame.bitmap;
}

export async function createWigglingGIF(options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer);
  const encoder = new GIFEncoder(inputGif.width, inputGif.height);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
    setEncoderProperties(encoder);

    const width = inputGif.width + 2 * Math.floor((inputGif.width * options.value * 0.1) / 15);
    const margin = width - inputGif.width;

    const wiggleVariables = prepareWiggleVariables(margin, inputGif.height);
    const { shiftSize, interval, stripeHeight } = wiggleVariables;
    let { shift, left } = wiggleVariables;
    const frames = alignGif(inputGif.frames, interval);

    for (let i = 0; i < frames.length; i++) {
      encoder.setDelay(frames[i].delayCentisecs * 10);
      const wiggledBitmap = getWiggledFrameData(
        new Jimp(frames[i].bitmap),
        shift,
        left,
        {
          stripeHeight,
          shiftSize,
          width: inputGif.width,
          margin
        },
      );
      encoder.addFrame(wiggledBitmap.data);
      // Set initial wiggle offset for next frame
      [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
    }

    encoder.finish();
  });
}

export async function createWigglingPNG(options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path');
  const image = await Jimp.read(options.buffer);

  const {
    width: imgWidth,
    height
  } = preparePNGVariables(options, image.bitmap);
  image.resize(imgWidth, height);

  const width = imgWidth + 2 * Math.floor((imgWidth * options.value * 0.1) / 15);
  const margin = width - imgWidth;

  const encoder = new GIFEncoder(width, height);
  const wiggleVariables = prepareWiggleVariables(margin, height);
  const { shiftSize, interval, stripeHeight } = wiggleVariables;
  let { shift, left } = wiggleVariables;

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
    setEncoderProperties(encoder, 80);

    for (let i = 0; i < interval; i++) {
      // Wiggle frame
      const wiggledBitmap = getWiggledFrameData(image, shift, left, {
        stripeHeight,
        shiftSize,
        width,
        margin
      });
      encoder.addFrame(wiggledBitmap.data);
      // Set initial wiggle offset for next frame
      [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
    }

    encoder.finish();
  });
}
