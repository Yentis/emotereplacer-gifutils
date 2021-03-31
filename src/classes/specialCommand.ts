export default interface SpecialCommand {
  name: string,
  value: number,
  buffer: string | Buffer,
  type: string,
  size: string,
  isResized: boolean
// eslint-disable-next-line semi
}
