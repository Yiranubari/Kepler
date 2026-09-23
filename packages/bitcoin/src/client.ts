import crypto from 'node:crypto';
import type { KeplerLogger } from '@kepler/shared';
import { BitcoinConfig } from './config';
import {
  BitcoinNetworkError,
  BitcoinNotFoundError,
  BitcoinInvalidResponseError,
  BitcoinParseError
} from './errors';
import {
  BitcoinTransaction,
  BitcoinInput,
  BitcoinOutput,
  BitcoinAddressInfo,
  BitcoinBlockTip,
  BitcoinScriptType,
  EsploraTxSchema,
  EsploraAddressInfoSchema,
  EsploraBlocksResponseSchema
} from './types';

export class BitcoinClient {
  private static readonly BECH32_CHARSET: string = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  private static readonly BASE58_CHARSET: string = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  private static readonly BECH32_CONST: number = 1;
  private static readonly BECH32M_CONST: number = 0x2bc830a3;

  private readonly _config: BitcoinConfig;
  private readonly _logger: KeplerLogger;

  constructor(config: BitcoinConfig, logger: KeplerLogger) {
    this._config = config;
    this._logger = logger;
  }

  private doubleSha256(buf: Buffer): Buffer {
    return crypto.createHash('sha256').update(crypto.createHash('sha256').update(buf).digest()).digest();
  }

  private encodeBase58(buf: Buffer): string {
    let zeroes = 0;
    while (zeroes < buf.length && buf[zeroes] === 0) {
      zeroes++;
    }
    let num = 0n;
    for (const b of buf) {
      num = (num << 8n) + BigInt(b);
    }
    let str = '';
    while (num > 0n) {
      const rem = Number(num % 58n);
      num = num / 58n;
      str = BitcoinClient.BASE58_CHARSET[rem] + str;
    }
    return '1'.repeat(zeroes) + str;
  }

  private encodeBase58Check(versionByte: number, payload: Buffer): string {
    const data = Buffer.concat([Buffer.from([versionByte]), payload]);
    const checksum = this.doubleSha256(data).subarray(0, 4);
    return this.encodeBase58(Buffer.concat([data, checksum]));
  }

  private polymod(values: readonly number[]): number {
    let chk = 1;
    for (const val of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ val;
      if ((top >> 0) & 1) chk ^= 0x3b6a57b2;
      if ((top >> 1) & 1) chk ^= 0x26508e6d;
      if ((top >> 2) & 1) chk ^= 0x1ea119fa;
      if ((top >> 3) & 1) chk ^= 0x3d4233dd;
      if ((top >> 4) & 1) chk ^= 0x2a1462b3;
    }
    return chk;
  }

  private hrpExpand(hrp: string): number[] {
    const ret: number[] = [];
    for (let i = 0; i < hrp.length; i++) {
      ret.push(hrp.charCodeAt(i) >> 5);
    }
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) {
      ret.push(hrp.charCodeAt(i) & 31);
    }
    return ret;
  }

  private convertBits(data: readonly number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
    let acc = 0;
    let bits = 0;
    const ret: number[] = [];
    const maxv = (1 << toBits) - 1;
    for (const value of data) {
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push((acc >> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
      }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
      return null;
    }
    return ret;
  }

  private encodeSegwitAddress(hrp: string, version: number, program: Uint8Array): string {
    const converted = this.convertBits(Array.from(program), 8, 5, true);
    if (!converted) {
      throw new BitcoinParseError('Failed to convert bits for segwit address', {
        reason: 'Bit conversion failure'
      });
    }
    const data = [version, ...converted];
    const spec = version === 0 ? BitcoinClient.BECH32_CONST : BitcoinClient.BECH32M_CONST;
    const checksum = this.polymod([...this.hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ spec;
    const combined = [...data];
    for (let p = 0; p < 6; p++) {
      combined.push((checksum >> (5 * (5 - p))) & 31);
    }
    let ret = `${hrp}1`;
    for (const p of combined) {
      ret += BitcoinClient.BECH32_CHARSET.charAt(p);
    }
    return ret;
  }

  private readVarInt(buf: Buffer, offset: number, hexInput: string): { value: number; bytesRead: number } {
    if (offset >= buf.length) {
      throw new BitcoinParseError('Truncated VarInt in transaction data', {
        input: hexInput,
        reason: 'Buffer ended unexpectedly while reading VarInt'
      });
    }
    const first = buf[offset];
    if (first < 0xfd) {
      return { value: first, bytesRead: 1 };
    }
    if (first === 0xfd) {
      if (offset + 3 > buf.length) {
        throw new BitcoinParseError('Truncated VarInt in transaction data', {
          input: hexInput,
          reason: 'Buffer ended unexpectedly reading 16-bit VarInt'
        });
      }
      return { value: buf.readUInt16LE(offset + 1), bytesRead: 3 };
    }
    if (first === 0xfe) {
      if (offset + 5 > buf.length) {
        throw new BitcoinParseError('Truncated VarInt in transaction data', {
          input: hexInput,
          reason: 'Buffer ended unexpectedly reading 32-bit VarInt'
        });
      }
      return { value: buf.readUInt32LE(offset + 1), bytesRead: 5 };
    }
    if (offset + 9 > buf.length) {
      throw new BitcoinParseError('Truncated VarInt in transaction data', {
        input: hexInput,
        reason: 'Buffer ended unexpectedly reading 64-bit VarInt'
      });
    }
    const bigVal = buf.readBigUInt64LE(offset + 1);
    if (bigVal > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BitcoinParseError('VarInt value exceeds safe integer limit', {
        input: hexInput,
        reason: 'VarInt too large'
      });
    }
    return { value: Number(bigVal), bytesRead: 9 };
  }

  public parseOutputScript(scriptHex: string): { type: BitcoinScriptType; address: string | null } {
    const cleanHex = scriptHex.trim().toLowerCase();
    if (!/^[0-9a-f]*$/.test(cleanHex)) {
      return { type: 'unknown', address: null };
    }

    const network = this._config.network;
    const hrp = network === 'mainnet' ? 'bc' : (network === 'testnet' ? 'tb' : 'bcrt');
    const p2pkhVersion = network === 'mainnet' ? 0x00 : 0x6f;
    const p2shVersion = network === 'mainnet' ? 0x05 : 0xc4;

    if (cleanHex.startsWith('6a')) {
      return { type: 'op_return', address: null };
    }

    if (cleanHex.length === 50 && cleanHex.startsWith('76a914') && cleanHex.endsWith('88ac')) {
      const pubkeyHash = Buffer.from(cleanHex.slice(6, 46), 'hex');
      const address = this.encodeBase58Check(p2pkhVersion, pubkeyHash);
      return { type: 'p2pkh', address };
    }

    if (cleanHex.length === 46 && cleanHex.startsWith('a914') && cleanHex.endsWith('87')) {
      const scriptHash = Buffer.from(cleanHex.slice(4, 44), 'hex');
      const address = this.encodeBase58Check(p2shVersion, scriptHash);
      return { type: 'p2sh', address };
    }

    if (cleanHex.length === 44 && cleanHex.startsWith('0014')) {
      const program = Buffer.from(cleanHex.slice(4, 44), 'hex');
      const address = this.encodeSegwitAddress(hrp, 0, program);
      return { type: 'p2wpkh', address };
    }

    if (cleanHex.length === 68 && cleanHex.startsWith('0020')) {
      const program = Buffer.from(cleanHex.slice(4, 68), 'hex');
      const address = this.encodeSegwitAddress(hrp, 0, program);
      return { type: 'p2wsh', address };
    }

    if (cleanHex.length === 68 && cleanHex.startsWith('5120')) {
      const program = Buffer.from(cleanHex.slice(4, 68), 'hex');
      const address = this.encodeSegwitAddress(hrp, 1, program);
      return { type: 'p2tr', address };
    }

    return { type: 'unknown', address: null };
  }

  public parseTxHex(hex: string): BitcoinTransaction {
    const cleanHex = hex.trim();
    if (cleanHex.length === 0 || cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new BitcoinParseError('Invalid transaction hex string', {
        input: cleanHex,
        reason: 'Hex string must be non-empty, even-length, valid hex'
      });
    }

    const buf = Buffer.from(cleanHex, 'hex');
    if (buf.length < 10) {
      throw new BitcoinParseError('Truncated transaction data', {
        input: cleanHex,
        reason: 'Transaction buffer smaller than minimum required size'
      });
    }

    let offset = 0;
    const version = buf.readInt32LE(offset);
    offset += 4;

    let isSegwit = false;
    if (offset < buf.length && buf[offset] === 0x00) {
      offset++;
      if (offset >= buf.length) {
        throw new BitcoinParseError('Truncated segwit flag in transaction', {
          input: cleanHex,
          reason: 'Buffer ended unexpectedly at segwit flag'
        });
      }
      const flag = buf[offset];
      offset++;
      if (flag !== 0x01) {
        throw new BitcoinParseError('Unsupported segwit flag', {
          input: cleanHex,
          reason: `Expected segwit flag 0x01, received 0x${flag.toString(16)}`
        });
      }
      isSegwit = true;
    }

    const vinVar = this.readVarInt(buf, offset, cleanHex);
    offset += vinVar.bytesRead;
    const inputCount = vinVar.value;

    const inputs: BitcoinInput[] = [];
    for (let i = 0; i < inputCount; i++) {
      if (offset + 32 > buf.length) {
        throw new BitcoinParseError('Truncated input txid in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading txid for input ${i}`
        });
      }
      const txid = Buffer.from(buf.subarray(offset, offset + 32)).reverse().toString('hex');
      offset += 32;

      if (offset + 4 > buf.length) {
        throw new BitcoinParseError('Truncated input vout in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading vout for input ${i}`
        });
      }
      const vout = buf.readUInt32LE(offset);
      offset += 4;

      const scriptVar = this.readVarInt(buf, offset, cleanHex);
      offset += scriptVar.bytesRead;

      if (offset + scriptVar.value > buf.length) {
        throw new BitcoinParseError('Truncated scriptsig in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading scriptsig for input ${i}`
        });
      }
      const scriptsig = buf.subarray(offset, offset + scriptVar.value).toString('hex');
      offset += scriptVar.value;

      if (offset + 4 > buf.length) {
        throw new BitcoinParseError('Truncated sequence in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading sequence for input ${i}`
        });
      }
      const sequence = buf.readUInt32LE(offset);
      offset += 4;

      inputs.push({
        txid,
        vout,
        prevout: null,
        scriptsig,
        sequence,
        witness: []
      });
    }

    const voutVar = this.readVarInt(buf, offset, cleanHex);
    offset += voutVar.bytesRead;
    const outputCount = voutVar.value;

    const outputs: BitcoinOutput[] = [];
    for (let i = 0; i < outputCount; i++) {
      if (offset + 8 > buf.length) {
        throw new BitcoinParseError('Truncated output value in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading value for output ${i}`
        });
      }
      const value = buf.readBigUInt64LE(offset);
      offset += 8;

      const scriptVar = this.readVarInt(buf, offset, cleanHex);
      offset += scriptVar.bytesRead;

      if (offset + scriptVar.value > buf.length) {
        throw new BitcoinParseError('Truncated scriptpubkey in transaction', {
          input: cleanHex,
          reason: `Buffer ended while reading scriptpubkey for output ${i}`
        });
      }
      const scriptpubkey = buf.subarray(offset, offset + scriptVar.value).toString('hex');
      offset += scriptVar.value;

      const parsedScript = this.parseOutputScript(scriptpubkey);
      outputs.push({
        scriptpubkey,
        scriptpubkeyAddress: parsedScript.address,
        value
      });
    }

    const nonWitnessEnd = offset;

    if (isSegwit) {
      for (let i = 0; i < inputCount; i++) {
        const witnessVar = this.readVarInt(buf, offset, cleanHex);
        offset += witnessVar.bytesRead;
        const witnessCount = witnessVar.value;
        const witnessItems: string[] = [];

        for (let j = 0; j < witnessCount; j++) {
          const itemVar = this.readVarInt(buf, offset, cleanHex);
          offset += itemVar.bytesRead;
          if (offset + itemVar.value > buf.length) {
            throw new BitcoinParseError('Truncated witness item in transaction', {
              input: cleanHex,
              reason: `Buffer ended reading witness item ${j} for input ${i}`
            });
          }
          witnessItems.push(buf.subarray(offset, offset + itemVar.value).toString('hex'));
          offset += itemVar.value;
        }

        const inputToUpdate = inputs[i];
        if (inputToUpdate) {
          inputs[i] = {
            ...inputToUpdate,
            witness: witnessItems
          };
        }
      }
    }

    if (offset + 4 > buf.length) {
      throw new BitcoinParseError('Truncated locktime in transaction', {
        input: cleanHex,
        reason: 'Buffer ended while reading locktime'
      });
    }
    const locktime = buf.readUInt32LE(offset);
    offset += 4;

    if (offset !== buf.length) {
      throw new BitcoinParseError('Trailing bytes in transaction hex', {
        input: cleanHex,
        reason: `Unparsed ${buf.length - offset} trailing bytes`
      });
    }

    let txid: string;
    let baseSize: number;
    if (!isSegwit) {
      txid = Buffer.from(this.doubleSha256(buf)).reverse().toString('hex');
      baseSize = buf.length;
    } else {
      const nonWitnessBuf = Buffer.concat([
        buf.subarray(0, 4),
        buf.subarray(6, nonWitnessEnd),
        buf.subarray(buf.length - 4)
      ]);
      txid = Buffer.from(this.doubleSha256(nonWitnessBuf)).reverse().toString('hex');
      baseSize = nonWitnessBuf.length;
    }

    const size = buf.length;
    const weight = isSegwit ? (baseSize * 3 + size) : (size * 4);

    return {
      txid,
      version,
      locktime,
      size,
      weight,
      fee: null,
      status: {
        confirmed: null,
        blockHeight: null,
        blockHash: null,
        blockTime: null
      },
      inputs,
      outputs
    };
  }

  private async fetchWithFallback(
    endpointPath: string,
    refKey?: string,
    refValue?: string
  ): Promise<{ data: unknown; source: 'primary' | 'fallback' }> {
    const startTime = Date.now();
    const primaryUrl = `${this._config.primaryUrl}${endpointPath}`;
    const fallbackUrl = `${this._config.fallbackUrl}${endpointPath}`;

    let primaryError: Error | undefined;

    try {
      let response: Response;
      try {
        response = await fetch(primaryUrl);
      } catch (fetchErr: unknown) {
        primaryError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      }

      if (primaryError === undefined) {
        if (response!.status === 404) {
          throw new BitcoinNotFoundError(`Resource not found at ${primaryUrl}`, {
            ref: refValue ?? primaryUrl
          });
        }

        if (response!.status >= 400 && response!.status < 500) {
          throw new BitcoinNetworkError(`Primary endpoint returned HTTP ${response!.status}`, {
            url: primaryUrl,
            status: response!.status
          });
        }

        if (response!.status >= 500 && response!.status < 600) {
          primaryError = new BitcoinNetworkError(`Primary endpoint returned HTTP ${response!.status}`, {
            url: primaryUrl,
            status: response!.status
          });
        } else {
          let body: unknown;
          try {
            body = await response!.json();
          } catch (jsonErr: unknown) {
            throw new BitcoinInvalidResponseError('Failed to parse primary JSON response', {
              url: primaryUrl,
              reason: jsonErr instanceof Error ? jsonErr.message : String(jsonErr)
            });
          }

          const durationMs = Date.now() - startTime;
          const debugContext: Record<string, unknown> = {
            source: 'primary',
            durationMs
          };
          if (refKey && refValue !== undefined) {
            debugContext[refKey] = refValue;
          }
          this._logger.debug('Esplora primary request succeeded', debugContext);
          return { data: body, source: 'primary' };
        }
      }
    } catch (err: unknown) {
      if (
        err instanceof BitcoinNotFoundError ||
        err instanceof BitcoinNetworkError ||
        err instanceof BitcoinInvalidResponseError
      ) {
        throw err;
      }
      primaryError = err instanceof Error ? err : new Error(String(err));
    }

    if (!primaryError) {
      primaryError = new Error('Unknown primary fetch error');
    }

    const warnContext: Record<string, unknown> = {
      primaryError: primaryError.message
    };
    if (refKey && refValue !== undefined) {
      warnContext[refKey] = refValue;
    }
    this._logger.warn('Esplora primary failed, attempting fallback', warnContext);

    let fallbackResponse: Response | undefined;
    let fallbackError: Error | undefined;

    try {
      try {
        fallbackResponse = await fetch(fallbackUrl);
      } catch (fetchErr: unknown) {
        fallbackError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      }

      if (fallbackError === undefined) {
        if (fallbackResponse!.status === 404) {
          throw new BitcoinNotFoundError(`Resource not found at ${fallbackUrl}`, {
            ref: refValue ?? fallbackUrl
          });
        }

        if (fallbackResponse!.status >= 400 && fallbackResponse!.status < 500) {
          throw new BitcoinNetworkError(`Fallback endpoint returned HTTP ${fallbackResponse!.status}`, {
            url: fallbackUrl,
            status: fallbackResponse!.status
          });
        }

        if (fallbackResponse!.status >= 500 && fallbackResponse!.status < 600) {
          fallbackError = new BitcoinNetworkError(`Fallback endpoint returned HTTP ${fallbackResponse!.status}`, {
            url: fallbackUrl,
            status: fallbackResponse!.status
          });
        } else {
          let body: unknown;
          try {
            body = await fallbackResponse!.json();
          } catch (jsonErr: unknown) {
            throw new BitcoinInvalidResponseError('Failed to parse fallback JSON response', {
              url: fallbackUrl,
              reason: jsonErr instanceof Error ? jsonErr.message : String(jsonErr)
            });
          }

          const durationMs = Date.now() - startTime;
          const debugContext: Record<string, unknown> = {
            source: 'fallback',
            durationMs
          };
          if (refKey && refValue !== undefined) {
            debugContext[refKey] = refValue;
          }
          this._logger.debug('Esplora fallback request succeeded', debugContext);
          return { data: body, source: 'fallback' };
        }
      }
    } catch (err: unknown) {
      if (
        err instanceof BitcoinNotFoundError ||
        err instanceof BitcoinNetworkError ||
        err instanceof BitcoinInvalidResponseError
      ) {
        throw err;
      }
      fallbackError = err instanceof Error ? err : new Error(String(err));
    }

    if (!fallbackError) {
      fallbackError = new Error('Unknown fallback fetch error');
    }

    const errorContext: Record<string, unknown> = {
      primaryError: primaryError.message,
      fallbackError: fallbackError.message
    };
    if (refKey && refValue !== undefined) {
      errorContext[refKey] = refValue;
    }
    this._logger.error('Both Esplora endpoints failed', undefined, errorContext);

    throw new BitcoinNetworkError('Both primary and fallback Esplora endpoints failed', {
      url: fallbackUrl,
      primaryError: primaryError.message,
      fallbackError: fallbackError.message
    });
  }

  public async getTransaction(txid: string): Promise<BitcoinTransaction> {
    if (!/^[0-9a-f]{64}$/.test(txid)) {
      throw new BitcoinParseError('Invalid txid: must be a 64-character lowercase hex string', {
        input: txid,
        reason: 'Invalid txid format'
      });
    }

    const { data, source } = await this.fetchWithFallback(`/tx/${txid}`, 'txid', txid);
    const activeUrl = source === 'primary'
      ? `${this._config.primaryUrl}/tx/${txid}`
      : `${this._config.fallbackUrl}/tx/${txid}`;

    const parseResult = EsploraTxSchema.safeParse(data);
    if (!parseResult.success) {
      throw new BitcoinInvalidResponseError('Transaction response shape does not match schema', {
        url: activeUrl,
        reason: parseResult.error.message
      });
    }

    const raw = parseResult.data;
    const inputs: BitcoinInput[] = raw.vin.map((vin) => ({
      txid: vin.txid,
      vout: vin.vout,
      prevout: vin.prevout
        ? {
            scriptpubkey: vin.prevout.scriptpubkey,
            scriptpubkeyAddress: vin.prevout.scriptpubkey_address ?? null,
            value: BigInt(vin.prevout.value)
          }
        : null,
      scriptsig: vin.scriptsig,
      sequence: vin.sequence,
      witness: vin.witness ?? []
    }));

    const outputs: BitcoinOutput[] = raw.vout.map((vout) => ({
      scriptpubkey: vout.scriptpubkey,
      scriptpubkeyAddress: vout.scriptpubkey_address ?? null,
      value: BigInt(vout.value)
    }));

    return {
      txid: raw.txid,
      version: raw.version,
      locktime: raw.locktime,
      size: raw.size,
      weight: raw.weight,
      fee: BigInt(raw.fee),
      status: {
        confirmed: raw.status.confirmed,
        blockHeight: raw.status.block_height ?? null,
        blockHash: raw.status.block_hash ?? null,
        blockTime: raw.status.block_time ?? null
      },
      inputs,
      outputs
    };
  }

  public async getAddressInfo(address: string): Promise<BitcoinAddressInfo> {
    if (!/^(bc1|1|3|tb1|m|n|2|bcrt1)[a-zA-HJ-NP-Z0-9]+$/.test(address)) {
      throw new BitcoinParseError('Invalid address: does not match any supported Bitcoin prefix', {
        input: address,
        reason: 'Invalid address prefix'
      });
    }

    const { data, source } = await this.fetchWithFallback(`/address/${address}`, 'address', address);
    const activeUrl = source === 'primary'
      ? `${this._config.primaryUrl}/address/${address}`
      : `${this._config.fallbackUrl}/address/${address}`;

    const parseResult = EsploraAddressInfoSchema.safeParse(data);
    if (!parseResult.success) {
      throw new BitcoinInvalidResponseError('Address info response shape does not match schema', {
        url: activeUrl,
        reason: parseResult.error.message
      });
    }

    const raw = parseResult.data;
    return {
      address: raw.address,
      chainStats: {
        fundedTxoCount: raw.chain_stats.funded_txo_count,
        fundedTxoSum: BigInt(raw.chain_stats.funded_txo_sum),
        spentTxoCount: raw.chain_stats.spent_txo_count,
        spentTxoSum: BigInt(raw.chain_stats.spent_txo_sum)
      },
      mempoolStats: {
        fundedTxoCount: raw.mempool_stats.funded_txo_count,
        fundedTxoSum: BigInt(raw.mempool_stats.funded_txo_sum),
        spentTxoCount: raw.mempool_stats.spent_txo_count,
        spentTxoSum: BigInt(raw.mempool_stats.spent_txo_sum)
      }
    };
  }

  public async getBlockTip(): Promise<BitcoinBlockTip> {
    const { data, source } = await this.fetchWithFallback('/blocks');
    const activeUrl = source === 'primary'
      ? `${this._config.primaryUrl}/blocks`
      : `${this._config.fallbackUrl}/blocks`;

    const parseResult = EsploraBlocksResponseSchema.safeParse(data);
    if (!parseResult.success) {
      throw new BitcoinInvalidResponseError('Block tip response shape does not match schema', {
        url: activeUrl,
        reason: parseResult.error.message
      });
    }

    const block = Array.isArray(parseResult.data) ? parseResult.data[0] : parseResult.data;
    if (!block) {
      throw new BitcoinInvalidResponseError('Block tip response array is empty', {
        url: activeUrl,
        reason: 'Empty block list'
      });
    }

    return {
      height: block.height,
      hash: block.id,
      timestamp: block.timestamp
    };
  }
}
