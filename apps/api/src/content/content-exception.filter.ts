import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { ContentValidationError } from './field-types/field-validation.error';

/**
 * Turns a domain {@link ContentValidationError} into a structured client error
 * on whichever transport is active — a 400 JSON body over REST, or a
 * `BAD_REQUEST` GraphQLError (with the per-field list under `extensions`) over
 * GraphQL — so the field validator can stay framework-agnostic.
 */
@Catch(ContentValidationError)
export class ContentExceptionFilter implements ExceptionFilter {
  catch(exception: ContentValidationError, host: ArgumentsHost): void {
    if (host.getType<GqlContextType>() === 'graphql') {
      throw new GraphQLError(exception.message, {
        extensions: {
          code: 'BAD_REQUEST',
          fieldErrors: exception.errors,
        },
      });
    }
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Content Validation Failed',
      message: exception.message,
      fieldErrors: exception.errors,
    });
  }
}
