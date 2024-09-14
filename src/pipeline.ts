type ProcessorFunc<Context, Input, Output> = (ctx: PipelineContext<Context>, input: Input) => Promise<Output>;
type ErrHanlder<Context, Output> = (ctx: PipelineContext<Context>, err: Error) => Output | never;

type ProgressMessage = {
  processor: string;
  progress: number;
  details?: any;
};

type ProgressSubcriber = (msg: ProgressMessage) => void;

class ProgressNotifier {
  private subcribers: ProgressSubcriber[] = [];

  constructor() {}

  subcribe(subcriber: ProgressSubcriber) {
    this.subcribers.push(subcriber);
  }

  notify(processor: string, progress?: number, details?: any) {
    this.subcribers.forEach((s) => {
      s({
        processor,
        progress: progress ?? 100,
        details,
      });
    });
  }
}

export type PipelineContext<T> = T & { notifier: ProgressNotifier };

export class Pipeline<T> {
  constructor(public context: T) {}

  private execing = false;

  private processorFuncs: [ProcessorFunc<PipelineContext<T>, any, any>, ErrHanlder<T, any> | undefined][] = [];

  private finallyFuncs: ProcessorFunc<PipelineContext<T>, any, any>[] = [];

  pipe<Input, Output>(next: ProcessorFunc<T, Input, Output>, errHandler?: ErrHanlder<T, Output>): Pipeline<T> {
    this.processorFuncs.push([next, errHandler]);
    return this;
  }

  finally(handler: ProcessorFunc<T, Error, unknown>) {
    this.finallyFuncs.push(handler);
    return this;
  }

  async exec(subcriber?: ProgressSubcriber) {
    if (this.execing) {
      throw new Error('pipe execing now');
    }
    const notifier = new ProgressNotifier();
    if (subcriber) {
      notifier.subcribe(subcriber);
    }
    this.execing = true;
    let output: unknown = null;
    const cloneProcessorFuncs = this.processorFuncs.slice(0);
    const context = { ...this.context, notifier };
    const reset = () => {
      this.processorFuncs = cloneProcessorFuncs;
      this.execing = false;
    };
    const finallyHandler = (err?: Error) => {
      while (this.finallyFuncs.length) {
        const func = this.finallyFuncs.shift();
        if (func) {
          func(context, err);
        }
      }
      reset();
    };
    try {
      while (this.processorFuncs.length) {
        const current = this.processorFuncs.shift();
        if (current) {
          const [next, errHandler] = current;
          output = await next(context, output).catch((err: Error) => {
            if (errHandler) {
              errHandler(context, err);
            } else {
              throw err;
            }
          });
        }
      }
    } catch (err) {
      finallyHandler(err as unknown as Error);
      throw err;
    }
    finallyHandler();
    return output;
  }
}
