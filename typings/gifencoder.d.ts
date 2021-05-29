declare module 'gifencoder' {
  /* eslint-disable no-unused-vars */
  import { Readable, Transform } from 'stream';

  export interface GIFOptions {
    /** 0 for repeat, -1 for no-repeat */
    repeat: number;
    /** frame delay in ms */
    delay: number;
    /** image quality. 10 is default */
    quality: number;
  }

  export default class GIFEncoder {
    constructor(width: number, height: number);

    createReadStream(): Readable;

    createWriteStream(options: GIFEncoder.GIFOptions): Transform;

    start(): void;

    setRepeat(
        /** 0 for repeat, -1 for no-repeat */
        repeat: number,
    ): void;

    setDelay(/** frame delay in ms */ delay: number): void;

    setQuality(/** image quality. 10 is default */ quality: number): void;

    setTransparent(/** color to make transparent */ color: number): void;

    addFrame(data: CanvasRenderingContext2D | Buffer): void;

    finish(): void;
  }
}
