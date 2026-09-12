import React, { useEffect, useState } from 'react';
import {
  Gamepad2,
  Terminal,
  Trophy,
  Zap,
  Users,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Clock,
  ArrowUp,
  ArrowDown,
  AtSign,
} from 'lucide-react';

interface BotStatus {
  status: string;
  bot: string;
  guilds: number;
  uptimeSeconds: number;
  activityText?: string;
  customStatus?: string;
}

interface LeaderboardEntry {
  userId: string;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  fastestTimeMs: number;
}

interface SimulatedMessage {
  id: string;
  player: string;
  playerId: string;
  guess: number;
  response: 'Higher.' | 'Lower.' | 'Correct.';
  isWin?: boolean;
  time: string;
}

export default function App() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulator' | 'commands' | 'leaderboard'>('overview');

  // Simulator state
  const [simActive, setSimActive] = useState(false);
  const [simTarget, setSimTarget] = useState<number | null>(null);
  const [simRange, setSimRange] = useState({ min: 1, max: 100 });
  const [simSelectedPlayer, setSimSelectedPlayer] = useState('Alex');
  const [simGuessInput, setSimGuessInput] = useState('');
  const [simLog, setSimLog] = useState<SimulatedMessage[]>([]);
  const [simWinner, setSimWinner] = useState<string | null>(null);
  const [simParticipants, setSimParticipants] = useState<string[]>([]);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchLeaderboard();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // Silent error
    }
  };

  const handleStartSim = () => {
    if (simActive) {
      setSimError('A Number Hunt is already active in this channel! Only one game can run at a time.');
      setTimeout(() => setSimError(null), 3000);
      return;
    }
    const target = Math.floor(Math.random() * (simRange.max - simRange.min + 1)) + simRange.min;
    setSimTarget(target);
    setSimActive(true);
    setSimWinner(null);
    setSimLog([]);
    setSimParticipants([simSelectedPlayer]);
    setSimError(null);
  };

  const handleStopSim = () => {
    setSimActive(false);
    setSimTarget(null);
    setSimError(null);
  };

  const handleSimGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simActive || simTarget === null) return;
    const num = parseInt(simGuessInput.trim(), 10);
    if (isNaN(num)) return;

    // When someone sends a number which is not in range, the bot does not reply
    if (num < simRange.min || num > simRange.max) {
      setSimGuessInput('');
      setSimError(`Ignored guess (${num}): out of active range [${simRange.min}–${simRange.max}]. The bot does not reply to numbers out of range.`);
      setTimeout(() => setSimError(null), 3500);
      return;
    }

    if (!simParticipants.includes(simSelectedPlayer)) {
      setSimParticipants((prev) => [...prev, simSelectedPlayer]);
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isCorrect = num === simTarget;
    const response: 'Higher.' | 'Lower.' | 'Correct.' = isCorrect
      ? 'Correct.'
      : num < simTarget
        ? 'Higher.'
        : 'Lower.';

    const newMsg: SimulatedMessage = {
      id: Math.random().toString(36).substring(2),
      player: simSelectedPlayer,
      playerId: `user-${simSelectedPlayer.toLowerCase()}`,
      guess: num,
      response,
      isWin: isCorrect,
      time: now,
    };

    setSimLog((prev) => [newMsg, ...prev]);
    setSimGuessInput('');

    if (isCorrect) {
      setSimWinner(simSelectedPlayer);
      setSimActive(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans antialiased selection:bg-stone-700 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-stone-800 bg-stone-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Profile & Text Status at Top */}
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-stone-700 flex items-center justify-center font-bold text-stone-100 text-lg shadow-sm">
                N
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-stone-950" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-stone-100 tracking-tight text-base">Numo</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-900/70 text-indigo-200 border border-indigo-700/60">
                  BOT
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700 font-mono">
                  Components V2
                </span>
              </div>

              {/* Text Status at Top near Profile */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <div className="flex items-center space-x-1.5 text-stone-300 font-medium">
                  <span className="text-stone-400">💬</span>
                  <span className="text-stone-200">{botStatus?.customStatus || 'Number Hunt | /help'}</span>
                </div>
                <span className="text-stone-600 hidden sm:inline">•</span>
                <div className="flex items-center space-x-1 text-stone-400">
                  <span>🎮</span>
                  <span>Playing {botStatus?.activityText || 'Number Hunt'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-stone-900/80 border border-stone-800 text-stone-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="capitalize">{botStatus ? 'Online' : 'Ready'}</span>
            </div>
            {botStatus && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-stone-900/80 border border-stone-800 text-stone-400">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span>{botStatus.guilds} Server{botStatus.guilds === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-800 space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-stone-200 text-stone-100'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Architecture & Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
              activeTab === 'simulator'
                ? 'border-stone-200 text-stone-100'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Channel Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
              activeTab === 'commands'
                ? 'border-stone-200 text-stone-100'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Command Reference</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
              activeTab === 'leaderboard'
                ? 'border-stone-200 text-stone-100'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>
        </div>

        {/* Tab 1: Overview & Active Rules */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-300">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <h2 className="font-semibold text-stone-200 text-sm">One Game Per Channel</h2>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Only one active Number Hunt can run in any channel at a time. Anyone in that channel can participate by typing numbers in chat.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-300">
                  <AtSign className="w-4 h-4" />
                </div>
                <h2 className="font-semibold text-stone-200 text-sm">Winner Mention</h2>
                <p className="text-xs text-stone-400 leading-relaxed">
                  When a player correctly guesses the secret number, the bot mentions them with active highlight: <code className="text-stone-300 font-mono">Correct. &lt;@winner&gt; won!</code>
                </p>
              </div>

              <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-300">
                  <Zap className="w-4 h-4" />
                </div>
                <h2 className="font-semibold text-stone-200 text-sm">Immediate Execution</h2>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Responses are sent with zero blocking and zero delay. No message is left unanswered. Responses are strictly limited to Higher, Lower, or Correct.
                </p>
              </div>
            </div>

            {/* In-Discord Components V2 Preview Card */}
            <div className="rounded-xl bg-stone-900/40 border border-stone-800 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-stone-200">Discord Components V2 Layout</h2>
              <p className="text-xs text-stone-400">
                Numo uses modern Discord Components V2 primitives (<code className="text-stone-300 font-mono">MessageFlags.IsComponentsV2 = 32768</code>). Zero embed sidebars, zero clutter.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Simulated V2 Guess Card */}
                <div className="p-4 rounded-lg bg-stone-900 border border-stone-700/60 shadow-sm space-y-2">
                  <div className="text-xs text-stone-400 uppercase tracking-wider font-mono">Directional Hint</div>
                  <div className="p-3 rounded-md bg-stone-950/80 border border-stone-800 font-medium text-stone-100 flex items-center space-x-2">
                    <ArrowUp className="w-4 h-4 text-stone-400" />
                    <span>Higher.</span>
                  </div>
                </div>

                {/* Simulated V2 Win Card */}
                <div className="p-4 rounded-lg bg-stone-900 border border-stone-700/60 shadow-sm space-y-2">
                  <div className="text-xs text-stone-400 uppercase tracking-wider font-mono">Winner Mention</div>
                  <div className="p-3 rounded-md bg-stone-950/80 border border-stone-800 font-medium text-stone-100 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-stone-300" />
                    <span>Correct. @Alex won!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Channel Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-stone-900/40 border border-stone-800 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-stone-100">Multiplayer Channel Simulator</h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Test the single game per channel rule and see winner mentions in action.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {!simActive ? (
                    <button
                      onClick={handleStartSim}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-100 text-stone-950 font-medium text-xs hover:bg-stone-200 transition-colors flex items-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Game (1–100)</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStopSim}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-800 text-stone-200 border border-stone-700 font-medium text-xs hover:bg-stone-700 transition-colors flex items-center space-x-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>End Active Game</span>
                    </button>
                  )}
                </div>
              </div>

              {simError && (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{simError}</span>
                </div>
              )}

              {/* Game Status Banner */}
              <div className="p-4 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${simActive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-600'}`} />
                  <span className="font-medium text-stone-200">
                    {simActive ? 'Game in Progress (1–100)' : 'No Game Active'}
                  </span>
                </div>
                {simActive && (
                  <div className="text-stone-400 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time limit: 60s</span>
                  </div>
                )}
              </div>

              {/* Guess Submission Form */}
              {simActive && (
                <form onSubmit={handleSimGuess} className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-48">
                      <label className="text-xs text-stone-400 block mb-1">Simulate As Player:</label>
                      <select
                        value={simSelectedPlayer}
                        onChange={(e) => setSimSelectedPlayer(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-stone-500"
                      >
                        <option value="Alex">Player 1 (Alex)</option>
                        <option value="Jordan">Player 2 (Jordan)</option>
                        <option value="Taylor">Player 3 (Taylor)</option>
                        <option value="Sam">Player 4 (Sam)</option>
                      </select>
                    </div>

                    <div className="w-full sm:flex-1">
                      <label className="text-xs text-stone-400 block mb-1">Type Integer Guess:</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={simGuessInput}
                          onChange={(e) => setSimGuessInput(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-stone-500"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg bg-stone-100 text-stone-950 font-medium text-xs hover:bg-stone-200 transition-colors"
                        >
                          Send Guess
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Chat / Guess Feed */}
              <div className="space-y-2">
                <div className="text-xs text-stone-400 uppercase tracking-wider font-mono">Channel Chat Feed</div>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {simLog.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-800 rounded-lg">
                      {simActive ? 'No guesses submitted yet. Type a number above!' : 'Click "Start Game" above to launch a test match.'}
                    </div>
                  ) : (
                    simLog.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          m.isWin
                            ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
                            : 'bg-stone-900/60 border-stone-800 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-stone-200">{m.player}:</span>
                          <span className="font-mono bg-stone-800 px-1.5 py-0.5 rounded text-stone-100">{m.guess}</span>
                          <span className="text-stone-500">→</span>
                          {m.isWin ? (
                            <span className="font-semibold text-emerald-300">
                              Correct. &lt;@{m.player}&gt; won!
                            </span>
                          ) : (
                            <span className="font-medium flex items-center space-x-1 text-stone-100">
                              {m.response === 'Higher.' ? (
                                <ArrowUp className="w-3.5 h-3.5 inline text-stone-400" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 inline text-stone-400" />
                              )}
                              <span>{m.response}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-500">{m.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Command Reference (Long & Short separated, NO staff/owner commands) */}
        {activeTab === 'commands' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Long Commands */}
              <div className="p-6 rounded-xl bg-stone-900/40 border border-stone-800 space-y-4">
                <div className="flex items-center space-x-2 border-b border-stone-800 pb-3">
                  <Terminal className="w-4 h-4 text-stone-300" />
                  <h2 className="font-semibold text-stone-100 text-sm">Long Commands</h2>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/numberhunt start [difficulty]</div>
                    <div className="text-stone-400">Starts a game in the channel (normal, easy, hard, extreme).</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/numberhunt stop</div>
                    <div className="text-stone-400">Ends the channel's active game (host or staff only).</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/leaderboard</div>
                    <div className="text-stone-400">Shows the global top players by wins and streak.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/stats [user]</div>
                    <div className="text-stone-400">Displays win rate, streak, and fastest guess time.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/ping</div>
                    <div className="text-stone-400">Checks bot response and gateway websocket latency.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/about</div>
                    <div className="text-stone-400">Overview of Numo game rules and multiplayer dynamics.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">/help</div>
                    <div className="text-stone-400">Displays the command index.</div>
                  </div>
                </div>
              </div>

              {/* Short Forms */}
              <div className="p-6 rounded-xl bg-stone-900/40 border border-stone-800 space-y-4">
                <div className="flex items-center space-x-2 border-b border-stone-800 pb-3">
                  <Zap className="w-4 h-4 text-stone-300" />
                  <h2 className="font-semibold text-stone-100 text-sm">Short Forms</h2>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!nh [difficulty]</div>
                    <div className="text-stone-400">Quick start with standard 1–100 or chosen difficulty.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!nh stop</div>
                    <div className="text-stone-400">Quickly terminate the active game in the channel.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!lb</div>
                    <div className="text-stone-400">Quick leaderboard lookup.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!s [user]</div>
                    <div className="text-stone-400">Quick player stats lookup.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!p</div>
                    <div className="text-stone-400">Quick ping and response latency check.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 space-y-1">
                    <div className="font-mono font-medium text-stone-200">!h</div>
                    <div className="text-stone-400">Quick command index view.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="rounded-xl bg-stone-900/40 border border-stone-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h2 className="font-semibold text-stone-100 text-sm">Top Number Hunters</h2>
              <button
                onClick={fetchLeaderboard}
                className="text-xs text-stone-400 hover:text-stone-200 transition-colors"
              >
                Refresh
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                No games recorded yet. Play games on Discord or in the Simulator to earn wins!
              </div>
            ) : (
              <div className="divide-y divide-stone-800 text-xs">
                {leaderboard.map((entry, index) => (
                  <div key={entry.userId} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-stone-500 w-6">#{index + 1}</span>
                      <span className="font-medium text-stone-200">{entry.userId}</span>
                    </div>
                    <div className="flex items-center space-x-6 text-stone-400 font-mono">
                      <span>{entry.wins} Wins</span>
                      <span>Streak: {entry.currentStreak}</span>
                      <span>Fastest: {(entry.fastestTimeMs / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
