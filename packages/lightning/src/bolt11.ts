import { LightningParseError } from './errors';
import { LightningInvoice } from './types';

export class Bolt11 {
  private static readonly BECH32_CHARSET: string = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  private static readonly BECH32_CONST: number = 1;
  private static readonly DEFAULT_EXPIRY_SECONDS: number = 3600;
  private static readonly SIGNATURE_WORDS: number = 104;
  private static readonly TIMESTAMP_WORDS: number = 7;
  private static readonly CHECKSUM_WORDS: number = 6;
  private static readonly MIN_PAYLOAD_WORDS: number = Bolt11.TIMESTAMP_WORDS + Bolt11.SIGNATURE_WORDS;

  private static polymod(values: readonly number[]): number {
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

  private static hrpExpand(hrp: string): number[] {
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

  private static convertBits(data: readonly number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
    let acc = 0;
    let bits = 0;
    const ret: number[] = [];
    const maxv = (1 << toBits) - 1;
    for (const value of data) {
      if (value < 0 || (value >> fromBits) !== 0) {
        return null;
      }
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

  private static parseAmountMsat(remainder: string, invoice: string): bigint {
    if (remainder.length === 0) {
      return 0n;
    }

    const match = remainder.match(/^([0-9]+)([munp]?)$/);
    if (!match) {
      throw new LightningParseError('Invalid amount or multiplier in invoice HRP', {
        input: invoice,
        reason: `Malformed amount specification: ${remainder}`
      });
    }

    const numStr = match[1];
    const multiplier = match[2];
    if (numStr.length > 1 && numStr.startsWith('0')) {
      throw new LightningParseError('Invalid amount in invoice HRP: leading zeros are not allowed', {
        input: invoice,
        reason: `Amount ${numStr} contains leading zero`
      });
    }

    const amountVal = BigInt(numStr);
    if (multiplier === 'm') {
      return amountVal * 100_000_000n;
    }
    if (multiplier === 'u') {
      return amountVal * 100_000n;
    }
    if (multiplier === 'n') {
      return amountVal * 100n;
    }
    if (multiplier === 'p') {
      if (amountVal % 10n !== 0n) {
        throw new LightningParseError('Pico-Bitcoin amount must be a multiple of 10', {
          input: invoice,
          reason: `Pico-Bitcoin amount ${numStr} must end with 0`
        });
      }
      return amountVal / 10n;
    }
    return amountVal * 100_000_000_000n;
  }

  public static decode(invoice: string): LightningInvoice {
    if (typeof invoice !== 'string' || invoice.trim().length === 0) {
      throw new LightningParseError('Invoice string cannot be empty', {
        input: invoice,
        reason: 'Input must be a non-empty string'
      });
    }

    const isAllLower = invoice === invoice.toLowerCase();
    const isAllUpper = invoice === invoice.toUpperCase();
    if (!isAllLower && !isAllUpper) {
      throw new LightningParseError('Mixed case invoice string is not allowed in bech32', {
        input: invoice,
        reason: 'Invoice contains both uppercase and lowercase characters'
      });
    }

    const cleanInvoice = invoice.toLowerCase();
    const sepIndex = cleanInvoice.lastIndexOf('1');
    if (sepIndex === -1) {
      throw new LightningParseError('Missing bech32 separator 1 in invoice', {
        input: invoice,
        reason: 'No separator 1 found in string'
      });
    }

    if (sepIndex === 0) {
      throw new LightningParseError('Missing human-readable part (HRP) in invoice', {
        input: invoice,
        reason: 'Separator 1 is at index 0'
      });
    }

    const hrp = cleanInvoice.slice(0, sepIndex);
    const dataStr = cleanInvoice.slice(sepIndex + 1);

    if (dataStr.length < Bolt11.CHECKSUM_WORDS) {
      throw new LightningParseError('Invoice data part is too short', {
        input: invoice,
        reason: `Data part length ${dataStr.length} is less than required checksum length ${Bolt11.CHECKSUM_WORDS}`
      });
    }

    let prefix = '';
    if (hrp.startsWith('lnbcrt')) {
      prefix = 'lnbcrt';
    } else if (hrp.startsWith('lnbc')) {
      prefix = 'lnbc';
    } else if (hrp.startsWith('lntb')) {
      prefix = 'lntb';
    } else if (hrp === 'ln') {
      prefix = 'ln';
    } else {
      throw new LightningParseError('Unsupported invoice HRP network prefix', {
        input: invoice,
        reason: `HRP must start with lnbc, lntb, lnbcrt, or be ln`
      });
    }

    const remainder = hrp.slice(prefix.length);
    const amountMsat = Bolt11.parseAmountMsat(remainder, invoice);

    const dataWords: number[] = [];
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr[i];
      const word = Bolt11.BECH32_CHARSET.indexOf(char);
      if (word === -1) {
        throw new LightningParseError('Invalid bech32 character in invoice data part', {
          input: invoice,
          reason: `Character '${char}' at index ${sepIndex + 1 + i} is not in bech32 charset`
        });
      }
      dataWords.push(word);
    }

    const checksumValid = Bolt11.polymod([...Bolt11.hrpExpand(hrp), ...dataWords]) === Bolt11.BECH32_CONST;
    if (!checksumValid) {
      throw new LightningParseError('Invalid bech32 checksum in invoice', {
        input: invoice,
        reason: 'Bech32 polymod checksum verification failed'
      });
    }

    const payloadWords = dataWords.slice(0, dataWords.length - Bolt11.CHECKSUM_WORDS);
    if (payloadWords.length < Bolt11.MIN_PAYLOAD_WORDS) {
      throw new LightningParseError('Invoice payload is too short to contain timestamp and signature', {
        input: invoice,
        reason: `Payload length ${payloadWords.length} is less than minimum ${Bolt11.MIN_PAYLOAD_WORDS}`
      });
    }

    let timestamp = 0;
    for (let i = 0; i < Bolt11.TIMESTAMP_WORDS; i++) {
      timestamp = timestamp * 32 + payloadWords[i];
    }

    const taggedWords = payloadWords.slice(Bolt11.TIMESTAMP_WORDS, payloadWords.length - Bolt11.SIGNATURE_WORDS);

    let offset = 0;
    let paymentHash: string | null = null;
    let description = '';
    let descriptionHash: string | null = null;
    let payeePubkey = '';
    let expiry = Bolt11.DEFAULT_EXPIRY_SECONDS;

    while (offset < taggedWords.length) {
      if (offset + 3 > taggedWords.length) {
        throw new LightningParseError('Truncated tagged field header', {
          input: invoice,
          reason: 'Insufficient data words remaining for tagged field header'
        });
      }

      const tagChar = Bolt11.BECH32_CHARSET.charAt(taggedWords[offset]);
      const dataLength = (taggedWords[offset + 1] << 5) | taggedWords[offset + 2];
      offset += 3;

      if (offset + dataLength > taggedWords.length) {
        throw new LightningParseError('Truncated tagged field data', {
          input: invoice,
          reason: `Tagged field '${tagChar}' requires ${dataLength} words but only ${taggedWords.length - offset} remain`
        });
      }

      const fieldWords = taggedWords.slice(offset, offset + dataLength);
      offset += dataLength;

      switch (tagChar) {
        case 'p': {
          const bytes = Bolt11.convertBits(fieldWords, 5, 8, false);
          if (!bytes || bytes.length !== 32) {
            throw new LightningParseError('Invalid payment hash tagged field', {
              input: invoice,
              reason: 'Payment hash must decode to exactly 32 bytes'
            });
          }
          paymentHash = Buffer.from(bytes).toString('hex');
          break;
        }
        case 'd': {
          const bytes = Bolt11.convertBits(fieldWords, 5, 8, false);
          if (!bytes) {
            throw new LightningParseError('Invalid description tagged field', {
              input: invoice,
              reason: 'Failed to convert 5-bit description words to bytes'
            });
          }
          description = Buffer.from(bytes).toString('utf-8');
          break;
        }
        case 'h': {
          const bytes = Bolt11.convertBits(fieldWords, 5, 8, false);
          if (!bytes || bytes.length !== 32) {
            throw new LightningParseError('Invalid description hash tagged field', {
              input: invoice,
              reason: 'Description hash must decode to exactly 32 bytes'
            });
          }
          descriptionHash = Buffer.from(bytes).toString('hex');
          break;
        }
        case 'n': {
          const bytes = Bolt11.convertBits(fieldWords, 5, 8, false);
          if (!bytes || bytes.length !== 33) {
            throw new LightningParseError('Invalid payee pubkey tagged field', {
              input: invoice,
              reason: 'Payee pubkey must decode to exactly 33 bytes'
            });
          }
          payeePubkey = Buffer.from(bytes).toString('hex');
          break;
        }
        case 'x': {
          let parsedExpiry = 0;
          for (const w of fieldWords) {
            parsedExpiry = parsedExpiry * 32 + w;
          }
          expiry = parsedExpiry;
          break;
        }
        case 'c':
        case 's':
        case '9':
        default:
          break;
      }
    }

    if (!paymentHash) {
      throw new LightningParseError('Missing required payment hash tagged field (p)', {
        input: invoice,
        reason: 'Invoice does not contain a payment hash (p) tag'
      });
    }

    const expiresAt = timestamp + expiry;

    return {
      bolt11: invoice,
      paymentHash,
      preimage: null,
      amountMsat,
      description,
      descriptionHash,
      timestamp,
      expiry,
      payeePubkey,
      expiresAt
    };
  }
}
