import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

/**
 * Creates a client middleware that attaches a gRPC token to outgoing calls.
 *
 * @param {string} grpcToken The token to include in request metadata.
 * @returns {(call: ClientMiddlewareCall<Request, Response>, options: CallOptions) => AsyncGenerator}
 *          Nice-grpc middleware function.
 */
export function getGrpcSignedTokenInterceptor(grpcToken: string) {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ) {
    if (!options.metadata) {
      options.metadata = Metadata();
    }
    options.metadata?.set('grpc-token', grpcToken);
    return yield* call.next(call.request, options);
  };
}
