import memoize from 'memoizeasync';
import { Stream } from 'stream';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export default class Gifsicle extends Stream {
  path = '';

  args: string[] = [];

  writable = true;

  readable = true;

  hasEnded = false;

  bufferedChunks?: unknown[];

  process?: ChildProcessWithoutNullStreams;

  seenDataOnStdout = false;

  isPaused = false;

  constructor(path: string, args: string[]) {
    super();
    Stream.call(this);

    this.path = path;
    this.args = args;
  }

  findBinary = memoize((callback) => {
    if (this.path) callback(null, this.path);
    else callback(new Error('Unable to late the gifsicle binary file.'));
  })

  private onError(msg: Error) {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.cleanUp();
    this.emit('error', msg);
  }

  write(newChunk: unknown): boolean {
    if (this.hasEnded) return true;
    if (this.process) {
      this.process.stdin.write(newChunk);
      return true;
    }

    if (this.bufferedChunks) {
      this.bufferedChunks.push(newChunk);
      return true;
    }

    this.bufferedChunks = [];
    this.findBinary((err, path) => {
      if (this.hasEnded) return;
      if (err) {
        this.onError(err);
        return;
      }
      if (!path) {
        this.onError(new Error('No path received'));
        return;
      }

      this.seenDataOnStdout = false;
      this.process?.kill();
      this.process = spawn(path, this.args);

      this.process.on('error', this.onError.bind(this));
      this.process.stdin.on('error', this.onError.bind(this));

      this.process.on('exit', (exitCode) => {
        if (this.hasEnded) return;
        if (exitCode && exitCode > 0 && !this.hasEnded) {
          this.onError(new Error(`The gifsicle process exited with a non-zero exit code: ${exitCode}`));
        }
        this.emit('end');
        this.hasEnded = true;
      });

      this.process.stdout
        .on('data', (chunk) => {
          this.seenDataOnStdout = true;
          this.emit('data', chunk);
        })
        .on('end', () => {
          this.process = undefined;
          if (this.hasEnded) return;
          if (this.seenDataOnStdout) {
            this.emit('end');
          } else {
            this.onError(new Error('Gifsicle: STDOUT stream ended without emitting any data.'));
          }
          this.hasEnded = true;
        });

      if (this.isPaused) {
        this.process.stdout.pause();
      }

      this.bufferedChunks?.forEach((chunk) => {
        if (chunk === null) {
          this.process?.stdin.end();
        } else {
          this.process?.stdin.write(chunk);
        }
      });
      this.bufferedChunks = undefined;
    });

    this.bufferedChunks.push(newChunk);
    return true;
  }

  cleanUp(): void {
    this.process?.kill();
    this.process = undefined;
    this.bufferedChunks = undefined;
  }

  destroy(): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.cleanUp();
  }

  end(chunk: unknown): void {
    if (chunk) this.write(chunk);
    if (this.process) this.process.stdin.end();
    else if (this.bufferedChunks) this.bufferedChunks.push(null);
    else this.write(Buffer.from(''));
  }

  pause(): void {
    this.process?.stdout.pause();
    this.isPaused = true;
  }

  resume(): void {
    this.process?.stdout.resume();
    this.isPaused = false;
  }
}
