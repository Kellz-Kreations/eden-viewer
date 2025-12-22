import { ConfidentialClientApplication } from '@azure/msal-node';
import fetch from 'cross-fetch';
import NodeCache from 'node-cache';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { appConfig, AppConfig } from '../config/environment';
import { SipLadder } from '../domain/models';
import { normalizeCallRecord } from '../utils/normalizeCallRecord';

export interface GraphServiceOptions {
  clock?: () => number;
}

export class GraphService {
  private readonly config: AppConfig;

  private readonly tokenCache: NodeCache;

  private readonly options: GraphServiceOptions;

  private readonly cca?: ConfidentialClientApplication;

  constructor(config: AppConfig = appConfig, options: GraphServiceOptions = {}) {
    this.config = config;
    this.options = options;
    this.tokenCache = new NodeCache({ stdTTL: 45 * 60, checkperiod: 120 });

    if (!this.config.graph.mockMode) {
      if (!this.config.azure.authority || !this.config.azure.clientId || !this.config.azure.clientSecret) {
        throw new Error('Azure AD credentials are not fully configured.');
      }

      this.cca = new ConfidentialClientApplication({
        auth: {
          authority: this.config.azure.authority,
          clientId: this.config.azure.clientId,
          clientSecret: this.config.azure.clientSecret,
        },
      });
    }
  }

  public async getSipLadder(callId: string, userAssertion: string): Promise<SipLadder> {
    const record = await this.loadCallRecord(callId, userAssertion);
    return normalizeCallRecord(record);
  }

  private async loadCallRecord(callId: string, userAssertion: string): Promise<unknown> {
    if (this.config.graph.mockMode) {
      const filePath = join(__dirname, '..', '..', 'data', 'sample-call-record.json');
      const contents = await readFile(filePath, 'utf-8');
      return JSON.parse(contents);
    }

    const accessToken = await this.acquireOnBehalfToken(userAssertion);
    const baseUrl = this.config.graph.enableBeta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
    const url = new URL(`${baseUrl}/communications/callRecords/${callId}`);
    url.searchParams.set('$expand', 'sessions($expand=segments($expand=media))');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'include-unknown-enum-values=true',
        ConsistencyLevel: 'eventual',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const message = `Microsoft Graph request failed (${response.status})`; // avoid logging secrets
      const error = new Error(message);
      (error as Error & { status?: number; body?: string }).status = response.status;
      (error as Error & { status?: number; body?: string }).body = errorBody;
      throw error;
    }

    return response.json();
  }

  private async acquireOnBehalfToken(userAssertion: string): Promise<string> {
    const cacheKey = this.hashAssertion(userAssertion);
    const now = this.options.clock?.() ?? Date.now();
    const cached = this.tokenCache.get<{ token: string; expiresAt?: number }>(cacheKey);

    if (cached && (!cached.expiresAt || cached.expiresAt > now + 15_000)) {
      return cached.token;
    }

    if (!this.cca) {
      throw new Error('MSAL ConfidentialClientApplication is not configured.');
    }

    const result = await this.cca.acquireTokenOnBehalfOf({
      oboAssertion: userAssertion,
      scopes: this.config.graph.scopes,
    });

    if (!result?.accessToken) {
      throw new Error('Failed to acquire Graph access token via On-Behalf-Of flow.');
    }

    const expiresAt = result.expiresOn?.getTime();
    const ttlSeconds = expiresAt ? Math.max(1, Math.floor((expiresAt - now) / 1000)) : 45 * 60;
    this.tokenCache.set(cacheKey, { token: result.accessToken, expiresAt }, ttlSeconds);

    return result.accessToken;
  }

  private hashAssertion(assertion: string): string {
    return createHash('sha256').update(assertion).digest('hex');
  }
}
