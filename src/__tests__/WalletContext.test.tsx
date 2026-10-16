import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { NETWORK_RECHECK_INTERVAL_MS, WalletProvider, useWalletContext } from '../context/WalletContext';
import { connectWallet, getWalletNetworkPassphrase } from '@/lib/stellar';
import { fetchChallenge, login } from '@/lib/api';

vi.mock('@/lib/stellar', () => ({
  connectWallet:              vi.fn(),
  disconnectWallet:           vi.fn(),
  getStoredAddress:           vi.fn(() => null),
  getConnectedAddress:        vi.fn(),
  getWalletNetworkPassphrase: vi.fn(async () => null),
  signAuthMessage:            vi.fn(async (c: string) => `signed:${c}`),
  EXPECTED_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
}));

vi.mock('@/lib/api', () => ({
  fetchChallenge:     vi.fn(),
  login:              vi.fn(),
  setAuthErrorHandler: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  default: {
    getSession:    vi.fn(() => null),
    setSession:    vi.fn(),
    removeSession: vi.fn(),
  },
}));

interface WalletHandle {
  readonly ctx: ReturnType<typeof useWalletContext>;
}

function renderWallet(): WalletHandle {
  let captured: ReturnType<typeof useWalletContext> | undefined;
  const container = document.createElement('div');
  let root: Root;

  function Consumer() {
    captured = useWalletContext();
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>,
    );
  });

  return {
    get ctx() {
      return captured!;
    },
  };
}

describe('WalletProvider auth-failure error handling (issue #221)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchChallenge as Mock).mockResolvedValue('challenge-123');
  });

  it('preserves the auth-failure message even though disconnect() clears error', async () => {
    // A wallet connects fine, but the login exchange fails. disconnect() runs
    // inside the catch and ends with setError(null); the fix orders it BEFORE
    // setError(...) so the message survives instead of being wiped.
    (connectWallet as Mock).mockResolvedValue({ address: 'GTEST', networkPassphrase: null });
    (login as Mock).mockRejectedValue(new Error('login rejected'));

    const handle = renderWallet();

    await act(async () => {
      await handle.ctx.connect();
    });

    expect(handle.ctx.error).toBe('Auth failed: login rejected');
    expect(handle.ctx.connected).toBe(false);
  });
});

describe('WalletProvider network re-check after a wallet switch (#724)', () => {
  const TESTNET = 'Test SDF Network ; September 2015';
  const PUBLIC = 'Public Global Stellar Network ; September 2015';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (fetchChallenge as Mock).mockResolvedValue('challenge-123');
    (login as Mock).mockResolvedValue({ token: 'jwt' });
    (connectWallet as Mock).mockResolvedValue({ address: 'GABC', networkPassphrase: TESTNET });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates networkPassphrase when the wallet switches networks after connecting', async () => {
    (getWalletNetworkPassphrase as Mock).mockResolvedValue(TESTNET);
    const wallet = renderWallet();
    await act(async () => {
      await wallet.ctx.connect();
    });
    expect(wallet.ctx.networkPassphrase).toBe(TESTNET);

    // User switches to mainnet in the wallet; the next re-check picks it up.
    (getWalletNetworkPassphrase as Mock).mockResolvedValue(PUBLIC);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NETWORK_RECHECK_INTERVAL_MS);
    });
    expect(wallet.ctx.networkPassphrase).toBe(PUBLIC);
  });

  it('re-checks immediately when the window regains focus', async () => {
    (getWalletNetworkPassphrase as Mock).mockResolvedValue(TESTNET);
    const wallet = renderWallet();
    await act(async () => {
      await wallet.ctx.connect();
    });

    (getWalletNetworkPassphrase as Mock).mockResolvedValue(PUBLIC);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(wallet.ctx.networkPassphrase).toBe(PUBLIC);
  });
});
