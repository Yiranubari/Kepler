import { XpubDeriver } from '../../src/modules/onchain/xpub.deriver';
import { OnchainDerivationError } from '../../src/modules/onchain/onchain.errors';

describe('XpubDeriver', () => {
  const knownTestnet4Xpub = 'tpubDDCFgoRpYFCJcFsk3ab8TuhQBxdcyEq9zMXjnSJwRJ5B27rFcCReyVABP6q3CG2hZ2VouPALBF2YqswEyCJKRPQerYDtWxoNaHicmru1FDD';
  const expectedTestnet4Addresses = [
    'tb1qtpdhsnahcrj40j9g6zd23yy807pdg2cxy4dlgu',
    'tb1qrh9m93w4mzvm7ezrc4qd2v9gpgfhazs6dws7hx',
    'tb1qxscfdwvmf27chhk40tg27aqhl8p233z3r9l9px',
    'tb1qe6qjpadgtl9qw4ltzr0ac8xpmsdrpr2q3lrmfz',
    'tb1q8raknqkyra5n03tv98fnaqc4tzx7ggjt036kjz'
  ];
  const expectedTestnet4ChangeAddress = 'tb1q44tjd52tv7sha3ujnr80h3fty2k088ag56txz9';

  const validMainnetXpub = 'xpub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
  const validMainnetXpriv = 'xprv9s21ZrQH143K25QhxbucbDDuQ4naNntJRi4KUfWT7GeR5PEXv2wT7fHg8BpLFiW2Dw65VDV9eLTWA583vgxokWBG8GQ6Bp5TpaGeexDtu9Y';

  describe('deriveAddresses', () => {
    it('is pure and deterministic for the same arguments', () => {
      const run1 = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 3, false);
      const run2 = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 3, false);
      expect(run1).toEqual(run2);
      expect(run1).toHaveLength(3);
    });

    it('derives 5 addresses from a known testnet4 xpub matching reference implementation', () => {
      const addresses = XpubDeriver.deriveAddresses(knownTestnet4Xpub, 'testnet4', 5, false);
      expect(addresses).toHaveLength(5);
      expect(addresses).toEqual(expectedTestnet4Addresses);
    });

    it('derives mainnet P2WPKH receiving addresses starting with bc1q', () => {
      const addresses = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 2, false);
      expect(addresses[0]).toMatch(/^bc1q/);
      expect(addresses[1]).toMatch(/^bc1q/);
      expect(addresses[0]).not.toEqual(addresses[1]);
    });

    it('derives distinct change addresses starting with bc1q on mainnet', () => {
      const receive = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 1, false);
      const change = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 1, true);
      expect(receive[0]).toMatch(/^bc1q/);
      expect(change[0]).toMatch(/^bc1q/);
      expect(receive[0]).not.toEqual(change[0]);
    });

    it('throws OnchainDerivationError on malformed xpub', () => {
      expect(() => {
        XpubDeriver.deriveAddresses('invalid', 'testnet4', 1, false);
      }).toThrow(OnchainDerivationError);
    });

    it('throws OnchainDerivationError when xpub has invalid checksum', () => {
      const badChecksum = validMainnetXpub.slice(0, -4) + '0000';
      expect(() => {
        XpubDeriver.deriveAddresses(badChecksum, 'mainnet', 1, false);
      }).toThrow(OnchainDerivationError);
    });

    it('throws OnchainDerivationError when private key is supplied', () => {
      expect(() => {
        XpubDeriver.deriveAddresses(validMainnetXpriv, 'mainnet', 1, false);
      }).toThrow(OnchainDerivationError);
    });

    it('throws OnchainDerivationError on unsupported network', () => {
      expect(() => {
        XpubDeriver.deriveAddresses(
          knownTestnet4Xpub,
          'unsupported' as unknown as 'mainnet',
          1,
          false
        );
      }).toThrow(OnchainDerivationError);
    });

    it('throws OnchainDerivationError on invalid count values', () => {
      expect(() => {
        XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 0, false);
      }).toThrow(OnchainDerivationError);

      expect(() => {
        XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 101, false);
      }).toThrow(OnchainDerivationError);

      expect(() => {
        XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 1.5, false);
      }).toThrow(OnchainDerivationError);
    });
  });

  describe('deriveChangeAddress', () => {
    it('derives the change address under the m/1/0 path', () => {
      const changeAddress = XpubDeriver.deriveChangeAddress(knownTestnet4Xpub, 'testnet4');
      expect(changeAddress).toBe(expectedTestnet4ChangeAddress);
      expect(changeAddress).toMatch(/^tb1q/);
    });

    it('returns the first change address for the given network', () => {
      const expected = XpubDeriver.deriveAddresses(validMainnetXpub, 'mainnet', 1, true)[0];
      const result = XpubDeriver.deriveChangeAddress(validMainnetXpub, 'mainnet');
      expect(result).toBe(expected);
      expect(result).toMatch(/^bc1q/);
    });

    it('propagates OnchainDerivationError on invalid key', () => {
      expect(() => {
        XpubDeriver.deriveChangeAddress('invalid-key', 'mainnet');
      }).toThrow(OnchainDerivationError);
    });
  });
});
