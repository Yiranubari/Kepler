import {
  BitcoinScriptType,
  BitcoinOutput,
  BitcoinInput,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip
} from '../../src';

describe('Bitcoin Types', () => {
  it('instantiates valid BitcoinOutput shapes', () => {
    const output: BitcoinOutput = {
      scriptpubkey: '0014751e76e8199196d454941c45d1b3a323f1433bd6',
      scriptpubkeyAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      value: 100000000n
    };

    expect(output.scriptpubkey).toBe('0014751e76e8199196d454941c45d1b3a323f1433bd6');
    expect(output.scriptpubkeyAddress).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect(output.value).toBe(100000000n);
  });

  it('allows null scriptpubkeyAddress for OP_RETURN or non-standard outputs', () => {
    const opReturnOutput: BitcoinOutput = {
      scriptpubkey: '6a146b65706c6572207461696e742065766964656e63',
      scriptpubkeyAddress: null,
      value: 0n
    };

    expect(opReturnOutput.scriptpubkeyAddress).toBeNull();
    expect(opReturnOutput.value).toBe(0n);
  });

  it('instantiates valid BitcoinInput shapes with prevout', () => {
    const input: BitcoinInput = {
      txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
      vout: 0,
      prevout: {
        scriptpubkey: '76a914000000000000000000000000000000000000000088ac',
        scriptpubkeyAddress: '1111111111111111111114oLvT2',
        value: 5000000000n
      },
      scriptsig: '483045...',
      sequence: 4294967295,
      witness: ['30440220...', '02...']
    };

    expect(input.txid).toBe('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b');
    expect(input.vout).toBe(0);
    expect(input.prevout).not.toBeNull();
    expect(input.prevout?.value).toBe(5000000000n);
    expect(input.sequence).toBe(4294967295);
    expect(input.witness).toHaveLength(2);
  });

  it('allows null prevout for coinbase inputs', () => {
    const coinbaseInput: BitcoinInput = {
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      vout: 4294967295,
      prevout: null,
      scriptsig: '03233708',
      sequence: 4294967295,
      witness: []
    };

    expect(coinbaseInput.prevout).toBeNull();
  });

  it('instantiates valid BitcoinTransaction shapes', () => {
    const tx: BitcoinTransaction = {
      txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16',
      version: 1,
      locktime: 0,
      size: 225,
      weight: 900,
      fee: 1000n,
      status: {
        confirmed: true,
        blockHeight: 170,
        blockHash: '00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee',
        blockTime: 1231731365
      },
      inputs: [
        {
          txid: '0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9',
          vout: 0,
          prevout: {
            scriptpubkey: '76a914...',
            scriptpubkeyAddress: '12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S',
            value: 1000000000n
          },
          scriptsig: '483045...',
          sequence: 4294967295,
          witness: []
        }
      ],
      outputs: [
        {
          scriptpubkey: '76a914...',
          scriptpubkeyAddress: '1aXzEKiDJKzkPxTZy9zmM2PpnGWnFuvgy',
          value: 999999000n
        }
      ]
    };

    expect(tx.txid).toBe('f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16');
    expect(tx.status.confirmed).toBe(true);
    expect(tx.status.blockHeight).toBe(170);
    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
  });

  it('handles unconfirmed BitcoinTransaction with nullable status fields', () => {
    const unconfirmedTx: BitcoinTransaction = {
      txid: 'unconfirmed_txid',
      version: 2,
      locktime: 700000,
      size: 140,
      weight: 560,
      fee: 250n,
      status: {
        confirmed: false,
        blockHeight: null,
        blockHash: null,
        blockTime: null
      },
      inputs: [],
      outputs: []
    };

    expect(unconfirmedTx.status.confirmed).toBe(false);
    expect(unconfirmedTx.status.blockHeight).toBeNull();
    expect(unconfirmedTx.status.blockHash).toBeNull();
    expect(unconfirmedTx.status.blockTime).toBeNull();
  });

  it('handles parsed BitcoinTransaction with null fee and status fields', () => {
    const parsedTx: BitcoinTransaction = {
      txid: 'parsed_txid',
      version: 2,
      locktime: 0,
      size: 140,
      weight: 560,
      fee: null,
      status: {
        confirmed: null,
        blockHeight: null,
        blockHash: null,
        blockTime: null
      },
      inputs: [],
      outputs: []
    };

    expect(parsedTx.fee).toBeNull();
    expect(parsedTx.status.confirmed).toBeNull();
  });

  it('instantiates valid BitcoinAddressInfo shapes with bigint sums', () => {
    const info: BitcoinAddressInfo = {
      address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      chainStats: {
        fundedTxoCount: 5,
        fundedTxoSum: 5000000000n,
        spentTxoCount: 3,
        spentTxoSum: 3000000000n
      },
      mempoolStats: {
        fundedTxoCount: 1,
        fundedTxoSum: 100000000n,
        spentTxoCount: 0,
        spentTxoSum: 0n
      }
    };

    expect(info.address).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect(info.chainStats.fundedTxoSum - info.chainStats.spentTxoSum).toBe(2000000000n);
    expect(info.mempoolStats.fundedTxoCount).toBe(1);
    expect(info.mempoolStats.spentTxoSum).toBe(0n);
  });

  it('instantiates valid BitcoinBlockTip shapes', () => {
    const tip: BitcoinBlockTip = {
      height: 840000,
      hash: '0000000000000000000320283a032748acf82278b65747026f4948b869b900f2',
      timestamp: 1713571767
    };

    expect(tip.height).toBe(840000);
    expect(tip.hash).toBe('0000000000000000000320283a032748acf82278b65747026f4948b869b900f2');
    expect(tip.timestamp).toBe(1713571767);
  });

  it('validates BitcoinScriptType union values', () => {
    const validScriptTypes: BitcoinScriptType[] = [
      'p2pkh',
      'p2sh',
      'p2wpkh',
      'p2wsh',
      'p2tr',
      'op_return',
      'unknown'
    ];

    expect(validScriptTypes).toHaveLength(7);
  });
});
