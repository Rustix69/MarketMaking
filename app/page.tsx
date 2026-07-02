"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  Dices,
  NotebookPen,
  RefreshCcw,
  Timer,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "maker" | "participant";
type DiceFace = number | "H";
type TradeAction = "buy" | "sell";

type TradePoint = {
  label: string;
  value: number;
};

type LockedTrade = {
  action: TradeAction;
  price: number;
  qty: number;
};

type MarketResult = {
  buyers: number;
  sellers: number;
  bid: number;
  offer: number;
  spread: number;
};

const MAX_TRADES = 5;
const ROUND_SECONDS = 15;
const INITIAL_BID_OFFER = { bid: 9, offer: 12 };

const randomDie = () => Math.ceil(Math.random() * 6);

function createDiceState(): DiceFace[] {
  const values: DiceFace[] = [
    Math.random() > 0.5 ? randomDie() : "H",
    Math.random() > 0.5 ? randomDie() : "H",
    Math.random() > 0.5 ? randomDie() : "H",
  ];

  if (!values.includes("H")) {
    values[Math.floor(Math.random() * values.length)] = "H";
  }

  return values;
}

function createBidOffer() {
  const bid = Math.max(3, Math.min(18, Math.ceil(Math.random() * 16 + 2)));
  const offer = Math.min(18, bid + 2 + Math.floor(Math.random() * 2));

  return { bid, offer };
}

function resolveDice(values: DiceFace[]): number {
  return values.reduce<number>((sum, value) => {
    return sum + (value === "H" ? randomDie() : value);
  }, 0);
}

function formatPrice(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export default function MarketMakingGame() {
  const [role, setRole] = useState<Role>("maker");
  const [dice, setDice] = useState<DiceFace[]>(["H", "H", "H"]);
  const [bidOffer, setBidOffer] = useState(INITIAL_BID_OFFER);
  const [progress, setProgress] = useState(100);
  const [tradeCount, setTradeCount] = useState(0);
  const [cumulativePL, setCumulativePL] = useState(0);
  const [history, setHistory] = useState<TradePoint[]>([]);
  const [realization, setRealization] = useState<number | null>(null);
  const [plMessage, setPlMessage] = useState("No realized P/L yet");
  const [tradeMessage, setTradeMessage] = useState("Choose a role and make a market.");
  const [lockedTrade, setLockedTrade] = useState<LockedTrade | null>(null);
  const [marketResult, setMarketResult] = useState<MarketResult | null>(null);
  const [qty, setQty] = useState("");
  const [midpoint, setMidpoint] = useState("");
  const [spread, setSpread] = useState("");
  const [error, setError] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const stateRef = useRef({
    role,
    dice,
    lockedTrade,
    marketResult,
    tradeCount,
    isFinished,
  });
  const cumulativePLRef = useRef(0);
  const roundClosingRef = useRef(false);

  useEffect(() => {
    stateRef.current = {
      role,
      dice,
      lockedTrade,
      marketResult,
      tradeCount,
      isFinished,
    };
  }, [dice, isFinished, lockedTrade, marketResult, role, tradeCount]);

  useEffect(() => {
    setIsHydrated(true);
    setBidOffer(createBidOffer());
  }, []);

  const appendPL = useCallback((pl: number, nextTradeCount: number) => {
    const next = cumulativePLRef.current + pl;

    cumulativePLRef.current = next;
    setCumulativePL(next);
    setHistory((points) => [
      ...points,
      {
        label: `Trade ${nextTradeCount}`,
        value: next,
      },
    ]);
  }, []);

  const finishGame = useCallback(() => {
    setIsFinished(true);
    setProgress(0);
    setTradeMessage("Game over. Restart to play another 5-trade round.");
  }, []);

  const completeRound = useCallback(() => {
    const snapshot = stateRef.current;

    if (snapshot.isFinished) {
      return;
    }

    const realizedValue = resolveDice(snapshot.dice);
    setRealization(realizedValue);

    if (snapshot.role === "maker" && snapshot.marketResult) {
      const { buyers, sellers, bid, offer, spread: makerSpread } = snapshot.marketResult;
      const netQty = sellers - buyers;
      const matchedQty = Math.min(buyers, sellers);
      const spreadCollected = makerSpread * matchedQty;
      const imbalancePrice = netQty > 0 ? bid : offer;
      const realizedPL = netQty === 0 ? 0 : netQty * (realizedValue - imbalancePrice);
      const totalPL = spreadCollected + realizedPL;

      appendPL(totalPL, snapshot.tradeCount);
      setPlMessage(
        `P/L ${totalPL.toFixed(2)} | Spread ${spreadCollected.toFixed(2)} | Realized ${realizedPL.toFixed(2)}`,
      );
      setMarketResult(null);
    }

    if (snapshot.role === "participant" && snapshot.lockedTrade) {
      const { action, price, qty: lockedQty } = snapshot.lockedTrade;
      const pl =
        action === "buy"
          ? (realizedValue - price) * lockedQty
          : (price - realizedValue) * lockedQty;

      appendPL(pl, snapshot.tradeCount);
      setPlMessage(`P/L ${pl.toFixed(2)} from ${action} ${lockedQty} @ ${formatPrice(price)}`);
      setLockedTrade(null);
    }

    if (snapshot.tradeCount >= MAX_TRADES) {
      finishGame();
      return;
    }

    setDice(createDiceState());
    setBidOffer(createBidOffer());
    setProgress(100);
    roundClosingRef.current = false;
    setTradeMessage("New round is live.");
  }, [appendPL, finishGame]);

  useEffect(() => {
    if (isFinished || !isHydrated) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => {
        const next = current - 100 / ROUND_SECONDS;

        if (next <= 0) {
          if (!roundClosingRef.current) {
            roundClosingRef.current = true;
            window.setTimeout(completeRound, 0);
          }

          return 0;
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completeRound, isFinished, isHydrated]);

  const selectRole = (nextRole: Role) => {
    if (isFinished) {
      return;
    }

    setRole(nextRole);
    setError("");
    setLockedTrade(null);
    setMarketResult(null);
    setBidOffer(createBidOffer());
    setTradeMessage(
      nextRole === "maker"
        ? "Set a midpoint and spread before the round expires."
        : "Pick a quantity, then buy the offer or sell the bid.",
    );
  };

  const submitMarket = () => {
    if (isFinished) {
      return;
    }

    const parsedMidpoint = Number(midpoint);
    const parsedSpread = Number(spread);

    if (!parsedMidpoint || !parsedSpread || parsedMidpoint <= 0 || parsedSpread <= 0) {
      setError("Enter a positive midpoint and spread.");
      return;
    }

    const bid = Math.max(3, parsedMidpoint - parsedSpread / 2);
    const offer = Math.min(18, parsedMidpoint + parsedSpread / 2);
    const expectedOutcome = dice.reduce<number>((sum, value) => {
      return sum + (value === "H" ? 3.5 : value);
    }, 0);
    const edgeBuy = Math.max(0, Math.min(1, (offer - expectedOutcome) / parsedSpread));
    const edgeSell = Math.max(0, Math.min(1, (expectedOutcome - bid) / parsedSpread));
    const buyers = Math.round(edgeSell * 100);
    const sellers = Math.round(edgeBuy * 100);
    const nextTradeCount = tradeCount + 1;

    setTradeCount(nextTradeCount);
    setBidOffer({ bid, offer });
    setMarketResult({ buyers, sellers, bid, offer, spread: parsedSpread });
    setError("");
    setTradeMessage(
      `Purchased ${buyers} @ Offer ${offer.toFixed(2)} | Sold ${sellers} @ Bid ${bid.toFixed(2)}`,
    );
  };

  const placeParticipantTrade = (action: TradeAction) => {
    if (isFinished || lockedTrade) {
      return;
    }

    const parsedQty = Number(qty);

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("Enter a positive quantity.");
      return;
    }

    const price = action === "buy" ? bidOffer.offer : bidOffer.bid;
    const nextTradeCount = tradeCount + 1;

    setTradeCount(nextTradeCount);
    setLockedTrade({ action, price, qty: parsedQty });
    setError("");
    setTradeMessage(
      action === "buy"
        ? `Purchased ${parsedQty} @ Offer ${formatPrice(price)}`
        : `Sold ${parsedQty} @ Bid ${formatPrice(price)}`,
    );
  };

  const restartGame = () => {
    cumulativePLRef.current = 0;
    roundClosingRef.current = false;
    setRole("maker");
    setDice(["H", "H", "H"]);
    setBidOffer(createBidOffer());
    setProgress(100);
    setTradeCount(0);
    setCumulativePL(0);
    setHistory([]);
    setRealization(null);
    setPlMessage("No realized P/L yet");
    setTradeMessage("Choose a role and make a market.");
    setLockedTrade(null);
    setMarketResult(null);
    setQty("");
    setMidpoint("");
    setSpread("");
    setError("");
    setIsFinished(false);
  };

  const remainingTrades = Math.max(0, MAX_TRADES - tradeCount);

  if (!isHydrated) {
    return <main className="min-h-screen bg-background text-foreground" suppressHydrationWarning />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-card shadow-sm">
              <NotebookPen className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold sm:text-2xl">Market Making Game Contest</p>
            </div>
          </div>
          <button
            type="button"
            onClick={restartGame}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border bg-card px-3 text-sm shadow-sm transition hover:bg-accent hover:text-accent-foreground"
            title="Restart game"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Restart
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1.35fr_0.9fr]">
        <section className="flex min-w-0 flex-col gap-4">
          <PLChart history={history} cumulativePL={cumulativePL} />

          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Round Sheet</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                <Timer className="size-4" aria-hidden="true" />
                {Math.ceil((progress / 100) * ROUND_SECONDS)}s
              </div>
            </div>

            <div className="mb-4 h-3 overflow-hidden rounded-sm border bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {dice.map((value, index) => (
                <div key={index} className="rounded-md border bg-background p-4 text-center">
                  <p className="text-sm text-muted-foreground">Dice {index + 1}</p>
                  <p className="mt-2 font-mono text-4xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Realization" value={realization === null ? "-" : realization.toString()} />
              <Metric label="Trades Left" value={remainingTrades.toString()} />
              <Metric label="Total P/L" value={cumulativePL.toFixed(2)} />
            </div>
          </section>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UsersRound className="size-5" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Role</h2>
              </div>
              <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                {tradeCount}/{MAX_TRADES}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <RoleButton
                active={role === "maker"}
                icon={<UserRound className="size-4" aria-hidden="true" />}
                label="Market Maker"
                onClick={() => selectRole("maker")}
              />
              <RoleButton
                active={role === "participant"}
                icon={<UsersRound className="size-4" aria-hidden="true" />}
                label="Participant"
                onClick={() => selectRole("participant")}
              />
            </div>
          </section>

          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="size-5" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Market</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <QuoteBox label="Bid" value={formatPrice(bidOffer.bid)} />
              <QuoteBox label="Offer" value={formatPrice(bidOffer.offer)} />
            </div>

            <div className="mt-4 rounded-md border bg-accent p-3 text-sm text-accent-foreground">
              {tradeMessage}
            </div>
          </section>

          <section className="rounded-md border bg-card p-4 shadow-sm">
            {role === "maker" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-5" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">Make Market</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Midpoint"
                    value={midpoint}
                    onChange={setMidpoint}
                    placeholder="10"
                  />
                  <NumberField label="Spread" value={spread} onChange={setSpread} placeholder="2" />
                </div>
                <button
                  type="button"
                  onClick={submitMarket}
                  disabled={isFinished}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border bg-primary px-4 text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Activity className="size-4" aria-hidden="true" />
                  Submit Market
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Dices className="size-5" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">Trade Quote</h2>
                </div>
                <NumberField label="Quantity" value={qty} onChange={setQty} placeholder="25" />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => placeParticipantTrade("buy")}
                    disabled={isFinished || Boolean(lockedTrade)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-chart-3 bg-chart-3 px-4 text-background shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowUpFromLine className="size-4" aria-hidden="true" />
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => placeParticipantTrade("sell")}
                    disabled={isFinished || Boolean(lockedTrade)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-destructive bg-destructive px-4 text-destructive-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowDownToLine className="size-4" aria-hidden="true" />
                    Sell
                  </button>
                </div>
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-md border border-destructive bg-background p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </section>

          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="size-5" aria-hidden="true" />
              <h2 className="text-lg font-semibold">P/L Tape</h2>
            </div>
            <p className="rounded-md border bg-background p-3 text-sm">{plMessage}</p>

            {isFinished ? (
              <div className="mt-3 rounded-md border bg-accent p-4 text-accent-foreground">
                <p className="text-lg font-semibold">Game Over</p>
                <p className="mt-1 text-sm">Final P/L: {cumulativePL.toFixed(2)}</p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      <footer className="border-t bg-background px-4 py-4 text-center text-sm text-muted-foreground">
        Made with ❤️ by Quant Insider
      </footer>
    </main>
  );
}

function RoleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm shadow-sm transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border bg-input px-3 text-foreground shadow-xs transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function QuoteBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}

function PLChart({ history, cumulativePL }: { history: TradePoint[]; cumulativePL: number }) {
  const { points, zeroY, min, max } = useMemo(() => {
    const values = history.length ? history.map((point) => point.value) : [0];
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const padding = Math.max(10, (rawMax - rawMin) * 0.2);
    const minValue = rawMin - padding;
    const maxValue = rawMax + padding;
    const range = maxValue - minValue || 1;
    const width = 640;
    const height = 260;
    const xStep = history.length > 1 ? width / (history.length - 1) : width;

    const chartPoints = history.map((point, index) => {
      const x = history.length === 1 ? width / 2 : index * xStep;
      const y = height - ((point.value - minValue) / range) * height;
      return `${x},${y}`;
    });

    return {
      points: chartPoints.join(" "),
      zeroY: height - ((0 - minValue) / range) * height,
      min: minValue,
      max: maxValue,
    };
  }, [history]);

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Cumulative P/L</h2>
        </div>
        <span className="rounded-md border bg-background px-3 py-1 font-mono text-sm">
          {cumulativePL.toFixed(2)}
        </span>
      </div>

      <div className="h-[80] rounded-md border bg-background p-3">
        <svg viewBox="0 0 700 320" className="h-full w-full" role="img" aria-label="P/L line chart">
          <line x1="42" y1="20" x2="42" y2="280" className="stroke-border" strokeWidth="2" />
          <line x1="42" y1="280" x2="682" y2="280" className="stroke-border" strokeWidth="2" />
          <line
            x1="42"
            y1={20 + zeroY}
            x2="682"
            y2={20 + zeroY}
            className="stroke-muted-foreground"
            strokeDasharray="5 6"
            strokeWidth="1"
          />
          <text x="4" y="28" className="fill-muted-foreground text-[18px]">
            {max.toFixed(0)}
          </text>
          <text x="4" y="284" className="fill-muted-foreground text-[18px]">
            {min.toFixed(0)}
          </text>

          {history.length ? (
            <>
              <polyline
                points={points
                  .split(" ")
                  .map((pair) => {
                    const [x, y] = pair.split(",").map(Number);
                    return `${x + 42},${y + 20}`;
                  })
                  .join(" ")}
                fill="none"
                className="stroke-primary"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              {history.map((point, index) => {
                const [x, y] = points.split(" ")[index].split(",").map(Number);
                return (
                  <g key={`${point.label}-${index}`}>
                    <rect
                      x={x + 36}
                      y={y + 14}
                      width="12"
                      height="12"
                      className="fill-background stroke-primary"
                      strokeWidth="3"
                    />
                    <text
                      x={x + 42}
                      y="310"
                      textAnchor="middle"
                      className="fill-muted-foreground text-[16px]"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <text x="350" y="158" textAnchor="middle" className="fill-muted-foreground text-[20px]">
              P/L appears after the first realization
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}
