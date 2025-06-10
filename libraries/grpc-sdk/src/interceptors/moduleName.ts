import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

/**
 * Creates a client middleware that attaches the module name to the request metadata.
 *
 * @param {string} moduleName The name of the calling module.
 * @returns {(call: ClientMiddlewareCall<Request, Response>, options: CallOptions) => AsyncGenerator}
 *          Nice-grpc middleware function.
 */
export function getModuleNameInterceptor(moduleName: string) {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ) {
    if (!options.metadata) {
      options.metadata = Metadata();
    }
    options.metadata?.set('module-name', moduleName);
    return yield* call.next(call.request, options);
  };
}
