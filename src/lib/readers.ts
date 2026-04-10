export class DisposableReader implements AsyncDisposable {
  constructor(private reader: ReadableStreamDefaultReader<string>) {}

  static fromStream(stream: ReadableStream<string>) {
    return new DisposableReader(stream.getReader());
  }

  async read() {
    return this.reader.read();
  }

  async [Symbol.asyncDispose]() {
    try {
      this.reader.releaseLock();
    } catch (e) {
      console.warn('Failed to release reader lock during disposal:', e);
    }
  }
}
