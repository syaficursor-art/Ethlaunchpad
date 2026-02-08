import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useNetwork } from "wagmi";
import { formatAddress } from "../lib/contract";

type Status = {
  type: "pending" | "success" | "error" | "idle";
  message: string;
};

type WalletMenuProps = {
  onStatus?: (status: Status) => void;
};

export default function WalletMenu({ onStatus }: WalletMenuProps) {
  const { address, isConnected, connector } = useAccount();
  const { chain } = useNetwork();
  const { connect, connectors, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: chain?.id });

  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const networkLabel = chain?.name || "Not connected";
  const balanceLabel = balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : "--";
  const explorer = chain?.blockExplorers?.default?.url;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (autoConnectAttempted || isConnected) return;
    if (typeof window === "undefined") return;
    const lastConnectorId = window.localStorage.getItem("preferredConnector");
    if (!lastConnectorId || lastConnectorId === "walletConnect") {
      setAutoConnectAttempted(true);
      return;
    }
    const target = connectors.find((item) => item.id === lastConnectorId);
    if (!target || !target.ready) {
      setAutoConnectAttempted(true);
      return;
    }
    try {
      connect({ connector: target });
    } catch {
      // ignore auto-connect errors
    } finally {
      setAutoConnectAttempted(true);
    }
  }, [autoConnectAttempted, connect, connectors, isConnected]);

  const requestWalletPermission = async (connectorOption: any) => {
    try {
      if (!connectorOption?.getProvider) return;
      const provider = await connectorOption.getProvider();
      if (!provider?.request) return;
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets don't support explicit permission requests.
    }
  };

  const handleConnect = async (connectorOption: any) => {
    if (!connectorOption.ready) {
      onStatus?.({
        type: "error",
        message: "MetaMask not detected. Please install or enable the extension.",
      });
      return;
    }
    try {
      await requestWalletPermission(connectorOption);
      connect({ connector: connectorOption });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("preferredConnector", connectorOption.id);
      }
    } catch (error: any) {
      onStatus?.({
        type: "error",
        message: error?.message || "Failed to connect wallet",
      });
    }
    setOpen(false);
    setModalOpen(false);
  };

  const handleDisconnect = async () => {
    try {
      await connector?.disconnect?.();
    } catch {
      // ignore
    }
    disconnect();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("preferredConnector");
    }
    setOpen(false);
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      onStatus?.({ type: "success", message: "Address copied" });
    } catch {
      onStatus?.({ type: "error", message: "Failed to copy address" });
    }
  };

  const shortAddress = useMemo(() => {
    return address ? formatAddress(address) : "";
  }, [address]);

  const metaMaskConnector = connectors.find((item) => item.id === "metaMask");
  const walletConnectConnector = connectors.find((item) => item.id === "walletConnect");
  const coinbaseConnector = connectors.find((item) => item.id === "coinbaseWallet");

  const handleWalletConnect = () => {
    if (!walletConnectConnector) return;
    try {
      connect({ connector: walletConnectConnector });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("preferredConnector", walletConnectConnector.id);
      }
    } catch (error: any) {
      onStatus?.({
        type: "error",
        message:
          error?.message ||
          "WalletConnect relay not reachable. Please use MetaMask or try again.",
      });
    }
    setModalOpen(false);
  };

  const handleBaseAccount = () => {
    handleWalletConnect();
  };

  const handleAbstract = () => {
    handleWalletConnect();
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      {isConnected ? (
        <button
          className="flex items-center gap-3 rounded-full border border-slate-600/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400/70 via-cyan-400/70 to-indigo-400/70" />
          <span className="font-semibold">{shortAddress}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {networkLabel}
          </span>
        </button>
      ) : (
        <button
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          onClick={() => setModalOpen(true)}
        >
          Connect Wallet
          <span className="text-slate-400">▾</span>
        </button>
      )}

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-72 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-xl backdrop-blur">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Wallet</span>
                <span>{balanceLabel}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{shortAddress}</div>
            </div>
            <div className="space-y-2">
              <button className="menu-item" onClick={handleCopy}>
                Copy address
              </button>
              {explorer ? (
                <a
                  className="menu-item"
                  href={`${explorer}/address/${address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on explorer
                </a>
              ) : null}
              <button className="menu-item" onClick={() => setModalOpen(true)}>
                Switch wallet
              </button>
              <button className="menu-item text-red-200" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <button className="wallet-close" onClick={() => setModalOpen(false)}>
              X
            </button>
            <div className="wallet-modal-header">
              <div className="wallet-modal-logo wallet-modal-logo--generic" aria-hidden />
              <h3>Connect Wallet</h3>
              <p>Select a wallet to continue.</p>
            </div>
            <div className="wallet-modal-list">
              <button
                className="wallet-option"
                onClick={() => metaMaskConnector && handleConnect(metaMaskConnector)}
              >
                <img className="wallet-logo-img" src="/wallets/metamask.svg" alt="MetaMask" />
                <span>MetaMask</span>
              </button>
              <button className="wallet-option" onClick={handleBaseAccount}>
                <img className="wallet-logo-img" src="/wallets/base.svg" alt="Base Account" />
                <span>Base Account</span>
              </button>
              <button className="wallet-option" onClick={handleWalletConnect}>
                <img className="wallet-logo-img" src="/wallets/walletconnect.svg" alt="WalletConnect" />
                <span>WalletConnect</span>
              </button>
              <button className="wallet-option" onClick={handleAbstract}>
                <img className="wallet-logo-img" src="/wallets/abstract.svg" alt="Abstract" />
                <span>Abstract</span>
              </button>
              <button
                className="wallet-option"
                onClick={() => coinbaseConnector && handleConnect(coinbaseConnector)}
              >
                <img className="wallet-logo-img" src="/wallets/coinbase.svg" alt="Coinbase Wallet" />
                <span>Coinbase Wallet</span>
              </button>
              <button className="wallet-option" onClick={handleWalletConnect}>
                <img className="wallet-logo-img" src="/wallets/more.svg" alt="More Wallet Options" />
                <span>More Wallet Options</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
