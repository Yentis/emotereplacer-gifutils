import GIFEncoder from 'gifencoder';
import { JimpBitmap } from 'gifwrap';
import Jimp from 'jimp';
import SpecialCommand from '../classes/specialCommand';
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from '../gifhelper';

function resetInfiniteScales(scalesAmount: number, scaleDiff: number, scaleStep: number): number[] {
  const scales = [];
  for (let depth = 0; depth < scalesAmount; depth += 1) {
    scales.push((scalesAmount - depth - 1) * scaleDiff + scaleStep);
  }
  return scales;
}

function getInfiniteShiftedFrameData(frameBitmap: JimpBitmap, scales: number[]): Jimp['bitmap'] {
  const newFrame = new Jimp(frameBitmap.width, frameBitmap.height, 0x00);
  // Add appropriate frame with each depth scale
  for (let depth = 0; depth < scales.length; depth += 1) {
    const scaledFrame = new Jimp(frameBitmap);
    scaledFrame.scale(scales[depth]);
    const dx = (scaledFrame.bitmap.width - frameBitmap.width) / 2;
    const dy = (scaledFrame.bitmap.height - frameBitmap.height) / 2;
    // Blit frame properly with respect to the scale
    if (scales[depth] > 1) {
      newFrame.blit(scaledFrame, 0, 0, dx, dy, frameBitmap.width, frameBitmap.height);
    } else {
      newFrame.blit(scaledFrame, -dx, -dy);
    }
  }
  return newFrame.bitmap;
}

function shiftInfiniteScales(_scales: number[], scaleDiff: number, scaleStep: number): number[] {
  let scales = _scales;

  if (scales[0] >= scales.length * scaleDiff) {
    scales = resetInfiniteScales(scales.length, scaleDiff, scaleStep);
  } else {
    for (let depth = 0; depth < scales.length; depth += 1) {
      scales[depth] += scaleStep;
    }
  }

  return scales;
}

export async function createInfiniteGIF(options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer);
  const encoder = new GIFEncoder(inputGif.width, inputGif.height);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
    setEncoderProperties(encoder);

    const scalesAmount = 5;
    const scaleDiff = 0.9; // Difference between each scale
    const scaleStep = (0.03 * 8) / options.value; // Scale shift between frames
    let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);
    const frames = alignGif(inputGif.frames, scaleDiff / scaleStep);

    for (let i = 0; i < frames.length; i += 1) {
      encoder.setDelay(frames[i].delayCentisecs * 10);
      const frameData = getInfiniteShiftedFrameData(frames[i].bitmap, scales);
      encoder.addFrame(frameData.data);
      // Shift scales for next frame
      scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
    }

    encoder.finish();
  });
}

export async function createInfinitePNG(options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path');
  const image = await Jimp.read(options.buffer);

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap);
  image.resize(width, height);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
    setEncoderProperties(encoder, options.value * 10);

    const scalesAmount = 5;
    const scaleDiff = 0.9; // Difference between each scale
    const scaleStep = 0.06; // Scale shift between frames
    const frames = scaleDiff / scaleStep - 1;
    let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);

    for (let i = 0; i < frames; i += 1) {
      const frameData = getInfiniteShiftedFrameData(image.bitmap, scales);
      encoder.addFrame(frameData.data);
      // Shift scales for next frame
      scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
    }

    encoder.finish();
  });
}
