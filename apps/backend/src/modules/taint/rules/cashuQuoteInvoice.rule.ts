import {
  TaintNodeType,
  EdgeDraft,
  EvidenceItem
} from '@kepler/shared';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from './rule.interface';

export class CashuQuoteInvoiceRule implements TaintRule {
  public readonly name: string = 'cashu_quote_invoice';
  public readonly description: string =
    'Emits an edge between a Cashu mint and a Lightning payment hash when the mint quote reference matches.';
  public readonly relationship: string = 'CASHU_QUOTE_INVOICE';
  public readonly maxConfidence: number = 1.0;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const paymentHashNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.PaymentHash)
      .sort((a, b) => a.id.localeCompare(b.id));

    const mintNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.Mint)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges: EdgeDraft[] = [];

    for (const mintNode of mintNodes) {
      const rawQuoteHashes = mintNode.metadata
        ? mintNode.metadata['quoteHashes']
        : undefined;

      if (!Array.isArray(rawQuoteHashes)) {
        continue;
      }

      const isAll64Hex = rawQuoteHashes.every(
        (item) => typeof item === 'string' && /^[0-9a-f]{64}$/i.test(item.trim())
      );
      if (!isAll64Hex) {
        continue;
      }

      const mintUrl =
        typeof mintNode.value === 'string' ? mintNode.value : mintNode.id;

      for (const rawHash of rawQuoteHashes) {
        const quoteHash = (rawHash as string).trim().toLowerCase();

        for (const paymentHashNode of paymentHashNodes) {
          const paymentHash =
            typeof paymentHashNode.value === 'string'
              ? paymentHashNode.value.trim().toLowerCase()
              : paymentHashNode.id.toLowerCase();

          if (paymentHash === quoteHash) {
            edges.push({
              from: mintNode.id,
              to: paymentHashNode.id,
              relationship: this.relationship,
              confidence: this.maxConfidence,
              evidence: [
                new EvidenceItem({
                  kind: 'RawData',
                  ref: quoteHash,
                  description: `Cashu mint ${mintUrl} issued a quote for payment hash ${quoteHash}.`,
                  data: {
                    field: 'quoteHash',
                    match: quoteHash
                  }
                })
              ]
            });
          }
        }
      }
    }

    return { edges };
  }
}
