"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  RotateCcw,
  Moon,
  Sun,
  RefreshCw,
  History,
  Trophy,
  ChevronRight,
  Shuffle,
  Lock,
  Unlock,
  Trash2,
  RotateCw,
  Search,
} from "lucide-react";

/**
 * ============================================================================
 * KING SCOREBOARD – V4.4
 * ============================================================================
 * FIXES:
 * - "Vazas" não aparecia: garantia de espaço para o topo sticky (sem tapar 1ª ronda)
 * - Input inválido não pode avançar nem virar 0
 * - Cabeçalho (nomes + totais) sticky no scroll também em mobile (mesmo com scroll horizontal)
 * Mantém:
 * - Coluna "Rondas" fixa no scroll horizontal
 * - Bloquear edição
 * - Aviso antes de sair com jogo a decorrer
 * - Histórico: detalhes, repetir jogadores, apagar 1 jogo
 * - Histórico: pesquisa + ordenar
 * - Progresso + destaque próxima ronda
 * - Auto-avançar (apenas quando valor é válido)
 * ============================================================================
 */

const STORAGE = {
  scores: "king_v44_scores",
  players: "king_v44_players",
  festa: "king_v44_festa",
  history: "king_v44_history",
  dark: "king_v44_dark",
  locked: "king_v44_locked",
};

export default function KingScoreboard() {
  const [players, setPlayers] = useState([
    "JOGADOR 1",
    "JOGADOR 2",
    "JOGADOR 3",
    "JOGADOR 4",
  ]);

  const [scores, setScores] = useState({});
  const [festaModes, setFestaModes] = useState({
    f1: "positive",
    f2: "positive",
    f3: "positive",
    f4: "positive",
  });

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [isGameActive, setIsGameActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dealerIdx, setDealerIdx] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [isLocked, setIsLocked] = useState(false);

  const [toast, setToast] = useState("");
  const [rowError, setRowError] = useState({});

  const [historyQuery, setHistoryQuery] = useState("");
  const [historySort, setHistorySort] = useState("date_desc"); // date_desc | date_asc | winner_desc | winner_asc
  const [historyDetail, setHistoryDetail] = useState(null);

  // Auto-avançar: refs + timers
  const inputRefs = useRef({});
  const advanceTimers = useRef({});

  // IMPORTANTE: sticky em mobile é mais estável com table border-separate.
  // E precisamos de garantir que o sticky do cabeçalho não tapa a 1ª linha.
  // Solução: adicionar "padding-top" virtual antes do corpo (linha espaçadora).
  const stickyTopClass = "top-16"; // nav h-16 (64px)

  const rounds = useMemo(
    () => [
      { id: "vazas", name: "Vazas", max: 13, calc: (n) => n * -20 },
      { id: "copas", name: "Copas", max: 13, calc: (n) => n * -20 },
      { id: "damas", name: "Damas", max: 4, calc: (n) => n * -50 },
      { id: "reis", name: "Reis / Valetes", max: 8, calc: (n) => n * -30 },
      {
        id: "rei_copas",
        name: "Rei de Copas",
        max: 1,
        calc: (n) => n * -160,
      },
      { id: "ultimas", name: "Últimas Vaz.", max: 2, calc: (n) => n * -90 },
      {
        id: "f1",
        name: "Festa J3",
        type: "festa",
        calc: (n, p) => (p ? n * 25 : 325 - n * 75),
      },
      {
        id: "f2",
        name: "Festa J4",
        type: "festa",
        calc: (n, p) => (p ? n * 25 : 325 - n * 75),
      },
      {
        id: "f3",
        name: "Festa J1",
        type: "festa",
        calc: (n, p) => (p ? n * 25 : 325 - n * 75),
      },
      {
        id: "f4",
        name: "Festa J2",
        type: "festa",
        calc: (n, p) => (p ? n * 25 : 325 - n * 75),
      },
    ],
    []
  );

  // -----------------------
  // Load / Save
  // -----------------------
  useEffect(() => {
    const sScores = localStorage.getItem(STORAGE.scores);
    const sPlayers = localStorage.getItem(STORAGE.players);
    const sFesta = localStorage.getItem(STORAGE.festa);
    const sHistory = localStorage.getItem(STORAGE.history);
    const sDark = localStorage.getItem(STORAGE.dark);
    const sLocked = localStorage.getItem(STORAGE.locked);

    if (sScores) setScores(JSON.parse(sScores));
    else {
      const init = {};
      rounds.forEach((r) => (init[r.id] = { p0: "", p1: "", p2: "", p3: "" }));
      setScores(init);
    }

    if (sPlayers) setPlayers(JSON.parse(sPlayers));
    if (sFesta) setFestaModes(JSON.parse(sFesta));
    if (sHistory) setHistory(JSON.parse(sHistory));
    if (sDark === "true") setIsDarkMode(true);
    if (sLocked === "true") setIsLocked(true);
  }, [rounds]);

  useEffect(() => {
    if (Object.keys(scores).length === 0) return;

    localStorage.setItem(STORAGE.scores, JSON.stringify(scores));
    localStorage.setItem(STORAGE.players, JSON.stringify(players));
    localStorage.setItem(STORAGE.festa, JSON.stringify(festaModes));
    localStorage.setItem(STORAGE.history, JSON.stringify(history));
    localStorage.setItem(STORAGE.dark, isDarkMode.toString());
    localStorage.setItem(STORAGE.locked, isLocked.toString());

    document.body.style.backgroundColor = isDarkMode ? "#020617" : "#f8fafc";
  }, [scores, players, festaModes, history, isDarkMode, isLocked]);

  // -----------------------
  // Helpers UI
  // -----------------------
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 1800);
  };

  const setRowErrorMsg = (rid, msg) => {
    setRowError((prev) => ({ ...prev, [rid]: msg }));
    window.clearTimeout(setRowErrorMsg._t?.[rid]);
    setRowErrorMsg._t = setRowErrorMsg._t || {};
    setRowErrorMsg._t[rid] = window.setTimeout(() => {
      setRowError((prev) => {
        const next = { ...prev };
        delete next[rid];
        return next;
      });
    }, 2200);
  };

  // -----------------------
  // Game logic
  // -----------------------
  const isRowFull = (rid) => {
    const row = scores[rid];
    if (!row) return false;
    return [0, 1, 2, 3].every(
      (i) => row[`p${i}`] !== "" && row[`p${i}`] !== "-"
    );
  };

  const completedRoundsCount = rounds.filter((r) => isRowFull(r.id)).length;
  const totalRoundsCount = rounds.length;
  const nextRound = rounds.find((r) => !isRowFull(r.id)) || null;

  useEffect(() => {
    if (!isGameActive) return;
    setDealerIdx(completedRoundsCount % 4);
  }, [isGameActive, completedRoundsCount]);

  const calculatePoints = (rid, pIdx, override = null) => {
    const round = rounds.find((r) => r.id === rid);
    if (!round) return 0;

    const festaModeOverride = override?.festaModes?.[rid];
    const scoresOverride = override?.scores;

    const v = scoresOverride
      ? scoresOverride[rid]?.[`p${pIdx}`]
      : scores[rid]?.[`p${pIdx}`];

    if (v === "" || v === "-" || v === undefined || v === null) return 0;

    if (round.type === "festa") {
      const mode = festaModeOverride
        ? festaModeOverride === "positive"
        : festaModes[rid] === "positive";
      return round.calc(parseInt(v, 10), mode);
    }
    return round.calc(parseInt(v, 10));
  };

  const finalScore = (pIdx) =>
    rounds.reduce((sum, r) => sum + calculatePoints(r.id, pIdx), 0);

  const totals = [0, 1, 2, 3].map((i) => finalScore(i));
  const maxTotal = Math.max(...totals);
  const leaderIdxs = totals
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t === maxTotal)
    .map((x) => x.i);

  const gameFinished = isGameActive && rounds.every((r) => isRowFull(r.id));

  // -----------------------
  // Labels (Festa)
  // -----------------------
  const getFestaLabelFor = (playersArr, id) => {
    switch (id) {
      case "f1":
        return `Festa ${playersArr[2]}`;
      case "f2":
        return `Festa ${playersArr[3]}`;
      case "f3":
        return `Festa ${playersArr[0]}`;
      case "f4":
        return `Festa ${playersArr[1]}`;
      default:
        return "Festa";
    }
  };

  // -----------------------
  // Inputs: validação + auto-avançar
  // -----------------------
  const isValidValueForRound = (round, valueInt, rid, pIdx) => {
    if (round.type === "festa") {
      return valueInt >= -15 && valueInt <= 25;
    }

    if (valueInt < 0 || valueInt > round.max) return false;

    const row = scores[rid] || { p0: "", p1: "", p2: "", p3: "" };
    const sumOthers = [0, 1, 2, 3]
      .filter((i) => i !== pIdx)
      .reduce((a, i) => a + (parseInt(row[`p${i}`], 10) || 0), 0);

    return sumOthers + valueInt <= round.max;
  };

  const updateScore = (rid, pIdx, rawValue) => {
    if (isLocked) {
      showToast("Edição bloqueada.");
      return { ok: false, reason: "locked" };
    }

    const round = rounds.find((r) => r.id === rid);
    if (!round) return { ok: false, reason: "no_round" };

    // Aceita vazio e "-" (não avança)
    if (rawValue === "" || rawValue === "-") {
      setScores((prev) => ({
        ...prev,
        [rid]: { ...prev[rid], [`p${pIdx}`]: rawValue },
      }));
      return { ok: true, canAdvance: false };
    }

    const cleaned = String(rawValue).trim();

    // IMPORTANTE: usamos input type="text" (não "number") para evitar o browser “forçar” 0.
    // Aceita só números (com - opcional no início)
    if (!/^-?\d+$/.test(cleaned)) {
      setRowErrorMsg(rid, "Só números aqui.");
      return { ok: false, reason: "not_number" };
    }

    const val = parseInt(cleaned, 10);
    if (Number.isNaN(val)) return { ok: false, reason: "nan" };

    if (!isValidValueForRound(round, val, rid, pIdx)) {
      if (round.type === "festa") setRowErrorMsg(rid, "Festa: só entre -15 e 25.");
      else setRowErrorMsg(rid, "Valor inválido (limite/soma).");
      return { ok: false, reason: "invalid_limits" };
    }

    setScores((prev) => ({
      ...prev,
      [rid]: { ...prev[rid], [`p${pIdx}`]: val },
    }));

    return { ok: true, canAdvance: true };
  };

  const scheduleAdvance = (rid, pIdx) => {
    const key = `${rid}_${pIdx}`;
    window.clearTimeout(advanceTimers.current[key]);

    // pausa para a pessoa terminar de digitar
    advanceTimers.current[key] = window.setTimeout(() => {
      const rIndex = rounds.findIndex((r) => r.id === rid);
      const nextP = pIdx < 3 ? pIdx + 1 : 0;
      const nextR =
        pIdx < 3 ? rIndex : Math.min(rIndex + 1, rounds.length - 1);

      const nextRid = rounds[nextR]?.id;
      const nextKey = `${nextRid}_${nextP}`;
      const el = inputRefs.current[nextKey];
      if (el && typeof el.focus === "function") el.focus();
    }, 450);
  };

  // -----------------------
  // Buttons
  // -----------------------
  const handleShuffle = () => {
    const ok = window.confirm("Quer mesmo sortear a ordem dos jogadores?");
    if (!ok) return;

    const arr = [...players];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setPlayers(arr);
    showToast("Jogadores sorteados.");
  };

  const resetGame = () => {
    const empty = {};
    rounds.forEach((r) => (empty[r.id] = { p0: "", p1: "", p2: "", p3: "" }));
    setScores(empty);
    setIsGameActive(false);
    setDealerIdx(0);
    setShowResetConfirm(false);
    setRowError({});
    setIsLocked(false);
    showToast("Jogo reposto.");
  };

  const saveGameToHistory = () => {
    const snapshotPlayers = [...players];
    const snapshotScores = JSON.parse(JSON.stringify(scores));
    const snapshotFesta = JSON.parse(JSON.stringify(festaModes));

    const finalScores = snapshotPlayers.map((p, i) => ({
      name: p,
      score: rounds.reduce(
        (sum, r) =>
          sum +
          calculatePoints(r.id, i, {
            scores: snapshotScores,
            festaModes: snapshotFesta,
          }),
        0
      ),
    }));

    setHistory((prev) => [
      {
        id: Date.now(),
        date: new Date().toLocaleString("pt-PT"),
        players: snapshotPlayers,
        scores: finalScores,
        table: snapshotScores,
        festaModes: snapshotFesta,
      },
      ...prev,
    ]);

    showToast("Jogo gravado no histórico.");
    resetGame();
  };

  // -----------------------
  // Aviso antes de sair
  // -----------------------
  useEffect(() => {
    const handler = (e) => {
      if (!isGameActive) return;
      const finished = rounds.every((r) => isRowFull(r.id));
      if (finished) return;

      e.preventDefault();
      e.returnValue = "Tem um jogo a decorrer. Quer sair mesmo?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isGameActive, scores, rounds]);

  // -----------------------
  // Histórico: filtro/ordenação
  // -----------------------
  const winnerScoreOf = (item) => Math.max(...item.scores.map((s) => s.score));

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    let arr = [...history];

    if (q) {
      arr = arr.filter((h) => {
        const inPlayers = (h.players || []).some((p) =>
          String(p).toLowerCase().includes(q)
        );
        const inScores = (h.scores || []).some((s) =>
          String(s.name).toLowerCase().includes(q)
        );
        return inPlayers || inScores;
      });
    }

    const byDateDesc = (a, b) => (b.id || 0) - (a.id || 0);
    const byDateAsc = (a, b) => (a.id || 0) - (b.id || 0);
    const byWinnerDesc = (a, b) => winnerScoreOf(b) - winnerScoreOf(a);
    const byWinnerAsc = (a, b) => winnerScoreOf(a) - winnerScoreOf(b);

    if (historySort === "date_asc") arr.sort(byDateAsc);
    else if (historySort === "winner_desc") arr.sort(byWinnerDesc);
    else if (historySort === "winner_asc") arr.sort(byWinnerAsc);
    else arr.sort(byDateDesc);

    return arr;
  }, [history, historyQuery, historySort]);

  const deleteHistoryItem = (id) => {
    const ok = window.confirm("Apagar este jogo do histórico?");
    if (!ok) return;
    setHistory((prev) => prev.filter((x) => x.id !== id));
    showToast("Jogo apagado do histórico.");
  };

  const repeatHistoryPlayers = (item) => {
    setPlayers(item.players);
    setShowHistory(false);
    setHistoryDetail(null);
    showToast("Jogadores carregados.");
  };

  // -----------------------
  // Component: Header Cell
  // -----------------------
  const PlayerHeaderCell = ({
    name,
    total,
    isDealer,
    isLeader,
    isDarkMode,
  }) => (
    <th
      className={`sticky ${stickyTopClass} z-50 p-2 border-b-2 transition-all duration-300 ${
        isDarkMode
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-white"
      } ${isDealer ? "bg-orange-500/10" : ""} ${
        isLeader ? "ring-2 ring-emerald-500/70" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className="h-5">
          {isDealer && (
            <span className="bg-orange-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase">
              Dá cartas
            </span>
          )}
        </div>

        <span
          className={`text-[11px] font-black uppercase break-words ${
            isDarkMode ? "text-slate-100" : "text-slate-900"
          }`}
        >
          {name}
        </span>

        <span
          className={`text-sm font-black px-3 py-1 rounded-lg border transition-colors ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 text-blue-400"
              : "bg-white border-slate-200 text-blue-600"
          }`}
        >
          {total > 0 ? "+" : ""}
          {total}
        </span>
      </div>
    </th>
  );

  // =========================
  // ECRÃ INICIAL
  // =========================
  if (!isGameActive) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 ${
          isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <h1 className="text-[90px] font-black italic tracking-tighter text-blue-600 leading-none drop-shadow-lg">
              KING
            </h1>
          </div>

          <div
            className={`p-8 rounded-[2.5rem] border-2 transition-all duration-300 ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 shadow-2xl"
                : "bg-white border-slate-100 shadow-xl"
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <span
                className={`text-[11px] font-black uppercase tracking-wider ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Jogadores
              </span>
              <button
                onClick={handleShuffle}
                title="Baralhar a ordem dos jogadores"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-md flex items-center gap-2 active:scale-95 transition-all"
              >
                <Shuffle size={14} /> Sortear
              </button>
            </div>

            <div className="space-y-3 mb-8">
              {players.map((p, i) => (
                <input
                  key={i}
                  className={`w-full p-5 rounded-2xl border-2 font-black uppercase text-lg outline-none transition-all ${
                    isDarkMode
                      ? "bg-slate-800 text-white border-slate-700 focus:border-blue-500"
                      : "bg-white text-slate-900 border-slate-200 focus:border-blue-500"
                  }`}
                  value={p}
                  placeholder={`Jogador ${i + 1}`}
                  onChange={(e) => {
                    const n = [...players];
                    n[i] = e.target.value.toUpperCase();
                    setPlayers(n);
                  }}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Mudar tema"
                className={`p-5 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                  isDarkMode
                    ? "bg-yellow-400 text-slate-950 hover:bg-yellow-300"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
              </button>
              <button
                onClick={() => {
                  setIsGameActive(true);
                  setIsLocked(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl uppercase text-xl shadow-lg py-5 active:scale-98 transition-all"
              >
                COMEÇAR JOGO
              </button>
            </div>

            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className={`w-full mt-6 py-3 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all ${
                  isDarkMode
                    ? "text-slate-400 hover:bg-slate-800"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <History size={14} /> Ver Histórico
              </button>
            )}
          </div>
        </div>

        {/* HISTÓRICO */}
        {showHistory && (
          <HistoryModal
            isDarkMode={isDarkMode}
            rounds={rounds}
            players={players}
            filteredHistory={filteredHistory}
            historyDetail={historyDetail}
            setHistoryDetail={setHistoryDetail}
            setShowHistory={setShowHistory}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historySort={historySort}
            setHistorySort={setHistorySort}
            repeatHistoryPlayers={repeatHistoryPlayers}
            deleteHistoryItem={deleteHistoryItem}
            getFestaLabelFor={getFestaLabelFor}
            calculatePoints={calculatePoints}
          />
        )}

        {toast && (
          <Toast isDarkMode={isDarkMode} toast={toast} />
        )}
      </div>
    );
  }

  // =========================
  // ECRÃ DO JOGO
  // =========================
  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${
        isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
      }`}
    >
      <nav
        className={`h-16 px-6 flex items-center justify-between border-b-2 sticky top-0 z-50 backdrop-blur-sm transition-colors ${
          isDarkMode
            ? "bg-slate-950/95 border-slate-900"
            : "bg-white/95 border-slate-100 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white italic">
            K
          </div>
          <h1 className="text-xl font-black italic uppercase">King</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            title="Ver histórico"
            className={`p-3 rounded-xl border-2 transition-all ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-white"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <History size={18} />
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Mudar tema"
            className={`p-3 rounded-xl border-2 transition-all ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-white"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => {
              setIsLocked((v) => !v);
              showToast(!isLocked ? "Edição bloqueada." : "Edição desbloqueada.");
            }}
            title={isLocked ? "Desbloquear edição" : "Bloquear edição"}
            className={`p-3 rounded-xl border-2 transition-all ${
              isLocked
                ? "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500"
                : isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-white"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            title="Repor jogo"
            className="bg-rose-500 text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-md active:scale-95 transition-all"
          >
            Repor
          </button>
        </div>
      </nav>

      <main className="p-4 sm:p-6 max-w-[1400px] mx-auto pb-32">
        {/* Progresso */}
        <div
          className={`mb-4 p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            isDarkMode
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-100 shadow-sm"
          }`}
        >
          <div className="font-black uppercase text-[11px] opacity-80">
            Rondas feitas: {completedRoundsCount}/{totalRoundsCount}
          </div>

          <div className="flex items-center gap-3">
            {nextRound ? (
              <div
                className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] border-2 ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-100"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                Próxima:{" "}
                {nextRound.type === "festa"
                  ? getFestaLabelFor(players, nextRound.id)
                  : nextRound.name}
              </div>
            ) : (
              <div
                className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] border-2 ${
                  isDarkMode
                    ? "bg-emerald-700 border-emerald-800 text-white"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                Jogo completo
              </div>
            )}

            {gameFinished && (
              <button
                onClick={() => {
                  setIsLocked(true);
                  showToast("Edição bloqueada.");
                }}
                className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
                title="Bloquear para evitar toques acidentais"
              >
                Bloquear
              </button>
            )}
          </div>
        </div>

        <div
          className={`rounded-3xl border-2 transition-all duration-300 ${
            isDarkMode
              ? "bg-slate-900 border-slate-800 shadow-2xl"
              : "bg-white border-slate-100 shadow-xl"
          }`}
        >
          {/* IMPORTANTE: overflow-x-auto pode quebrar sticky em alguns mobiles.
              Mantemos overflow-x-auto mas garantimos overflow-y visível. */}
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "21.5%" }} />
                <col style={{ width: "21.5%" }} />
                <col style={{ width: "21.5%" }} />
                <col style={{ width: "21.5%" }} />
              </colgroup>

              <thead>
                <tr>
                  {/* Cabeçalho da coluna "Rondas": sticky topo + esquerda */}
                  <th
                    className={`sticky left-0 ${stickyTopClass} z-[60] p-3 text-left border-b-2 border-r transition-colors ${
                      isDarkMode
                        ? "border-slate-800 bg-slate-900"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-[9px] font-black opacity-40 uppercase">
                      Rondas
                    </div>
                  </th>

                  {players.map((p, i) => (
                    <PlayerHeaderCell
                      key={i}
                      name={p}
                      total={finalScore(i)}
                      isDealer={dealerIdx === i}
                      isLeader={leaderIdxs.includes(i)}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </tr>
              </thead>

              <tbody
                className={`${
                  isDarkMode ? "divide-slate-800" : "divide-slate-100"
                }`}
              >
                {/* LINHA ESPAÇADORA: evita a sensação de “sumir” a 1ª ronda em alguns scrolls */}
                <tr aria-hidden="true">
                  <td className="h-2"></td>
                  <td className="h-2"></td>
                  <td className="h-2"></td>
                  <td className="h-2"></td>
                  <td className="h-2"></td>
                </tr>

                {rounds.map((round) => {
                  const done = isRowFull(round.id);
                  const sum = [0, 1, 2, 3].reduce(
                    (acc, i) =>
                      acc + (parseInt(scores[round.id]?.[`p${i}`], 10) || 0),
                    0
                  );

                  const label =
                    round.type === "festa"
                      ? getFestaLabelFor(players, round.id)
                      : round.name;

                  const isOver = round.type !== "festa" && sum > round.max;
                  const isNext = nextRound?.id === round.id;

                  return (
                    <tr
                      key={round.id}
                      className={`transition-all duration-300 ${
                        done ? "opacity-30" : ""
                      } ${isNext ? "ring-2 ring-blue-500/60" : ""}`}
                    >
                      {/* Coluna "Rondas": fixa à esquerda */}
                      <td
                        className={`sticky left-0 z-40 p-3 border-r transition-colors ${
                          isDarkMode
                            ? "border-slate-800 bg-slate-900 text-slate-200"
                            : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="text-[11px] font-black uppercase leading-tight">
                            {label}
                          </div>

                          {round.type === "festa" ? (
                            <button
                              onClick={() => {
                                if (isLocked) {
                                  showToast("Edição bloqueada.");
                                  return;
                                }

                                setFestaModes((p) => ({
                                  ...p,
                                  [round.id]:
                                    p[round.id] === "positive"
                                      ? "negative"
                                      : "positive",
                                }));

                                setScores((prev) => ({
                                  ...prev,
                                  [round.id]: {
                                    p0: "",
                                    p1: "",
                                    p2: "",
                                    p3: "",
                                  },
                                }));

                                setRowError((prev) => {
                                  const next = { ...prev };
                                  delete next[round.id];
                                  return next;
                                });

                                showToast("Festa trocada. Valores limpos.");
                              }}
                              className={`flex items-center justify-center gap-1 text-[8px] font-black px-2 py-1 rounded-lg shadow-sm transition-all ${
                                festaModes[round.id] === "positive"
                                  ? "bg-emerald-500 text-white"
                                  : "bg-rose-500 text-white"
                              }`}
                              title="Trocar POS/NEG e limpar esta ronda"
                            >
                              <RefreshCw size={9} />{" "}
                              {festaModes[round.id] === "positive"
                                ? "POS"
                                : "NEG"}
                            </button>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div
                                className={`text-[10px] font-black uppercase ${
                                  isOver ? "text-rose-500" : "opacity-40"
                                }`}
                              >
                                {sum} / {round.max}
                              </div>

                              {(isOver || rowError[round.id]) && (
                                <div className="text-[9px] font-black text-rose-500">
                                  {rowError[round.id] ||
                                    "A soma passou o máximo."}
                                </div>
                              )}
                            </div>
                          )}

                          {round.type === "festa" && rowError[round.id] && (
                            <div className="text-[9px] font-black text-rose-500">
                              {rowError[round.id]}
                            </div>
                          )}
                        </div>
                      </td>

                      {[0, 1, 2, 3].map((pIdx) => {
                        const pts = calculatePoints(round.id, pIdx);
                        const val = scores[round.id]?.[`p${pIdx}`] ?? "";

                        return (
                          <td
                            key={pIdx}
                            className={`p-1.5 transition-colors ${
                              isDarkMode ? "bg-slate-900/50" : "bg-white"
                            }`}
                          >
                            <div className="relative">
                              <input
                                ref={(el) => {
                                  if (!el) return;
                                  inputRefs.current[`${round.id}_${pIdx}`] = el;
                                }}
                                // IMPORTANTE: text para não “forçar” 0 em inválidos
                                type="text"
                                inputMode="numeric"
                                disabled={isLocked}
                                className={`w-full text-center py-4 rounded-xl font-black text-xl outline-none transition-all ${
                                  isLocked ? "opacity-60" : ""
                                } ${
                                  isDarkMode
                                    ? "bg-slate-800 text-white border-2 border-slate-700 focus:border-blue-500 focus:bg-slate-700"
                                    : "bg-slate-50 text-slate-900 border-2 border-transparent focus:border-blue-500 focus:bg-white"
                                }`}
                                value={val}
                                onChange={(e) => {
                                  const res = updateScore(
                                    round.id,
                                    pIdx,
                                    e.target.value
                                  );

                                  // Só avança se for válido E não vazio
                                  if (res.ok && res.canAdvance) {
                                    scheduleAdvance(round.id, pIdx);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    // Enter só avança se o valor atual for válido
                                    const current = e.currentTarget.value;
                                    const res = updateScore(
                                      round.id,
                                      pIdx,
                                      current
                                    );
                                    if (res.ok && res.canAdvance) {
                                      scheduleAdvance(round.id, pIdx);
                                    }
                                  }
                                }}
                                placeholder="—"
                                aria-label={`${label} - ${players[pIdx]}`}
                              />

                              {val !== "" && val !== "-" && (
                                <div
                                  className={`absolute -bottom-0.5 left-0 right-0 text-center text-[9px] font-black ${
                                    pts > 0
                                      ? "text-emerald-500"
                                      : pts < 0
                                      ? "text-rose-500"
                                      : "opacity-30"
                                  }`}
                                >
                                  {pts > 0 ? "+" : ""}
                                  {pts}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {gameFinished && (
          <div className="mt-12">
            <button
              onClick={saveGameToHistory}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-10 rounded-3xl font-black uppercase text-2xl shadow-xl flex items-center justify-center gap-4 active:scale-98 transition-all"
              title="Gravar jogo no histórico"
            >
              Gravar Jogo <ChevronRight size={32} />
            </button>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
            <div
              className={`w-full max-w-sm p-10 rounded-3xl border-4 transition-all ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 text-white"
                  : "bg-white text-slate-900 shadow-2xl border-white"
              }`}
            >
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <RotateCcw size={36} className="text-rose-500" />
              </div>
              <h3 className="text-3xl font-black text-center mb-3 uppercase">
                Repor Jogo?
              </h3>
              <p className="text-center text-[11px] font-bold opacity-40 uppercase mb-10">
                Os dados atuais serão perdidos.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={resetGame}
                  className="w-full py-6 bg-rose-500 text-white font-black rounded-2xl uppercase shadow-lg active:scale-95 transition-all"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className={`w-full py-6 font-black uppercase text-[11px] rounded-2xl transition-all ${
                    isDarkMode
                      ? "hover:bg-slate-800 text-slate-300"
                      : "hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showHistory && (
          <HistoryModal
            isDarkMode={isDarkMode}
            rounds={rounds}
            players={players}
            filteredHistory={filteredHistory}
            historyDetail={historyDetail}
            setHistoryDetail={setHistoryDetail}
            setShowHistory={setShowHistory}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historySort={historySort}
            setHistorySort={setHistorySort}
            repeatHistoryPlayers={repeatHistoryPlayers}
            deleteHistoryItem={deleteHistoryItem}
            getFestaLabelFor={getFestaLabelFor}
            calculatePoints={calculatePoints}
          />
        )}

        {toast && <Toast isDarkMode={isDarkMode} toast={toast} />}
      </main>
    </div>
  );
}

/* =========================
   Pequenos componentes
   ========================= */

function Toast({ isDarkMode, toast }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999]">
      <div
        className={`px-5 py-3 rounded-2xl font-black text-[11px] uppercase shadow-2xl ${
          isDarkMode
            ? "bg-slate-800 text-slate-100 border border-slate-700"
            : "bg-white text-slate-900 border border-slate-200"
        }`}
      >
        {toast}
      </div>
    </div>
  );
}

function HistoryModal({
  isDarkMode,
  rounds,
  players,
  filteredHistory,
  historyDetail,
  setHistoryDetail,
  setShowHistory,
  historyQuery,
  setHistoryQuery,
  historySort,
  setHistorySort,
  repeatHistoryPlayers,
  deleteHistoryItem,
  getFestaLabelFor,
  calculatePoints,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl p-8 rounded-3xl max-h-[85vh] overflow-y-auto ${
          isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        }`}
      >
        <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-500/20">
          <h3 className="font-black uppercase text-xl flex items-center gap-3">
            <Trophy className="text-yellow-500" size={24} /> Histórico
          </h3>
          <button
            onClick={() => {
              setShowHistory(false);
              setHistoryDetail(null);
            }}
            className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase ${
              isDarkMode
                ? "bg-slate-800 hover:bg-slate-700"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            Fechar
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 flex-1 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <Search
              size={16}
              className={isDarkMode ? "text-slate-300" : "text-slate-500"}
            />
            <input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Procurar por jogador..."
              className={`w-full bg-transparent outline-none font-black text-[12px] uppercase ${
                isDarkMode
                  ? "text-white placeholder:text-slate-400"
                  : "text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </div>

          <select
            value={historySort}
            onChange={(e) => setHistorySort(e.target.value)}
            className={`px-4 py-3 rounded-2xl border-2 font-black text-[12px] uppercase outline-none ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="date_desc">Data (mais recente)</option>
            <option value="date_asc">Data (mais antiga)</option>
            <option value="winner_desc">Vencedor (maior)</option>
            <option value="winner_asc">Vencedor (menor)</option>
          </select>
        </div>

        {!historyDetail && (
          <div className="space-y-4">
            {filteredHistory.length === 0 && (
              <div
                className={`p-6 rounded-2xl border-2 text-center font-black uppercase text-[11px] ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                Sem resultados.
              </div>
            )}

            {filteredHistory.map((h) => (
              <div
                key={h.id}
                className={`p-5 border-2 rounded-2xl ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] opacity-50 font-black uppercase tracking-wider">
                      {h.date}
                    </div>
                    <div className="text-[11px] font-black uppercase mt-1 opacity-80">
                      {h.players?.join(" • ")}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryDetail(h)}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${
                        isDarkMode
                          ? "bg-slate-900 border-slate-700 hover:bg-slate-700"
                          : "bg-white border-slate-200 hover:bg-slate-100"
                      }`}
                      title="Ver detalhes deste jogo"
                    >
                      Detalhes
                    </button>

                    <button
                      onClick={() => repeatHistoryPlayers(h)}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex items-center gap-2 ${
                        isDarkMode
                          ? "bg-slate-900 border-slate-700 hover:bg-slate-700"
                          : "bg-white border-slate-200 hover:bg-slate-100"
                      }`}
                      title="Carregar os mesmos jogadores"
                    >
                      <RotateCw size={14} /> Repetir
                    </button>

                    <button
                      onClick={() => deleteHistoryItem(h.id)}
                      className="px-4 py-2 rounded-xl font-black text-[10px] uppercase bg-rose-500 text-white hover:bg-rose-600 transition-all flex items-center gap-2"
                      title="Apagar este jogo do histórico"
                    >
                      <Trash2 size={14} /> Apagar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {h.scores.map((s, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-[10px] opacity-60 font-black uppercase mb-1">
                        {s.name}
                      </span>
                      <span
                        className={`text-2xl font-black ${
                          s.score > 0
                            ? "text-emerald-500"
                            : s.score < 0
                            ? "text-rose-500"
                            : "opacity-40"
                        }`}
                      >
                        {s.score > 0 ? "+" : ""}
                        {s.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {historyDetail && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] opacity-50 font-black uppercase tracking-wider">
                  {historyDetail.date}
                </div>
                <div className="text-[12px] font-black uppercase mt-1">
                  Detalhes do jogo
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => repeatHistoryPlayers(historyDetail)}
                  className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex items-center gap-2 ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                  }`}
                  title="Carregar os mesmos jogadores"
                >
                  <RotateCw size={14} /> Repetir
                </button>

                <button
                  onClick={() => setHistoryDetail(null)}
                  className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  Voltar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "19.5%" }} />
                  <col style={{ width: "19.5%" }} />
                  <col style={{ width: "19.5%" }} />
                  <col style={{ width: "19.5%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className={`p-3 text-left border-b-2 ${
                        isDarkMode
                          ? "border-slate-700 text-slate-200"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      Ronda
                    </th>
                    {historyDetail.players.map((p, i) => (
                      <th
                        key={i}
                        className={`p-3 text-center border-b-2 font-black uppercase text-[11px] ${
                          isDarkMode
                            ? "border-slate-700 text-white"
                            : "border-slate-200 text-slate-900"
                        }`}
                      >
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={`${
                    isDarkMode ? "divide-slate-800" : "divide-slate-200"
                  }`}
                >
                  {rounds.map((r) => {
                    const label =
                      r.type === "festa"
                        ? getFestaLabelFor(historyDetail.players, r.id)
                        : r.name;

                    return (
                      <tr key={r.id}>
                        <td
                          className={`p-3 font-black uppercase text-[11px] ${
                            isDarkMode ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          {label}
                        </td>
                        {[0, 1, 2, 3].map((pIdx) => {
                          const val =
                            historyDetail.table?.[r.id]?.[`p${pIdx}`] ?? "";
                          const pts = calculatePoints(r.id, pIdx, {
                            scores: historyDetail.table,
                            festaModes: historyDetail.festaModes,
                          });

                          return (
                            <td key={pIdx} className="p-3 text-center">
                              <div className="font-black text-lg">
                                {val === "" ? "—" : val}
                              </div>
                              <div
                                className={`text-[10px] font-black ${
                                  pts > 0
                                    ? "text-emerald-500"
                                    : pts < 0
                                    ? "text-rose-500"
                                    : "opacity-40"
                                }`}
                              >
                                {pts > 0 ? "+" : ""}
                                {pts}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {historyDetail.scores.map((s, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border-2 ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="text-[10px] opacity-60 font-black uppercase">
                    {s.name}
                  </div>
                  <div
                    className={`text-2xl font-black ${
                      s.score > 0
                        ? "text-emerald-500"
                        : s.score < 0
                        ? "text-rose-500"
                        : "opacity-40"
                    }`}
                  >
                    {s.score > 0 ? "+" : ""}
                    {s.score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
