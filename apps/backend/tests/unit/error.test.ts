import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ValidationError } from '@kepler/shared';
import { errorMiddleware } from '../../src/middleware/error';

describe('errorMiddleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post('/test', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });
    app.post('/custom-error', (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new ValidationError('Custom field validation error', {
          field: 'customField',
          reason: 'CUSTOM_REASON'
        })
      );
    });
    app.get('/syntax-error', (_req: Request, _res: Response, next: NextFunction) => {
      next(new SyntaxError('Internal syntax error not from parser'));
    });
    app.use(errorMiddleware);
  });

  it('returns 400 with VALIDATION_ERROR on malformed JSON body', async () => {
    const malformedBody = '{"broken": json}';
    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send(malformedBody);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Request body is not valid JSON');
    expect(response.body.error.context).toEqual({
      field: 'body',
      reason: 'INVALID_JSON'
    });
  });

  it('does not leak malformed raw body content in response', async () => {
    const malformedBody = '{"secret": "LEAKED_PAYLOAD_VALUE", broken}';
    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send(malformedBody);

    expect(response.status).toBe(400);
    const responseText = JSON.stringify(response.body);
    expect(responseText.includes('LEAKED_PAYLOAD_VALUE')).toBe(false);
    expect(responseText.includes(malformedBody)).toBe(false);
  });

  it('preserves other 400 validation errors on valid JSON request', async () => {
    const response = await request(app)
      .post('/custom-error')
      .set('Content-Type', 'application/json')
      .send({ field: 'validValue' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Custom field validation error');
    expect(response.body.error.context).toEqual({
      field: 'customField',
      reason: 'CUSTOM_REASON'
    });
  });

  it('falls through to 500 on non-JSON-parse SyntaxError', async () => {
    const response = await request(app).get('/syntax-error');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});
