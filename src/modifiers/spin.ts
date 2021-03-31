import GIFEncoder from 'gifencoder';
import Jimp from 'jimp';
import SpecialCommand from '../classes/specialCommand';
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from '../gifhelper';

function prepareSpinVariables(
  delay: number,
  centisecsPerRotation: number,
  reverse: boolean,
  width: number,
  height: number
) {
  let degrees = (360 * delay) / centisecsPerRotation;
  const interval = Math.floor(360 / degrees);
  degrees *= reverse ? 1 : -1;
  let margin = (width - height) / 2;
  if (height > width) margin *= -1;
  return {
    degrees,
    interval,
    max: Math.max(width, height),
    margin,
  };
}

export async function createSpinningGIF(options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer);
  const max = Math.max(inputGif.width, inputGif.height);
  const encoder = new GIFEncoder(max, max);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject);
    setEncoderProperties(encoder);

    const {
      degrees,
      interval,
      margin
    } = prepareSpinVariables(
      inputGif.frames[0].delayCentisecs, // assuming all frames have the same delay
      (200 * options.value) / 8, // 100cs per rotation -> 1 rotation per second
      options.name === 'spinrev',
      inputGif.width,
      inputGif.height
    );

    const frames = alignGif(inputGif.frames, interval);
    for (let i = 0; i < frames.length; i += 1) {
      encoder.setDelay(frames[i].delayCentisecs * 10);
      const adjustedImg = new Jimp(max, max);

      if (inputGif.width > inputGif.height) {
        adjustedImg.blit(new Jimp(frames[i].bitmap), 0, margin);
      } else {
        adjustedImg.blit(new Jimp(frames[i].bitmap), margin, 0);
      }

      adjustedImg.rotate((i * degrees) % 360, false);
      encoder.addFrame(adjustedImg.bitmap.data);
    }

    encoder.finish();
  });
}

export async function createSpinningPNG(options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path');
  let image = await Jimp.read(options.buffer);

  const {
    width,
    height
  } = preparePNGVariables(options, image.bitmap);

  const {
    degrees,
    interval,
    max,
    margin
  } = prepareSpinVariables(
    options.value, // delay
    (200 * options.value) / 8, // 100cs per rotation -> 1 rotation per second
    options.name === 'spinrev',
    width,
    height
  );

  const encoder = new GIFEncoder(max, max);
  image.resize(width, height);

  const resizedImage = new Jimp(max, max);
  image = width > height
    ? resizedImage.blit(image, 0, margin)
    : resizedImage.blit(image, margin, 0);

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject);
    setEncoderProperties(encoder, options.value * 10);

    for (let i = 0; i < interval; i += 1) {
      const rotatedImage = new Jimp(resizedImage.bitmap);
      rotatedImage.rotate(i * degrees, false);
      encoder.addFrame(rotatedImage.bitmap.data);
    }
    encoder.finish();
  });
}
